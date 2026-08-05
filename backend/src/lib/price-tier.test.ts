import { describe, it, expect } from "vitest";
import {
  clampQtyToMoq,
  lowestTierPrice,
  parsePriceTiers,
  priceForQty,
  validatePriceTiers,
} from "./price-tier.js";

const TIERS = [
  { minQty: 1, price: 100_000 },
  { minQty: 10, price: 90_000 },
  { minQty: 100, price: 75_000 },
];

describe("parsePriceTiers", () => {
  it("minQty bo'yicha saralaydi", () => {
    const out = parsePriceTiers([
      { minQty: 100, price: 75_000 },
      { minQty: 1, price: 100_000 },
      { minQty: 10, price: 90_000 },
    ]);
    expect(out.map((t) => t.minQty)).toEqual([1, 10, 100]);
  });

  it("buzuq JSON'da bo'sh massiv", () => {
    expect(parsePriceTiers(null)).toEqual([]);
    expect(parsePriceTiers("buzuq")).toEqual([]);
    expect(parsePriceTiers([{ minQty: 0, price: 1 }])).toEqual([]);
    expect(parsePriceTiers([{ minQty: 1 }])).toEqual([]);
  });

  it("12 tadan ko'p pog'ona rad etiladi", () => {
    const many = Array.from({ length: 13 }, (_, i) => ({ minQty: i + 1, price: 1 }));
    expect(parsePriceTiers(many)).toEqual([]);
  });
});

describe("priceForQty", () => {
  it("miqdorga mos eng yuqori pog'onani oladi", () => {
    expect(priceForQty(100_000, TIERS, 1)).toBe(100_000);
    expect(priceForQty(100_000, TIERS, 9)).toBe(100_000);
    expect(priceForQty(100_000, TIERS, 10)).toBe(90_000);
    expect(priceForQty(100_000, TIERS, 99)).toBe(90_000);
    expect(priceForQty(100_000, TIERS, 100)).toBe(75_000);
    expect(priceForQty(100_000, TIERS, 5000)).toBe(75_000);
  });

  it("pog'onasiz — bazaviy narx", () => {
    expect(priceForQty(50_000, [], 100)).toBe(50_000);
  });

  it("miqdor eng past pog'onadan ham kichik bo'lsa bazaviy narx", () => {
    const tiers = [{ minQty: 10, price: 90_000 }];
    expect(priceForQty(100_000, tiers, 5)).toBe(100_000);
    expect(priceForQty(100_000, tiers, 10)).toBe(90_000);
  });

  it("tartiblanmagan pog'onalarni ham to'g'ri o'qiydi (parse orqali)", () => {
    const tiers = parsePriceTiers([
      { minQty: 100, price: 75_000 },
      { minQty: 1, price: 100_000 },
      { minQty: 10, price: 90_000 },
    ]);
    expect(priceForQty(100_000, tiers, 50)).toBe(90_000);
  });

  it("qty < 1 bazaviy narx", () => {
    expect(priceForQty(100_000, TIERS, 0)).toBe(100_000);
  });
});

describe("lowestTierPrice", () => {
  it("eng arzon pog'ona narxi", () => {
    expect(lowestTierPrice(TIERS)).toBe(75_000);
  });
  it("pog'onasiz null", () => {
    expect(lowestTierPrice([])).toBeNull();
  });
});

describe("clampQtyToMoq", () => {
  it("MOQ pastki chegara", () => {
    expect(clampQtyToMoq(5, 25, null)).toBe(25);
    expect(clampQtyToMoq(30, 25, null)).toBe(30);
  });

  it("MOQ yo'q bo'lsa kamida 1", () => {
    expect(clampQtyToMoq(0, null, null)).toBe(1);
    expect(clampQtyToMoq(7, null, null)).toBe(7);
  });

  it("qadam bo'yicha yaxlitlaydi", () => {
    // MOQ 25, qadam 25: 26 → 50
    expect(clampQtyToMoq(26, 25, 25)).toBe(50);
    expect(clampQtyToMoq(25, 25, 25)).toBe(25);
    expect(clampQtyToMoq(50, 25, 25)).toBe(50);
  });

  it("MOQ'siz qadam 1 dan boshlab yaxlitlaydi", () => {
    expect(clampQtyToMoq(7, null, 5)).toBe(10);
    expect(clampQtyToMoq(5, null, 5)).toBe(5);
  });
});

describe("validatePriceTiers", () => {
  it("to'g'ri pog'onalarda xato yo'q", () => {
    expect(validatePriceTiers(TIERS)).toEqual([]);
  });
  it("takroriy miqdorni topadi", () => {
    expect(validatePriceTiers([{ minQty: 10, price: 1 }, { minQty: 10, price: 2 }]).join()).toContain("ikkita");
  });
  it("noto'g'ri miqdorni topadi", () => {
    expect(validatePriceTiers([{ minQty: 0, price: 1 }]).join()).toContain("miqdori");
  });
  it("manfiy narxni topadi", () => {
    expect(validatePriceTiers([{ minQty: 1, price: -5 }]).join()).toContain("narxi");
  });
});
