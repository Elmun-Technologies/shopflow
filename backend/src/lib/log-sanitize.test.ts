// SECURITY (M2): URL query string ichidagi JWT/token loglarga tushmasligi
// uchun sanitizeUrl testlari.

import { describe, it, expect } from "vitest";
import { sanitizeUrl } from "./log-sanitize.js";

describe("sanitizeUrl", () => {
  it("token query parametrini [REDACTED] bilan almashtiradi", () => {
    expect(sanitizeUrl("/api/events/stream?token=eyJ.SECRET.SIG")).toBe(
      "/api/events/stream?token=[REDACTED]",
    );
  });

  it("boshqa parametrlarni saqlaydi, faqat token'ni yashiradi", () => {
    expect(sanitizeUrl("/api/tenant-export?token=abc123&foo=bar")).toBe(
      "/api/tenant-export?token=[REDACTED]&foo=bar",
    );
  });

  it("bir nechta maxfiy parametrlarni yashiradi", () => {
    expect(sanitizeUrl("/x?foo=1&token=a&access_token=b&api_key=c&bar=2")).toBe(
      "/x?foo=1&token=[REDACTED]&access_token=[REDACTED]&api_key=[REDACTED]&bar=2",
    );
  });

  it("token yo'q URL'ni o'zgartirmaydi", () => {
    expect(sanitizeUrl("/api/orders?page=2")).toBe("/api/orders?page=2");
    expect(sanitizeUrl("/api/events/stream")).toBe("/api/events/stream");
  });

  it("bo'sh / null / undefined'ni xavfsiz qaytaradi", () => {
    expect(sanitizeUrl("")).toBe("");
    expect(sanitizeUrl(null)).toBeNull();
    expect(sanitizeUrl(undefined)).toBeUndefined();
  });
});
