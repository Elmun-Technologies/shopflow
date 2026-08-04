// CommerceML 2.x (`import.xml`) parseri — 1C «Обмен с сайтом» moduli
// jo'natadigan katalog faylini o'qiydi.
//
// Hujjat tuzilmasi (soddalashtirilgan):
//   <КоммерческаяИнформация ВерсияСхемы="2.05">
//     <Классификатор>
//       <Группы><Группа><Ид/><Наименование/><Группы>…ichma-ich…</Группы></Группа></Группы>
//     </Классификатор>
//     <Каталог СодержитТолькоИзменения="true">
//       <Товары><Товар>
//         <Ид/><Артикул/><Наименование/><Описание/>
//         <Группы><Ид/></Группы>
//         <Картинка/>…
//       </Товар></Товары>
//     </Каталог>
//   </КоммерческаяИнформация>
//
// Teglar har doim rus tilida — bu protokol qismi, tarjima qilinmaydi.
// 1C versiyalari orasida farqlar bor (masalan o'chirish belgisi `Статус`,
// `ПометкаУдаления` yoki `ЗначенияРеквизитов` ichida bo'lishi mumkin), shuning
// uchun parser har uchala variantni ham tekshiradi.

import { XMLParser } from "fast-xml-parser";

export interface OneCGroup {
  /** Группа/Ид — 1C GUID */
  id: string;
  name: string;
  /** Ota guruh Ид yoki null (ildiz) */
  parentId: string | null;
}

export interface OneCProduct {
  /** Товар/Ид — GUID, xarakteristikali tovarlarda "guid#guid" */
  id: string;
  /** Артикул — bizdagi sku */
  sku: string | null;
  name: string;
  description: string | null;
  /** Товар/Группы/Ид ro'yxati (odatda bitta) */
  groupIds: string[];
  /** Картинка — arxiv ichidagi nisbiy yo'l ("import_files/aa/bb.jpg") */
  images: string[];
  /** Ishlab chiqarilgan davlat — Product.origin ga tushadi */
  country: string | null;
  /** 1C'da o'chirilgan/pomechen — biz active=false qilamiz */
  deleted: boolean;
}

export interface ParsedCatalog {
  schemaVersion: string | null;
  /** Каталог@СодержитТолькоИзменения — true bo'lsa bu to'liq katalog emas */
  onlyChanges: boolean;
  groups: OneCGroup[];
  products: OneCProduct[];
}

/** `import.xml` ko'rinishidagi katalog faylimi (offers.xml emas)? */
export function isCatalogFilename(filename: string): boolean {
  const base = filename.split("/").pop() ?? filename;
  return /^import/i.test(base) && /\.xml$/i.test(base);
}

/** 1C ba'zan windows-1251 jo'natadi — XML prologidan kodlashni aniqlaymiz. */
export function decodeXml(buf: Buffer): string {
  // BOM (UTF-8) — bo'lsa darhol utf-8
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.subarray(3).toString("utf8");
  }
  const head = buf.subarray(0, 200).toString("latin1");
  const m = /encoding\s*=\s*["']([\w-]+)["']/i.exec(head);
  const enc = m?.[1]?.toLowerCase() ?? "utf-8";
  if (enc === "utf-8" || enc === "utf8") return buf.toString("utf8");
  try {
    return new TextDecoder(enc).decode(buf);
  } catch {
    // Noma'lum kodlash — utf-8 ga qaytamiz (buzilgan belgilar bo'lishi mumkin,
    // lekin butun import to'xtab qolgandan yaxshiroq).
    return buf.toString("utf8");
  }
}

type XmlNode = Record<string, unknown>;

function asArray(value: unknown): XmlNode[] {
  if (value == null) return [];
  return (Array.isArray(value) ? value : [value]).filter(
    (v): v is XmlNode => typeof v === "object" && v !== null,
  );
}

/**
 * Tegning matn qiymati. fast-xml-parser atributli tegni obyekt qilib beradi
 * (`{ "#text": "шт", "@_Код": "796" }`), atributsizini — oddiy string.
 */
function textOf(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const t = value.trim();
    return t === "" ? null : t;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    const text = (value as XmlNode)["#text"];
    if (text != null) return textOf(text);
  }
  return null;
}

/** Bir nechta bo'lishi mumkin bo'lgan tegning barcha matn qiymatlari. */
function textsOf(value: unknown): string[] {
  if (value == null) return [];
  const list = Array.isArray(value) ? value : [value];
  return list.map(textOf).filter((v): v is string => v !== null);
}

function isTruthyRu(value: string | null): boolean {
  if (!value) return false;
  return /^(true|1|да|yes)$/i.test(value.trim());
}

/** Реквизитлар ро'йхатини `{ nom: qiymat }` ga aylantiradi. */
function requisites(tovar: XmlNode): Record<string, string> {
  const out: Record<string, string> = {};
  const container = tovar["ЗначенияРеквизитов"];
  for (const node of asArray(container)) {
    for (const rec of asArray(node["ЗначениеРеквизита"])) {
      const name = textOf(rec["Наименование"]);
      const value = textOf(rec["Значение"]);
      if (name && value) out[name.toLowerCase()] = value;
    }
  }
  return out;
}

function collectGroups(container: unknown, parentId: string | null, out: OneCGroup[]): void {
  for (const wrapper of asArray(container)) {
    for (const group of asArray(wrapper["Группа"])) {
      const id = textOf(group["Ид"]);
      const name = textOf(group["Наименование"]);
      if (!id) continue;
      out.push({ id, name: name ?? id, parentId });
      // Ichma-ich guruhlar
      collectGroups(group["Группы"], id, out);
    }
  }
}

function parseProduct(tovar: XmlNode): OneCProduct | null {
  const id = textOf(tovar["Ид"]);
  if (!id) return null;

  const reqs = requisites(tovar);
  const status = textOf(tovar["Статус"]);
  const deleted =
    (status != null && /удал/i.test(status)) ||
    isTruthyRu(textOf(tovar["ПометкаУдаления"])) ||
    isTruthyRu(reqs["пометкаудаления"] ?? null) ||
    isTruthyRu(reqs["удален"] ?? null);

  // Guruh havolalari: <Группы><Ид>guid</Ид></Группы>
  const groupIds: string[] = [];
  for (const g of asArray(tovar["Группы"])) {
    groupIds.push(...textsOf(g["Ид"]));
  }

  // Rasmlar: <Картинка> (ba'zi konfiguratsiyalarda <Изображение>)
  const images = [...textsOf(tovar["Картинка"]), ...textsOf(tovar["Изображение"])];

  const manufacturer = asArray(tovar["Изготовитель"])[0];
  const country =
    textOf(tovar["Страна"]) ??
    reqs["страна"] ??
    reqs["страна происхождения"] ??
    (manufacturer ? textOf(manufacturer["Наименование"]) : null) ??
    null;

  return {
    id,
    sku: textOf(tovar["Артикул"]),
    name: textOf(tovar["Наименование"]) ?? id,
    description: textOf(tovar["Описание"]) ?? reqs["полное наименование"] ?? null,
    groupIds,
    images,
    country,
    deleted,
  };
}

/**
 * CommerceML hujjatini parse qiladi. XML noto'g'ri bo'lsa yoki ildiz tegi
 * `КоммерческаяИнформация` bo'lmasa xato tashlaydi.
 */
export function parseCommerceML(xml: string): ParsedCatalog {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    // Qiymatlarni string sifatida qoldiramiz — Артикул "007" bo'lsa 7 ga
    // aylanib ketmasligi uchun.
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: true,
  });

  let doc: XmlNode;
  try {
    doc = parser.parse(xml) as XmlNode;
  } catch (err) {
    throw new Error(`XML parse xatosi: ${err instanceof Error ? err.message : String(err)}`);
  }

  const root = doc["КоммерческаяИнформация"];
  if (root == null) {
    throw new Error("KommercheskayaInformatsiya ildiz tegi topilmadi — CommerceML fayli emas");
  }
  const roots = asArray(root);

  const groups: OneCGroup[] = [];
  const products: OneCProduct[] = [];
  let schemaVersion: string | null = null;
  let onlyChanges = false;

  for (const node of roots) {
    schemaVersion ??= textOf(node["@_ВерсияСхемы"]);

    for (const classifier of asArray(node["Классификатор"])) {
      collectGroups(classifier["Группы"], null, groups);
    }

    for (const catalog of asArray(node["Каталог"])) {
      if (isTruthyRu(textOf(catalog["@_СодержитТолькоИзменения"]))) onlyChanges = true;
      for (const tovary of asArray(catalog["Товары"])) {
        for (const tovar of asArray(tovary["Товар"])) {
          const parsed = parseProduct(tovar);
          if (parsed) products.push(parsed);
        }
      }
    }
  }

  // Bir xil Ид ikki marta kelsa oxirgisi yutadi (1C bo'laklab yuborishi mumkin).
  const byId = new Map<string, OneCProduct>();
  for (const p of products) byId.set(p.id, p);

  const groupById = new Map<string, OneCGroup>();
  for (const g of groups) groupById.set(g.id, g);

  return {
    schemaVersion,
    onlyChanges,
    groups: [...groupById.values()],
    products: [...byId.values()],
  };
}
