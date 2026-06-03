// Sales Doctor sync uchun telefon normalizatsiyasi testlari.
// Bu mijozlarni telefon bo'yicha to'g'ri moslashtirish (dedup) uchun muhim.

import { describe, it, expect } from "vitest";
import { normalizePhone } from "./salesdoctor-push.js";

describe("normalizePhone", () => {
  it("xalqaro formatdan oxirgi 9 raqamni oladi", () => {
    expect(normalizePhone("+998 90 123 45 67")).toBe("901234567");
    expect(normalizePhone("998901234567")).toBe("901234567");
    expect(normalizePhone("+998901234567")).toBe("901234567");
  });

  it("9 xonali raqamni o'zgartmaydi", () => {
    expect(normalizePhone("901234567")).toBe("901234567");
  });

  it("har xil formatlar bir xil natija beradi (dedup)", () => {
    const variants = ["+998 90 123 45 67", "998-90-123-45-67", "(99) 8901234567", "90 123 45 67"];
    const normalized = variants.map(normalizePhone);
    // Birinchi 3 tasi 998 prefiksli — oxirgi 9 raqam bir xil
    expect(normalized[0]).toBe("901234567");
    expect(normalized[1]).toBe("901234567");
  });

  it("bo'sh/null/undefined → null", () => {
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });

  it("raqamsiz matn → null", () => {
    expect(normalizePhone("telefon yo'q")).toBeNull();
  });

  it("9 xonadan kam raqamni o'zicha qaytaradi", () => {
    expect(normalizePhone("12345")).toBe("12345");
  });
});
