import { describe, it, expect } from "vitest";
import { strToU8, zipSync } from "fflate";
import {
  detectDelimiter,
  parseNumber,
  parseProductCsv,
  ProductImportFileError,
  readProductFile,
} from "./productImport";

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

  it("manfiy yoki kasrli stockni importdan oldin xato deb belgilaydi", () => {
    const csv = `name,price,stock\nOlma,5000,-2\nNok,4000,1.5`;
    const rows = parseProductCsv(csv, []);
    expect(rows[0].errors).toContain("stock");
    expect(rows[1].errors).toContain("stock");
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

describe("readProductFile", () => {
  it("birinchi worksheet'dagi XLSX ma'lumotini CSV parserga beradi", async () => {
    const workbook = `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Products" sheetId="1" r:id="rId1"/></sheets></workbook>`;
    const relationships = `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"/></Relationships>`;
    const sheet = `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>sku</t></is></c><c r="B1" t="inlineStr"><is><t>name</t></is></c><c r="C1" t="inlineStr"><is><t>price</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>A-1</t></is></c><c r="B2" t="inlineStr"><is><t>Olma, qizil</t></is></c><c r="C2"><v>12500</v></c></row></sheetData></worksheet>`;
    const bytes = zipSync({
      "xl/workbook.xml": strToU8(workbook),
      "xl/_rels/workbook.xml.rels": strToU8(relationships),
      "xl/worksheets/sheet1.xml": strToU8(sheet),
    });
    const file = new File([bytes], "products.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const csv = await readProductFile(file);
    const rows = parseProductCsv(csv, []);
    expect(rows).toHaveLength(1);
    expect(rows[0].sku).toBe("A-1");
    expect(rows[0].name).toBe("Olma, qizil");
    expect(rows[0].price).toBe(12500);
    expect(rows[0].errors).toEqual([]);
  });

  it("eski XLS formatini aniq xato bilan rad etadi", async () => {
    const file = new File(["legacy"], "products.xls");
    await expect(readProductFile(file)).rejects.toMatchObject({
      code: "legacy-xls",
    } satisfies Partial<ProductImportFileError>);
  });
});
