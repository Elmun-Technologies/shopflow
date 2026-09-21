// CSV / Excel paste parser — mahsulot importi uchun.
// Header aliaslari (uz/ru/en), BOM, SKU ixtiyoriy, noma'lum kategoriya xato emas.

import { strFromU8, unzipSync } from "fflate";

export interface ParsedProductRow {
  rowNum: number;
  sku: string;
  name: string;
  description: string;
  price: number;
  oldPrice: number | null;
  stock: number;
  categoryName: string;
  categoryId: string | null;
  errors: string[];
  notes: string[];
}

export function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/)[0] ?? "";
  if (firstLine.includes("\t")) return "\t";
  if (firstLine.includes(";")) return ";";
  return ",";
}

export function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuotes = false;
      } else cur += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === delim) {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function parseNumber(s: string): number | null {
  if (!s) return null;
  const cleaned = s.replace(/[\s\u00a0]/g, "").replace(/,/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function normHeader(h: string): string {
  return h
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .replace(/[\s_\-./]+/g, "");
}

const NAME_HEADERS = new Set(["name", "nomi", "название", "наименование", "товар", "mahsulot", "product"]);
const SKU_HEADERS = new Set(["sku", "artikul", "артикул", "код", "code", "article"]);
const DESC_HEADERS = new Set(["description", "tavsif", "описание", "desc"]);
const PRICE_HEADERS = new Set(["price", "narx", "narxi", "цена", "ценапродажи", "cost"]);
const OLD_HEADERS = new Set(["oldprice", "old_price", "eskinarx", "стараяцена", "old"]);
const STOCK_HEADERS = new Set(["stock", "ombor", "qoldiq", "остаток", "количество", "qty", "quantity"]);
const CAT_HEADERS = new Set(["category", "kategoriya", "категория", "group", "группа"]);

function findHeader(header: string[], aliases: Set<string>): number {
  return header.findIndex((h) => aliases.has(normHeader(h)));
}

export function looksLikeSpreadsheetBinary(text: string): boolean {
  // xlsx/xls magic — faylni text() qilib o'qiganda chiqadigan belgilar
  return text.startsWith("PK") || text.includes("xl/") || text.includes("Workbook");
}

export type ProductImportFileErrorCode = "legacy-xls" | "invalid-xlsx" | "too-large" | "empty";

export class ProductImportFileError extends Error {
  constructor(public code: ProductImportFileErrorCode) {
    super(code);
    this.name = "ProductImportFileError";
  }
}

const MAX_IMPORT_FILE_BYTES = 25 * 1024 * 1024;

function elementsByLocalName(root: Document | Element, name: string): Element[] {
  const namespaced = root.getElementsByTagNameNS("*", name);
  if (namespaced.length > 0) return Array.from(namespaced);
  return Array.from(root.getElementsByTagName(name));
}

function parseXml(bytes: Uint8Array): Document {
  const doc = new DOMParser().parseFromString(strFromU8(bytes), "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new ProductImportFileError("invalid-xlsx");
  }
  return doc;
}

function zipText(files: Record<string, Uint8Array>, path: string): Uint8Array | null {
  return files[path] ?? null;
}

function resolveZipPath(baseDir: string, target: string): string {
  const raw = target.startsWith("/") ? target.slice(1) : `${baseDir}/${target}`;
  const parts: string[] = [];
  for (const part of raw.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

function columnIndex(cellRef: string): number {
  const letters = /^([A-Z]+)/i.exec(cellRef)?.[1].toUpperCase() ?? "A";
  let result = 0;
  for (const letter of letters) result = result * 26 + letter.charCodeAt(0) - 64;
  return result - 1;
}

function csvEscape(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Reads the first worksheet of an .xlsx file without importing the vulnerable
 * legacy SheetJS package. XLSX is a ZIP of small XML files, so the browser can
 * safely decode the values needed by the product import form.
 */
export async function parseProductXlsx(file: File): Promise<string> {
  try {
    const files = unzipSync(new Uint8Array(await file.arrayBuffer()));
    const workbookBytes = zipText(files, "xl/workbook.xml");
    const relsBytes = zipText(files, "xl/_rels/workbook.xml.rels");
    if (!workbookBytes || !relsBytes) throw new ProductImportFileError("invalid-xlsx");

    const workbook = parseXml(workbookBytes);
    const relations = parseXml(relsBytes);
    const sharedStringsBytes = zipText(files, "xl/sharedStrings.xml");
    const sharedStrings = sharedStringsBytes
      ? elementsByLocalName(parseXml(sharedStringsBytes), "si").map((item) => item.textContent ?? "")
      : [];

    const firstSheet = elementsByLocalName(workbook, "sheet")[0];
    if (!firstSheet) throw new ProductImportFileError("invalid-xlsx");
    const relationId = firstSheet.getAttribute("r:id") || firstSheet.getAttribute("id");
    const relation = elementsByLocalName(relations, "Relationship").find(
      (item) => item.getAttribute("Id") === relationId,
    );
    const target = relation?.getAttribute("Target");
    if (!target) throw new ProductImportFileError("invalid-xlsx");

    const worksheetPath = resolveZipPath("xl", target);
    const worksheetBytes = zipText(files, worksheetPath);
    if (!worksheetBytes) throw new ProductImportFileError("invalid-xlsx");
    const worksheet = parseXml(worksheetBytes);

    const lines: string[] = [];
    for (const row of elementsByLocalName(worksheet, "row")) {
      const values: string[] = [];
      for (const cell of elementsByLocalName(row, "c")) {
        const reference = cell.getAttribute("r") ?? "A1";
        const index = columnIndex(reference);
        const type = cell.getAttribute("t");
        const inline = elementsByLocalName(cell, "is")[0]?.textContent ?? "";
        const rawValue = elementsByLocalName(cell, "v")[0]?.textContent ?? "";
        let value = type === "inlineStr" ? inline : rawValue;
        if (type === "s") value = sharedStrings[Number(rawValue)] ?? "";
        else if (type === "b") value = rawValue === "1" ? "TRUE" : "FALSE";
        while (values.length <= index) values.push("");
        values[index] = value;
      }
      if (values.some((value) => value.trim() !== "")) lines.push(values.map(csvEscape).join(","));
    }

    if (lines.length === 0) throw new ProductImportFileError("empty");
    return lines.join("\n");
  } catch (error) {
    if (error instanceof ProductImportFileError) throw error;
    throw new ProductImportFileError("invalid-xlsx");
  }
}

/** Reads CSV/TSV/TXT or the first worksheet from an XLSX workbook. */
export async function readProductFile(file: File): Promise<string> {
  if (file.size > MAX_IMPORT_FILE_BYTES) throw new ProductImportFileError("too-large");
  const name = file.name.toLowerCase();
  if (name.endsWith(".xls") && !name.endsWith(".xlsx")) {
    throw new ProductImportFileError("legacy-xls");
  }
  if (name.endsWith(".xlsx")) return parseProductXlsx(file);

  const content = await file.text();
  if (!content.trim()) throw new ProductImportFileError("empty");
  if (looksLikeSpreadsheetBinary(content)) throw new ProductImportFileError("invalid-xlsx");
  return content;
}

export function parseProductCsv(
  text: string,
  categories: Array<{ id: string; name: string }>,
): ParsedProductRow[] {
  const raw = text.replace(/^\uFEFF/, "");
  const delim = detectDelimiter(raw);
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];

  const first = splitCsvLine(lines[0], delim);
  const hasName = findHeader(first, NAME_HEADERS) >= 0;
  const hasPrice = findHeader(first, PRICE_HEADERS) >= 0;
  const hasSku = findHeader(first, SKU_HEADERS) >= 0;
  const useHeader = hasName || hasPrice || hasSku;

  const idx = useHeader
    ? {
        sku: findHeader(first, SKU_HEADERS),
        name: findHeader(first, NAME_HEADERS),
        description: findHeader(first, DESC_HEADERS),
        price: findHeader(first, PRICE_HEADERS),
        oldPrice: findHeader(first, OLD_HEADERS),
        stock: findHeader(first, STOCK_HEADERS),
        category: findHeader(first, CAT_HEADERS),
      }
    : {
        // Namuna tartibi: sku, name, description, price, oldPrice, stock, category
        sku: 0,
        name: 1,
        description: 2,
        price: 3,
        oldPrice: 4,
        stock: 5,
        category: 6,
      };

  const dataLines = useHeader ? lines.slice(1) : lines;
  const catByName = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c.id]));

  return dataLines.map((line, i) => {
    const cells = splitCsvLine(line, delim);
    const cell = (n: number) => (n >= 0 ? cells[n] ?? "" : "");
    const sku = cell(idx.sku);
    const name = cell(idx.name);
    const description = cell(idx.description);
    const priceRaw = cell(idx.price);
    const oldPriceRaw = cell(idx.oldPrice);
    const stockRaw = cell(idx.stock);
    const categoryName = cell(idx.category);

    const errors: string[] = [];
    const notes: string[] = [];
    if (!name) errors.push("name");
    const price = parseNumber(priceRaw);
    if (price == null || price < 0) errors.push("price");
    const oldPrice = oldPriceRaw ? parseNumber(oldPriceRaw) : null;
    if (oldPriceRaw && (oldPrice == null || oldPrice < 0)) errors.push("oldPrice");
    const parsedStock = stockRaw ? parseNumber(stockRaw) : 0;
    const stock = parsedStock ?? 0;
    if (stockRaw && (parsedStock == null || parsedStock < 0 || !Number.isInteger(parsedStock))) {
      errors.push("stock");
    }
    if (!sku) notes.push("sku-auto");

    let categoryId: string | null = null;
    if (categoryName) {
      categoryId = catByName.get(categoryName.toLowerCase()) ?? null;
      if (!categoryId) notes.push("category-create");
    }

    return {
      rowNum: useHeader ? i + 2 : i + 1,
      sku,
      name,
      description,
      price: price ?? 0,
      oldPrice,
      stock,
      categoryName,
      categoryId,
      errors,
      notes,
    };
  });
}

export const SAMPLE_PRODUCT_CSV = `sku,name,description,price,oldPrice,stock,category
IPH-15,iPhone 15 Pro Max,Original Apple smartfon,14500000,,5,Telefonlar
SAM-S24,Samsung Galaxy S24,256GB qora rang,12000000,13000000,8,Telefonlar
HP-PRO,HP ProBook 450,15.6 Core i7,18500000,,3,Noutbuklar`;
