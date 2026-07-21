import { describe, it, expect } from "vitest";
import { parseProductContent, serializeProductContent } from "./ProductContentEditor";

describe("parseProductContent", () => {
  it("returns an empty state for null/undefined content", () => {
    const s = parseProductContent(undefined);
    expect(s.servings).toBe("");
    expect(s.bespoke).toBe(false);
    expect(s.loc.uz.tagline).toBe("");
    expect(s.loc.uz.highlights).toEqual([]);
    expect(s.loc.ru.benefits).toEqual([]);
  });

  it("treats flat content as the uz locale", () => {
    const s = parseProductContent({
      tagline: "Tez energiya",
      highlights: ["100% tabiiy", "GMO'siz"],
      servings: 30,
      bespoke: true,
    });
    expect(s.loc.uz.tagline).toBe("Tez energiya");
    expect(s.loc.uz.highlights).toEqual(["100% tabiiy", "GMO'siz"]);
    expect(s.servings).toBe("30");
    expect(s.bespoke).toBe(true);
    // ru bo'sh qoladi
    expect(s.loc.ru.tagline).toBe("");
  });

  it("reads per-locale content into both locales", () => {
    const s = parseProductContent({
      uz: { tagline: "Salom", bespoke: true, servings: 12 },
      ru: { tagline: "Привет" },
    });
    expect(s.loc.uz.tagline).toBe("Salom");
    expect(s.loc.ru.tagline).toBe("Привет");
    // umumiy maydonlar uz bazasidan
    expect(s.bespoke).toBe(true);
    expect(s.servings).toBe("12");
  });

  it("coerces structured arrays and ignores malformed entries", () => {
    const s = parseProductContent({
      benefits: [{ title: "A", description: "B", icon: "😊" }, "junk", { title: "C" }],
      ingredients: [{ name: "Vitamin C", amount: "500mg", dailyValue: "80%" }],
      faq: [{ question: "Q?", answer: "A." }],
    });
    expect(s.loc.uz.benefits).toEqual([
      { icon: "😊", title: "A", description: "B" },
      { icon: "", title: "C", description: "" },
    ]);
    expect(s.loc.uz.ingredients[0]).toEqual({ name: "Vitamin C", amount: "500mg", dailyValue: "80%" });
    expect(s.loc.uz.faq).toEqual([{ question: "Q?", answer: "A." }]);
  });
});

describe("serializeProductContent", () => {
  it("returns undefined when everything is empty", () => {
    expect(serializeProductContent(parseProductContent(undefined))).toBeUndefined();
  });

  it("writes shared fields (servings/bespoke) into the uz base only", () => {
    const state = parseProductContent(undefined);
    state.servings = "30";
    state.bespoke = true;
    const out = serializeProductContent(state) as Record<string, Record<string, unknown>>;
    expect(out.uz.servings).toBe(30);
    expect(out.uz.bespoke).toBe(true);
    expect(out.ru).toBeUndefined();
  });

  it("trims and drops empty localized fields", () => {
    const state = parseProductContent(undefined);
    state.loc.uz.tagline = "  Slogan  ";
    state.loc.uz.highlights = ["  ", "Real", ""];
    state.loc.uz.benefits = [{ icon: "", title: "", description: "" }]; // butunlay bo'sh → tashlanadi
    const out = serializeProductContent(state) as Record<string, Record<string, unknown>>;
    expect(out.uz.tagline).toBe("Slogan");
    expect(out.uz.highlights).toEqual(["Real"]);
    expect(out.uz.benefits).toBeUndefined();
  });

  it("round-trips per-locale content and preserves unknown keys (name/badges overrides)", () => {
    const original = {
      uz: { tagline: "UZ", name: "Maxsus nom", badges: ["yangi"], highlights: ["a"] },
      ru: { tagline: "RU" },
    };
    const out = serializeProductContent(parseProductContent(original)) as Record<string, Record<string, unknown>>;
    expect(out.uz.tagline).toBe("UZ");
    expect(out.uz.name).toBe("Maxsus nom"); // _extra saqlangan
    expect(out.uz.badges).toEqual(["yangi"]);
    expect(out.uz.highlights).toEqual(["a"]);
    expect(out.ru.tagline).toBe("RU");
  });

  it("normalizes flat content into per-locale on save", () => {
    const out = serializeProductContent(parseProductContent({ tagline: "Flat" })) as Record<
      string,
      Record<string, unknown>
    >;
    expect(out.uz.tagline).toBe("Flat");
    expect(out.ru).toBeUndefined();
  });
});
