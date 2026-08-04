// AI yordamchi — Telegram bot orqali mijoz xabarlariga aqlli javob qaytaradi.
//
// Provayder (OpenAI yoki Anthropic) va model `ai-provider.ts` da kalitga qarab
// hal qilinadi. Kalit yo'q bo'lsa — failsoft, qaytaradi { used: false } va eski
// lid yaratish oqimi ishlaydi.
//
// Mijoz xabarini va tenant katalogini modelga uzatadi. Model javobi:
//   - Mahsulot tavsiya qiladi (do'kondagi haqiqiy mahsulotlardan)
//   - Yoki aniq narsalar haqida savol berib turadi
//   - Yoki murakkab/yangi savol bo'lsa, operatorga yo'naltirishni so'raydi

import type { PrismaClient } from "@prisma/client";
import { aiChat, extractJson, isAiConfigured } from "./ai-provider.js";

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
  if (!isAiConfigured()) return { used: false, reason: "AI kaliti sozlanmagan" };
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

  const res = await aiChat({
    system: buildSystemPrompt(tenant.name, JSON.stringify(catalog)),
    user: userMessage.slice(0, 1000),
    maxTokens: MAX_TOKENS,
    timeoutMs: TIMEOUT_MS,
    tier: "fast",
    json: true,
  });

  if (!res.ok || !res.text) return { used: false, reason: res.reason ?? "AI javob bermadi" };

  const jsonText = extractJson(res.text);
  if (!jsonText) {
    // Ba'zan model oddiy matn qaytaradi — uni ham qabul qilamiz
    return { used: true, text: res.text.slice(0, 800) };
  }

  try {
    const parsed = JSON.parse(jsonText) as {
      text?: string;
      productIds?: string[];
      handoffToOperator?: boolean;
    };
    if (!parsed.text || parsed.text.trim().length < 2) {
      return { used: false, reason: "AI returned empty text" };
    }
    // productIds'ni katalogga solishtiramiz — model o'ylab topgan ID o'tmasin
    const validIds = new Set(catalog.map((p) => p.id));
    const productIds = (parsed.productIds ?? []).filter((id) => validIds.has(id));
    return {
      used: true,
      text: parsed.text.slice(0, 800),
      productIds: productIds.length ? productIds : undefined,
      handoffToOperator: parsed.handoffToOperator === true,
    };
  } catch {
    return { used: true, text: res.text.slice(0, 800) };
  }
}
