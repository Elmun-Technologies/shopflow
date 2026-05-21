// AI yordamchi — Telegram bot orqali mijoz xabarlariga aqlli javob qaytaradi.
//
// Anthropic Claude API'ni ishlatadi (ANTHROPIC_API_KEY env var). Agar API
// kaliti yo'q bo'lsa — failsoft, qaytaradi { used: false } va eski lid
// yaratish oqimi ishlaydi.
//
// Mijoz xabarini va tenant katalogini Claude'ga uzatadi. Claude javob:
//   - Mahsulot tavsiya qiladi (do'kondagi haqiqiy mahsulotlardan)
//   - Yoki aniq narsalar haqida savol berib turadi
//   - Yoki murakkab/yangi savol bo'lsa, operatorga yo'naltirishni so'raydi

import type { PrismaClient } from "@prisma/client";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 600;
const TIMEOUT_MS = 15_000;

interface AIResponse {
  used: boolean;
  text?: string;
  // Mahsulot ID'lari — agar bot UI'da "Savatga" tugma ko'rsatsa
  productIds?: string[];
  // Operatorga yo'naltirish kerakmi
  handoffToOperator?: boolean;
  reason?: string;
}

interface CatalogProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  stock: number;
}

function buildSystemPrompt(storeName: string, catalogJson: string): string {
  return `You are a helpful AI shopping assistant for the Telegram store "${storeName}".

Your role:
- Help customers find products from the store's catalog
- Answer questions about products (price, availability, features)
- Be warm, concise, and respond in the customer's language (Uzbek/Russian/English)
- If you recommend products, ONLY use products from the catalog below — never invent
- If the customer's request is unclear, ask ONE clarifying question
- If the customer wants to talk to a human operator, set handoffToOperator: true
- Keep responses under 500 characters

Catalog (id, name, price in customer's currency, stock):
${catalogJson}

Always respond in JSON: { "text": "your reply", "productIds": ["id1"], "handoffToOperator": false }`;
}

/**
 * Mijoz Telegram xabariga AI bilan javob qaytaradi (agar API kalit sozlangan bo'lsa).
 * Agar AI ishlamasa yoki keraksiz bo'lsa, { used: false } qaytaradi va caller
 * o'z fallback oqimini ishlatadi (oddiy lead yaratish).
 */
export async function aiReplyToMessage(
  prisma: PrismaClient,
  tenantId: string,
  userMessage: string,
): Promise<AIResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { used: false, reason: "ANTHROPIC_API_KEY not set" };
  if (!userMessage.trim() || userMessage.length < 2) return { used: false, reason: "Empty message" };

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, currency: true },
  });
  if (!tenant) return { used: false, reason: "Tenant not found" };

  const products = await prisma.product.findMany({
    where: { tenantId, active: true },
    select: { id: true, name: true, description: true, price: true, currency: true, stock: true },
    take: 60,
  });

  if (products.length === 0) {
    return { used: false, reason: "Empty catalog — AI has nothing to recommend" };
  }

  const catalog: CatalogProduct[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description?.slice(0, 200) ?? null,
    price: Number(p.price),
    currency: p.currency,
    stock: p.stock,
  }));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: buildSystemPrompt(tenant.name, JSON.stringify(catalog)),
        messages: [{ role: "user", content: userMessage.slice(0, 1000) }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn("[ai-assistant] Anthropic API error", res.status, body.slice(0, 200));
      return { used: false, reason: `API ${res.status}` };
    }

    const data = (await res.json()) as { content?: Array<{ type: string; text: string }> };
    const rawText = data.content?.find((c) => c.type === "text")?.text?.trim();
    if (!rawText) return { used: false, reason: "Empty AI response" };

    // JSON ichidagi javobni ajratish — Claude ba'zan backticks bilan o'rashi mumkin
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // Ba'zan model plain text qaytaradi — uni ham qabul qilamiz
      return { used: true, text: rawText.slice(0, 800) };
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]) as {
        text?: string;
        productIds?: string[];
        handoffToOperator?: boolean;
      };
      if (!parsed.text || parsed.text.trim().length < 2) {
        return { used: false, reason: "AI returned empty text" };
      }
      // Validate productIds against catalog
      const validIds = new Set(catalog.map((p) => p.id));
      const productIds = (parsed.productIds ?? []).filter((id) => validIds.has(id));
      return {
        used: true,
        text: parsed.text.slice(0, 800),
        productIds: productIds.length ? productIds : undefined,
        handoffToOperator: parsed.handoffToOperator === true,
      };
    } catch {
      // Parse failed — plain text fallback
      return { used: true, text: rawText.slice(0, 800) };
    }
  } catch (err) {
    clearTimeout(timer);
    console.warn("[ai-assistant] error", err);
    return { used: false, reason: err instanceof Error ? err.message : String(err) };
  }
}
