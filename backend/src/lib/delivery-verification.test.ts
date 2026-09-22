import { describe, expect, it } from "vitest";
import { createDeliveryCode, verifyDeliveryCode } from "./delivery-verification.js";

describe("delivery verification", () => {
  it("creates six-digit one-way codes", () => {
    const value = createDeliveryCode();
    expect(value.code).toMatch(/^\d{6}$/);
    expect(value.hash).not.toContain(value.code);
    expect(verifyDeliveryCode(value.code, value.hash)).toBe(true);
  });
  it("rejects wrong and malformed codes", () => {
    const value = createDeliveryCode();
    expect(verifyDeliveryCode("000000", value.hash)).toBe(false);
    expect(verifyDeliveryCode("abc", value.hash)).toBe(false);
  });
});
