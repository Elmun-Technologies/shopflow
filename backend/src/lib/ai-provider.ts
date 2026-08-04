// Umumiy AI provayder qatlami — OpenAI yoki Anthropic.
//
// Qaysi biri ishlatilishi **kalitga qarab** hal qilinadi:
//   OPENAI_API_KEY bor    → OpenAI
//   yo'q, ANTHROPIC_API_KEY bor → Anthropic
//   ikkalasi ham yo'q     → AI funksiyalari o'chirilgan (failsoft)
//
// Ikkalasi ham bo'lsa `AI_PROVIDER=anthropic` bilan majburlash mumkin.
//
// Model env orqali — kalitning qaysi modelga ruxsati borligi hisobga
// olinmasligi mumkin, shuning uchun default'ni almashtirish oson bo'lishi kerak.
//
//   OPENAI_MODEL          (default gpt-4o)                 — murakkab vazifa
//   OPENAI_MODEL_FAST     (default gpt-4o-mini)            — tez/arzon vazifa
//   ANTHROPIC_MODEL       (default claude-sonnet-5)
//   ANTHROPIC_MODEL_FAST  (default claude-haiku-4-5-20251001)

export type AiProvider = "openai" | "anthropic";

/** `smart` — sifat muhim (bot oqimini generatsiya qilish). `fast` — arzon/tez (chat javobi). */
export type AiTier = "fast" | "smart";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

const DEFAULTS = {
  openai: { smart: "gpt-4o", fast: "gpt-4o-mini" },
  anthropic: { smart: "claude-sonnet-5", fast: "claude-haiku-4-5-20251001" },
} as const;

export interface AiConfig {
  provider: AiProvider;
  apiKey: string;
  model: string;
}

export interface AiChatRequest {
  system: string;
  user: string;
  maxTokens: number;
  timeoutMs: number;
  tier: AiTier;
  /** Javob JSON obyekt bo'lishi kerak — OpenAI'da `response_format` yoqiladi. */
  json?: boolean;
}

export interface AiChatResult {
  ok: boolean;
  text?: string;
  reason?: string;
  provider?: AiProvider;
  model?: string;
}

/** AI umuman sozlanganmi (admin UI tugmani yoqish/o'chirish uchun). */
export function isAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim() || process.env.ANTHROPIC_API_KEY?.trim());
}

/** Ishlatiladigan provayder va model. Kalit yo'q bo'lsa null. */
export function resolveAiConfig(tier: AiTier): AiConfig | null {
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  const forced = process.env.AI_PROVIDER?.trim().toLowerCase();

  const useAnthropic =
    forced === "anthropic" ? Boolean(anthropicKey) : !openaiKey && Boolean(anthropicKey);

  if (useAnthropic && anthropicKey) {
    const model =
      (tier === "fast" ? process.env.ANTHROPIC_MODEL_FAST : process.env.ANTHROPIC_MODEL)?.trim() ||
      DEFAULTS.anthropic[tier];
    return { provider: "anthropic", apiKey: anthropicKey, model };
  }

  if (openaiKey) {
    const model =
      (tier === "fast" ? process.env.OPENAI_MODEL_FAST : process.env.OPENAI_MODEL)?.trim() ||
      DEFAULTS.openai[tier];
    return { provider: "openai", apiKey: openaiKey, model };
  }

  return null;
}

/**
 * Bitta system+user so'rovni yuboradi va model matnini qaytaradi.
 * Hech qachon throw qilmaydi — chaqiruvchilar failsoft ishlaydi.
 */
export async function aiChat(req: AiChatRequest): Promise<AiChatResult> {
  const cfg = resolveAiConfig(req.tier);
  if (!cfg) return { ok: false, reason: "OPENAI_API_KEY yoki ANTHROPIC_API_KEY sozlanmagan" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), req.timeoutMs);
  try {
    const text =
      cfg.provider === "openai"
        ? await callOpenAI(cfg, req, controller.signal)
        : await callAnthropic(cfg, req, controller.signal);
    clearTimeout(timer);

    if (typeof text !== "string") return { ...text, provider: cfg.provider, model: cfg.model };
    if (!text.trim()) return { ok: false, reason: "AI bo'sh javob qaytardi", provider: cfg.provider, model: cfg.model };
    return { ok: true, text, provider: cfg.provider, model: cfg.model };
  } catch (err) {
    clearTimeout(timer);
    const message = err instanceof Error ? err.message : String(err);
    const aborted = /abort/i.test(message);
    console.warn(`[ai-provider] ${cfg.provider} error`, message.slice(0, 200));
    return {
      ok: false,
      reason: aborted ? "Vaqt tugadi — so'rovni qisqartiring" : message,
      provider: cfg.provider,
      model: cfg.model,
    };
  }
}

// ─── OpenAI ─────────────────────────────────────────────────────────────────

/**
 * OpenAI Chat Completions.
 *
 * Model env orqali almashtiriladi, shuning uchun parametr nomlari modeldan
 * modelga farq qilishi mumkin. Ikkita ma'lum farq avtomatik qoplanadi:
 *   • yangi modellar `max_tokens` o'rniga `max_completion_tokens` talab qiladi;
 *   • ba'zi modellar `response_format: json_object` ni qo'llab-quvvatlamaydi.
 * Har biri uchun bir marta qayta uriniladi — model o'zgarganda kod tegilmasin.
 */
async function callOpenAI(
  cfg: AiConfig,
  req: AiChatRequest,
  signal: AbortSignal,
): Promise<string | AiChatResult> {
  let useCompletionTokens = false;
  let useJsonFormat = req.json === true;

  for (let attempt = 0; attempt < 3; attempt++) {
    const body: Record<string, unknown> = {
      model: cfg.model,
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.user },
      ],
      [useCompletionTokens ? "max_completion_tokens" : "max_tokens"]: req.maxTokens,
    };
    if (useJsonFormat) body.response_format = { type: "json_object" };

    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify(body),
      signal,
    });

    if (res.ok) {
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string | null } }>;
      };
      return data.choices?.[0]?.message?.content?.trim() ?? "";
    }

    const errorText = await res.text().catch(() => "");

    // Parametr nomi bilan bog'liq 400 — bir marta boshqacha shakl bilan urinamiz
    if (res.status === 400 && !useCompletionTokens && /max_completion_tokens/i.test(errorText)) {
      useCompletionTokens = true;
      continue;
    }
    if (res.status === 400 && useJsonFormat && /response_format/i.test(errorText)) {
      // JSON rejimi yo'q — javobdan JSON'ni baribir ajratib olamiz
      useJsonFormat = false;
      continue;
    }

    console.warn("[ai-provider] OpenAI error", res.status, errorText.slice(0, 300));
    return { ok: false, reason: describeOpenAIError(res.status, errorText, cfg.model) };
  }

  return { ok: false, reason: "OpenAI so'rovi bir necha marta rad etildi" };
}

function describeOpenAIError(status: number, body: string, model: string): string {
  if (status === 401) return "OpenAI kaliti noto'g'ri (OPENAI_API_KEY)";
  if (status === 429) return "OpenAI limiti tugadi yoki hisobda mablag' yo'q";
  if (status === 404 || /does not exist|do not have access/i.test(body)) {
    return `OpenAI "${model}" modeliga ruxsat yo'q — OPENAI_MODEL ni o'zgartiring`;
  }
  return `OpenAI API ${status}`;
}

// ─── Anthropic ──────────────────────────────────────────────────────────────

async function callAnthropic(
  cfg: AiConfig,
  req: AiChatRequest,
  signal: AbortSignal,
): Promise<string | AiChatResult> {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": cfg.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: req.maxTokens,
      system: req.system,
      messages: [{ role: "user", content: req.user }],
    }),
    signal,
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    console.warn("[ai-provider] Anthropic error", res.status, errorText.slice(0, 300));
    if (res.status === 401) return { ok: false, reason: "Anthropic kaliti noto'g'ri (ANTHROPIC_API_KEY)" };
    if (res.status === 429) return { ok: false, reason: "Anthropic limiti tugadi" };
    return { ok: false, reason: `Anthropic API ${res.status}` };
  }

  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  return (data.content ?? [])
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("")
    .trim();
}

// ─── JSON ajratish ──────────────────────────────────────────────────────────

/**
 * Javobdagi birinchi to'liq JSON obyektini ajratadi. Modellar ba'zan matnni
 * ```json bilan o'raydi yoki oldiga izoh yozadi — ikkalasi ham qoplanadi.
 * String ichidagi qavslar hisobga olinmaydi.
 */
export function extractJson(raw: string): string | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const source = fenced ? fenced[1].trim() : raw;

  const start = source.indexOf("{");
  if (start < 0) return null;

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
