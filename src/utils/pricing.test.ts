import { describe, it, expect } from "vitest";
import { priceBreakdown, DEFAULT_DELIVERY_PCT, DEFAULT_SERVICE_PCT } from "./pricing";

describe("priceBreakdown", () => {
  it("default foizlar (3% / 15%) bilan hisoblaydi", () => {
    const bd = priceBreakdown(1_000_000);
    expect(bd.product).toBe(1_000_000);
    expect(bd.delivery).toBe(30_000); // 3%
    expect(bd.service).toBe(150_000); // 15%
    expect(bd.total).toBe(1_180_000);
  });

  it("berilgan tenant foizlarini ishlatadi", () => {
    const bd = priceBreakdown(200_000, 5, 10);
    expect(bd.delivery).toBe(10_000);
    expect(bd.service).toBe(20_000);
    expect(bd.total).toBe(230_000);
  });

  it("null/undefined foizlar → default", () => {
    const bd = priceBreakdown(100_000, null, undefined);
    expect(bd.delivery).toBe(100_000 * DEFAULT_DELIVERY_PCT / 100);
    expect(bd.service).toBe(100_000 * DEFAULT_SERVICE_PCT / 100);
  });

  it("0 foiz — chegirma/bepul yetkazish holati", () => {
    const bd = priceBreakdown(500_000, 0, 0);
    expect(bd.delivery).toBe(0);
    expect(bd.service).toBe(0);
    expect(bd.total).toBe(500_000);
  });

  it("kasrli natijani butun so'mga dumaloqlaydi", () => {
    // 33333 * 3% = 999.99 → 1000
    const bd = priceBreakdown(33_333, 3, 15);
    expect(bd.delivery).toBe(1_000);
    expect(bd.service).toBe(5_000); // 33333*15% = 4999.95 → 5000
    expect(Number.isInteger(bd.total)).toBe(true);
  });

  it("0 narx → hammasi 0", () => {
    const bd = priceBreakdown(0);
    expect(bd).toEqual({ product: 0, delivery: 0, service: 0, total: 0 });
  });
});
