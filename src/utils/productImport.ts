// CSV / Excel paste parser — mahsulot importi uchun.
// Header aliaslari (uz/ru/en), BOM, SKU ixtiyoriy, noma'lum kategoriya xato emas.

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
    if (oldPriceRaw && oldPrice == null) errors.push("oldPrice");
    const stock = stockRaw ? parseNumber(stockRaw) ?? 0 : 0;
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
