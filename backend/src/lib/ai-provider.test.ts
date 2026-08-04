import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { extractJson, isAiConfigured, resolveAiConfig } from "./ai-provider.js";

const AI_ENV = [
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "AI_PROVIDER",
  "OPENAI_MODEL",
  "OPENAI_MODEL_FAST",
  "ANTHROPIC_MODEL",
  "ANTHROPIC_MODEL_FAST",
] as const;

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const key of AI_ENV) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of AI_ENV) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("isAiConfigured", () => {
  it("kalitsiz false", () => {
    expect(isAiConfigured()).toBe(false);
  });

  it("bo'sh satr kalit hisoblanmaydi", () => {
    process.env.OPENAI_API_KEY = "   ";
    expect(isAiConfigured()).toBe(false);
  });

  it("har qaysi kalit yetarli", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-x";
    expect(isAiConfigured()).toBe(true);
  });
});

describe("resolveAiConfig", () => {
  it("kalitsiz null", () => {
    expect(resolveAiConfig("smart")).toBeNull();
  });

  it("faqat OpenAI kaliti bo'lsa OpenAI", () => {
    process.env.OPENAI_API_KEY = "sk-proj-x";
    expect(resolveAiConfig("smart")).toEqual({
      provider: "openai",
      apiKey: "sk-proj-x",
      model: "gpt-4o",
    });
  });

  it("faqat Anthropic kaliti bo'lsa Anthropic", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-x";
    expect(resolveAiConfig("smart")?.provider).toBe("anthropic");
  });

  it("ikkalasi bo'lsa OpenAI ustun", () => {
    process.env.OPENAI_API_KEY = "sk-proj-x";
    process.env.ANTHROPIC_API_KEY = "sk-ant-x";
    expect(resolveAiConfig("smart")?.provider).toBe("openai");
  });

  it("AI_PROVIDER=anthropic majburlaydi", () => {
    process.env.OPENAI_API_KEY = "sk-proj-x";
    process.env.ANTHROPIC_API_KEY = "sk-ant-x";
    process.env.AI_PROVIDER = "anthropic";
    expect(resolveAiConfig("smart")?.provider).toBe("anthropic");
  });

  it("AI_PROVIDER=anthropic, lekin Anthropic kaliti yo'q → OpenAI'ga tushadi", () => {
    process.env.OPENAI_API_KEY = "sk-proj-x";
    process.env.AI_PROVIDER = "anthropic";
    expect(resolveAiConfig("smart")?.provider).toBe("openai");
  });

  it("fast tier arzonroq modelni oladi", () => {
    process.env.OPENAI_API_KEY = "sk-proj-x";
    expect(resolveAiConfig("fast")?.model).toBe("gpt-4o-mini");
    expect(resolveAiConfig("smart")?.model).toBe("gpt-4o");
  });

  it("model env orqali almashadi", () => {
    process.env.OPENAI_API_KEY = "sk-proj-x";
    process.env.OPENAI_MODEL = "gpt-5";
    process.env.OPENAI_MODEL_FAST = "gpt-5-mini";
    expect(resolveAiConfig("smart")?.model).toBe("gpt-5");
    expect(resolveAiConfig("fast")?.model).toBe("gpt-5-mini");
  });

  it("Anthropic modellari ham env orqali almashadi", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-x";
    process.env.ANTHROPIC_MODEL = "claude-opus-5";
    expect(resolveAiConfig("smart")?.model).toBe("claude-opus-5");
    expect(resolveAiConfig("fast")?.model).toBe("claude-haiku-4-5-20251001");
  });

  it("kalit atrofidagi bo'shliqlar tozalanadi", () => {
    process.env.OPENAI_API_KEY = "  sk-proj-x  ";
    expect(resolveAiConfig("smart")?.apiKey).toBe("sk-proj-x");
  });
});

describe("extractJson", () => {
  it("toza JSON'ni qaytaradi", () => {
    expect(extractJson('{"a":1}')).toBe('{"a":1}');
  });

  it("```json fence ichidan ajratadi", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("oldidagi izohni tashlaydi", () => {
    expect(extractJson('Mana natija:\n{"a":1}')).toBe('{"a":1}');
  });

  it("ichma-ich obyektlarni to'liq oladi", () => {
    const src = '{"a":{"b":{"c":1}},"d":2}';
    expect(extractJson(`prefiks ${src} suffiks`)).toBe(src);
  });

  it("string ichidagi qavslarni sanamaydi", () => {
    const src = '{"a":"} yolg\'on qavs {","b":1}';
    expect(extractJson(src)).toBe(src);
  });

  it("escape qilingan qo'shtirnoqni to'g'ri o'qiydi", () => {
    const src = '{"a":"u \\" bu","b":1}';
    expect(extractJson(src)).toBe(src);
  });

  it("JSON bo'lmasa null", () => {
    expect(extractJson("hech qanday json yo'q")).toBeNull();
  });

  it("yopilmagan obyekt uchun null", () => {
    expect(extractJson('{"a":1')).toBeNull();
  });
});
