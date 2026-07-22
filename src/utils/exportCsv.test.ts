import { describe, it, expect } from "vitest";
import { csvEscape } from "./exportCsv";

describe("csvEscape", () => {
  it("oddiy matnni o'zgartirmaydi", () => {
    expect(csvEscape("Ali")).toBe("Ali");
    expect(csvEscape(42)).toBe("42");
  });

  it("null/undefined → bo'sh", () => {
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(undefined)).toBe("");
  });

  it("vergul/tirnoq/yangi qatorni tirnoqlaydi", () => {
    expect(csvEscape("a,b")).toBe('"a,b"');
    expect(csvEscape('he said "hi"')).toBe('"he said ""hi"""');
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
  });

  it("formula injection — = + - @ bilan boshlangan katakni ' bilan neytrallaydi", () => {
    expect(csvEscape('=HYPERLINK("http://evil")')).toBe('"\'=HYPERLINK(""http://evil"")"');
    expect(csvEscape("+1234")).toBe("'+1234");
    expect(csvEscape("-cmd")).toBe("'-cmd");
    expect(csvEscape("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("tab bilan boshlangan katakni ham neytrallaydi (tab CSV delimiter emas — tirnoqlanmaydi)", () => {
    expect(csvEscape("\t=1+1")).toBe("'\t=1+1");
  });

  it("CR bilan boshlangan katak — neytrallanadi va tirnoqlanadi", () => {
    expect(csvEscape("\r=1+1")).toBe('"\'\r=1+1"');
  });

  it("xavfsiz kontentdagi = belgisi (boshida emas) tegilmaydi", () => {
    expect(csvEscape("a=b")).toBe("a=b");
  });
});
