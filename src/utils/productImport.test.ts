import { describe, it, expect } from "vitest";
import { parseNumber, parseProductCsv, detectDelimiter } from "./productImport";

const cats = [
  { id: "c1", name: "Telefonlar" },
  { id: "c2", name: "Noutbuklar" },
];

describe("parseNumber", () => {
  it("vergul va bo'shliqli raqamlarni o'qiydi", () => {
    expect(parseNumber("14,500,000")).toBe(14_500_000);
    expect(parseNumber("14 500 000")).toBe(14_500_000);
    expect(parseNumber("")).toBeNull();
  });
});

describe("parseProductCsv", () => {
  it("namuna CSV ni o'qiydi", () => {
    const csv = `sku,name,description,price,oldPrice,stock,category
IPH-15,iPhone 15 Pro Max,Original,14500000,,5,Telefonlar`;
    const rows = parseProductCsv(csv, cats);
    expect(rows).toHaveLength(1);
    expect(rows[0].errors).toEqual([]);
    expect(rows[0].sku).toBe("IPH-15");
    expect(rows[0].price).toBe(14_500_000);
    expect(rows[0].categoryId).toBe("c1");
  });

  it("o'zbek/rus sarlavhalarni tushunadi", () => {
    const csv = `artikul;nomi;narx;ombor;kategoriya
A1;Choy;25000;10;Choylar`;
    expect(detectDelimiter(csv)).toBe(";");
    const rows = parseProductCsv(csv, cats);
    expect(rows[0].errors).toEqual([]);
    expect(rows[0].name).toBe("Choy");
    expect(rows[0].notes).toContain("category-create");
  });

  it("SKU bo'sh bo'lsa xato emas", () => {
    const csv = `name,price
Olma,5000`;
    const rows = parseProductCsv(csv, []);
    expect(rows[0].errors).toEqual([]);
    expect(rows[0].notes).toContain("sku-auto");
  });

  it("noma'lum kategoriya xato emas — yaratiladi", () => {
    const csv = `sku,name,price,category
X,Y,100,Yangi`;
    const rows = parseProductCsv(csv, cats);
    expect(rows[0].errors).toEqual([]);
    expect(rows[0].notes).toContain("category-create");
    expect(rows[0].categoryId).toBeNull();
  });

  it("description bo'sh bo'lsa ham yaroqli", () => {
    const csv = `sku,name,price
A,B,1`;
    const rows = parseProductCsv(csv, []);
    expect(rows[0].errors).toEqual([]);
    expect(rows[0].description).toBe("");
  });

  it("sarlavhasiz qatorlarni pozitsiya bilan o'qiydi", () => {
    const csv = `SKU1\tOlma\tYaxshi\t12000\t\t4\tMeva`;
    const rows = parseProductCsv(csv, []);
    expect(rows[0].sku).toBe("SKU1");
    expect(rows[0].name).toBe("Olma");
    expect(rows[0].price).toBe(12000);
    expect(rows[0].errors).toEqual([]);
  });

  it("BOM ni olib tashlaydi", () => {
    const csv = `\uFEFFname,price\nOlma,100`;
    const rows = parseProductCsv(csv, []);
    expect(rows[0].name).toBe("Olma");
    expect(rows[0].errors).toEqual([]);
  });
});
