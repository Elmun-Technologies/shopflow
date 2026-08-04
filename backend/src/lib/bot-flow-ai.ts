// Bot generator — erkin matndagi brifni tayyor BotFlow oqimiga aylantiradi.
//
// Mijozdan kelgan texnik topshiriq (ko'pincha rus tilida, "menyu / tugmalar /
// anketa savollari" ro'yxati ko'rinishida) Claude'ga uzatiladi va u
// `bot-flow-schema.ts` kontraktiga mos JSON qaytaradi. Natija zod bilan
// tekshiriladi — model xato shakl qaytarsa, saqlanmaydi.
//
// ANTHROPIC_API_KEY yo'q bo'lsa failsoft: { ok: false } qaytadi va admin UI
// shablonlardan foydalanishni taklif qiladi.

import {
  botFlowDefinitionSchema,
  validateFlowRefs,
  type BotFlowDefinition,
} from "./bot-flow-schema.js";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-5";
const MAX_TOKENS = 16_000;
const TIMEOUT_MS = 120_000;
const MAX_BRIEF_CHARS = 24_000;

export interface BotFlowAIResult {
  ok: boolean;
  definition?: BotFlowDefinition;
  /** Modelning qisqa izohi — admin UI'da ko'rsatiladi */
  summary?: string;
  /** Havola xatolari (agar model buzuq oqim qaytarsa) */
  warnings?: string[];
  reason?: string;
}

const SYSTEM_PROMPT = `You design Telegram bot conversation flows for ShopFlow, a multi-tenant commerce/CRM platform used by businesses in Uzbekistan.

You receive a brief describing what a client's Telegram bot should do — usually a list of menus, button labels, message texts and questionnaire questions. You convert it into a strict JSON flow definition.

## Output contract

Return ONLY a JSON object (no markdown fences, no prose) with this exact shape:

{
  "summary": "one short sentence in Uzbek describing what you built",
  "definition": {
    "version": 1,
    "settings": {
      "startScreenId": "main",
      "welcome": { "uz": "...", "ru": "..." },
      "defaultLang": "uz" | "ru",
      "languages": ["uz", "ru"],
      "askLanguageOnStart": false,
      "showStoreButton": true,
      "storeButtonLabel": { "uz": "...", "ru": "..." },
      "fallback": "ai" | "lead" | "operator" | "menu",
      "fallbackText": { "uz": "...", "ru": "..." },
      "commands": [{ "command": "start", "description": { "uz": "...", "ru": "..." }, "screenId": null }]
    },
    "screens": [
      {
        "id": "main",
        "name": "admin-facing name",
        "text": { "uz": "...", "ru": "..." },
        "imageUrl": null,
        "showBack": true,
        "buttons": [
          { "id": "catalog", "label": { "uz": "...", "ru": "..." }, "fullWidth": true,
            "action": { "type": "screen", "screenId": "catalog" } }
        ]
      }
    ],
    "forms": [
      {
        "id": "solution",
        "name": "admin-facing name",
        "intro": { "uz": "...", "ru": "..." },
        "leadStatus": "NEW" | "CONTACTED" | "QUALIFIED",
        "tags": ["bot"],
        "notifyAdmin": true,
        "successText": { "uz": "... {id} ...", "ru": "... {id} ..." },
        "fields": [
          { "id": "company", "label": { "uz": "...", "ru": "..." }, "type": "text",
            "required": true, "options": [], "mapTo": "company" }
        ]
      }
    ]
  }
}

## Button actions

- { "type": "screen", "screenId": "<id>" }      — go to another screen
- { "type": "form", "formId": "<id>" }          — start a questionnaire
- { "type": "text", "text": { "uz": "...", "ru": "..." } } — show a static info page
- { "type": "webapp" }                          — open the Mini App store
- { "type": "url", "url": "https://..." }       — external link
- { "type": "catalog", "categoryId": null }     — list real products from the database
- { "type": "track_order" }                     — ask for an order number and look it up
- { "type": "operator" }                        — hand off to a human operator
- { "type": "language" }                        — language switcher
- { "type": "back" } / { "type": "home" }       — navigation

## Field types

"text" | "phone" | "email" | "number" | "choice" | "contact"

- "choice" MUST have a non-empty "options" array of { "uz", "ru" } labels.
- "contact" shows a "share phone number" button — use it for phone questions.
- "mapTo" writes the answer into a CRM lead column: "name" | "phone" | "email" | "company" | "position" | "location" | null.
  Map every questionnaire's company/name/phone/city question. Everything else uses null and lands in the lead notes.

## Hard rules

1. ALL ids (screens, buttons, forms, fields) match ^[a-z0-9_]{1,24}$ and are unique within their collection.
2. Every "screenId"/"formId" referenced by a button MUST exist in the output. Never reference something you did not create.
3. There MUST be a screen whose id equals settings.startScreenId (use "main").
4. Both "uz" and "ru" are required on every localized text. If the brief is only in Russian, translate to natural Uzbek (Latin script) yourself — do not leave "uz" empty and do not transliterate the Russian.
5. Keep the client's exact wording and button labels from the brief where they gave them; do not invent extra marketing copy.
6. Message text may use Telegram HTML: <b>, <i>, <code>, <a href>. NEVER use Markdown.
7. Use "{store}" as a placeholder for the company name in the welcome text — it is substituted at runtime.
8. successText should include "{id}" — it is replaced with the generated lead code.
9. A screen with more than ~6 buttons should use "fullWidth": false so buttons pair into two columns.
10. Long questionnaires belong in "forms", not as chains of screens. A screen is a menu; a form is a sequence of questions.
11. Maximum 60 screens, 30 forms, 30 fields per form, 24 buttons per screen.
12. If the brief describes a B2B flow with no shopping cart, set "showStoreButton": false and "fallback": "operator".

Return the JSON object and nothing else.`;

/** Brifdan oqim generatsiya qiladi. */
export async function generateBotFlow(
  brief: string,
  context: { storeName: string; hasProducts: boolean; existing?: BotFlowDefinition },
): Promise<BotFlowAIResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, reason: "ANTHROPIC_API_KEY sozlanmagan" };

  const trimmed = brief.trim();
  if (trimmed.length < 20) return { ok: false, reason: "Brif juda qisqa" };

  const userParts = [
    `Company / store name: ${context.storeName}`,
    context.hasProducts
      ? "The tenant has a real product catalog in the database, so a { \"type\": \"catalog\" } button is useful."
      : "The tenant has no products in the database yet — avoid the \"catalog\" action, use screens and forms instead.",
  ];

  if (context.existing && context.existing.screens.length > 0) {
    userParts.push(
      "The bot already has this flow. Modify it according to the brief below, keeping ids stable where the meaning is unchanged:",
      "```json",
      JSON.stringify(context.existing).slice(0, 20_000),
      "```",
    );
  }

  userParts.push("Brief:", trimmed.slice(0, MAX_BRIEF_CHARS));

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
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userParts.join("\n\n") }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn("[bot-flow-ai] Anthropic API error", res.status, body.slice(0, 300));
      return { ok: false, reason: `Anthropic API ${res.status}` };
    }

    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const raw = data.content?.filter((c) => c.type === "text").map((c) => c.text ?? "").join("").trim();
    if (!raw) return { ok: false, reason: "AI bo'sh javob qaytardi" };

    const jsonText = extractJson(raw);
    if (!jsonText) return { ok: false, reason: "AI javobida JSON topilmadi" };

    let payload: { summary?: string; definition?: unknown };
    try {
      payload = JSON.parse(jsonText) as { summary?: string; definition?: unknown };
    } catch {
      return { ok: false, reason: "AI javobini JSON sifatida o'qib bo'lmadi" };
    }

    const parsed = botFlowDefinitionSchema.safeParse(payload.definition);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .slice(0, 5)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      return { ok: false, reason: `AI noto'g'ri shakl qaytardi — ${issues}` };
    }

    const warnings = validateFlowRefs(parsed.data);
    return {
      ok: true,
      definition: parsed.data,
      summary: typeof payload.summary === "string" ? payload.summary.slice(0, 300) : undefined,
      warnings: warnings.length ? warnings : undefined,
    };
  } catch (err) {
    clearTimeout(timer);
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[bot-flow-ai] error", message);
    return { ok: false, reason: message === "The operation was aborted." ? "Vaqt tugadi — brifni qisqartiring" : message };
  }
}

/**
 * Javobdagi birinchi to'liq JSON obyektini ajratadi. Model ba'zan matnni
 * ```json bilan o'raydi yoki oldiga izoh yozadi.
 */
function extractJson(raw: string): string | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const source = fenced ? fenced[1].trim() : raw;

  const start = source.indexOf("{");
  if (start < 0) return null;

  // Qavslarni sanaymiz — string ichidagi qavslarni hisobga olmasdan.
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return null;
}
