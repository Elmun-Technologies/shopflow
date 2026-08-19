import { describe, it, expect } from "vitest";
import {
  canonicalPhone,
  phoneLookupVariants,
  pickCanonicalCustomer,
} from "./storefront-customer.js";

describe("canonicalPhone", () => {
  it("bo'shliqli formatni +998XXXXXXXXX qiladi", () => {
    expect(canonicalPhone("+998 90 123 45 67")).toBe("+998901234567");
  });
  it("prefikssiz 9 raqamni to'ldiradi", () => {
    expect(canonicalPhone("901234567")).toBe("+998901234567");
  });
  it("bo'sh → null", () => {
    expect(canonicalPhone("")).toBeNull();
    expect(canonicalPhone(null)).toBeNull();
  });
});

describe("phoneLookupVariants", () => {
  it("checkout va profil formatlarini qamrab oladi", () => {
    const variants = phoneLookupVariants("+998 90 123 45 67");
    expect(variants).toContain("+998901234567");
    expect(variants).toContain("998901234567");
    expect(variants).toContain("901234567");
    expect(variants).toContain("+998 90 123 45 67");
  });
});

describe("pickCanonicalCustomer", () => {
  it("Telegram ID si bor yozuvni afzal ko'radi", () => {
    const picked = pickCanonicalCustomer([
      { id: "phone-only", phone: "+998901234567", telegramUserId: null },
      { id: "tg", phone: null, telegramUserId: 42n },
    ]);
    expect(picked?.id).toBe("tg");
  });
  it("bo'sh ro'yxat → null", () => {
    expect(pickCanonicalCustomer([])).toBeNull();
  });
});
