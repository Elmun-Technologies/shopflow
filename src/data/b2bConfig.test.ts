import { describe, it, expect } from "vitest";
import { normalizeB2bConfig, defaultB2bConfig } from "./uiBuilderData";

// `b2bConfig` mijoz vitrinasini boshqaradi va `brand` JSON ichida erkin shaklda
// saqlanadi — ya'ni eski/buzuq/qo'lda tahrirlangan qiymat kelishi mumkin.
// Normalizator har qanday kirishda ishlaydigan konfiguratsiya qaytarishi shart,
// aks holda do'kon ochilmaydi.
describe("normalizeB2bConfig", () => {
  it("bo'sh kirishda standart qiymatlarni qaytaradi", () => {
    expect(normalizeB2bConfig(undefined)).toEqual(defaultB2bConfig);
    expect(normalizeB2bConfig(null)).toEqual(defaultB2bConfig);
    expect(normalizeB2bConfig({})).toEqual(defaultB2bConfig);
  });

  it("narx standart holatda YASHIRIN — B2B da narxni menejer tasdiqlaydi", () => {
    expect(normalizeB2bConfig({}).showPrices).toBe(false);
  });

  it("noma'lum so'rov turlarini tashlaydi", () => {
    const cfg = normalizeB2bConfig({ inquiries: ["price", "hack", 42, "sample"] });
    expect(cfg.inquiries).toEqual(["price", "sample"]);
  });

  it("takrorlangan turlarni bir marta qoldiradi", () => {
    const cfg = normalizeB2bConfig({ inquiries: ["price", "price", "consult"] });
    expect(cfg.inquiries).toEqual(["price", "consult"]);
  });

  it("hamma turlar o'chirilgan bo'lsa standartga qaytadi", () => {
    // Aks holda mijozda hech qanday tugmasiz, harakatsiz kartochka qolardi.
    expect(normalizeB2bConfig({ inquiries: [] }).inquiries).toEqual(defaultB2bConfig.inquiries);
    expect(normalizeB2bConfig({ inquiries: ["yo'q"] }).inquiries).toEqual(defaultB2bConfig.inquiries);
  });

  it("noto'g'ri tipdagi qiymatlarni standart bilan almashtiradi", () => {
    const cfg = normalizeB2bConfig({
      showPrices: "ha",
      requireCompany: 1,
      moqNote: 123,
      intro: null,
      inquiries: "price",
    });
    expect(cfg).toEqual(defaultB2bConfig);
  });

  it("matnlarni uzunlik chegarasida kesadi", () => {
    const cfg = normalizeB2bConfig({ moqNote: "x".repeat(500), intro: "y".repeat(1000) });
    expect(cfg.moqNote).toHaveLength(120);
    expect(cfg.intro).toHaveLength(400);
  });

  it("to'g'ri qiymatlarni o'zgartirmaydi", () => {
    const input = {
      showPrices: true,
      inquiries: ["sample"],
      requireCompany: false,
      moqNote: "20 kg dan",
      intro: "Ulgurji shartlar",
    };
    expect(normalizeB2bConfig(input)).toEqual(input);
  });
});
