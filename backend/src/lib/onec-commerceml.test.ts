import { describe, expect, it } from "vitest";
import { decodeXml, isCatalogFilename, parseCommerceML } from "./onec-commerceml.js";
import { safeRelPath, issueSessionToken, verifySessionToken, parseBasicAuth, readSessionCookie } from "./onec-exchange.js";

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<КоммерческаяИнформация ВерсияСхемы="2.05" ДатаФормирования="2026-08-04">
  <Классификатор>
    <Ид>cls-1</Ид>
    <Наименование>Классификатор</Наименование>
    <Группы>
      <Группа>
        <Ид>g-kiyim</Ид>
        <Наименование>Kiyim</Наименование>
        <Группы>
          <Группа>
            <Ид>g-futbolka</Ид>
            <Наименование>Futbolkalar</Наименование>
          </Группа>
        </Группы>
      </Группа>
      <Группа>
        <Ид>g-oyoq</Ид>
        <Наименование>Oyoq kiyim</Наименование>
      </Группа>
    </Группы>
  </Классификатор>
  <Каталог СодержитТолькоИзменения="true">
    <Ид>cat-1</Ид>
    <ИдКлассификатора>cls-1</ИдКлассификатора>
    <Товары>
      <Товар>
        <Ид>p-1</Ид>
        <Артикул>ART-001</Артикул>
        <Наименование>Oq futbolka</Наименование>
        <БазоваяЕдиница Код="796" НаименованиеПолное="Штука">шт</БазоваяЕдиница>
        <Группы><Ид>g-futbolka</Ид></Группы>
        <Описание>Paxta 100%</Описание>
        <Картинка>import_files/aa/bb.jpg</Картинка>
        <Картинка>import_files/aa/cc.jpg</Картинка>
        <ЗначенияРеквизитов>
          <ЗначениеРеквизита>
            <Наименование>Страна</Наименование>
            <Значение>Узбекистан</Значение>
          </ЗначениеРеквизита>
        </ЗначенияРеквизитов>
      </Товар>
      <Товар>
        <Ид>p-2</Ид>
        <Наименование>Krossovka</Наименование>
        <Группы><Ид>g-oyoq</Ид></Группы>
        <Статус>Удален</Статус>
      </Товар>
      <Товар>
        <Ид>p-3</Ид>
        <Артикул>007</Артикул>
        <Наименование>Shim</Наименование>
        <ЗначенияРеквизитов>
          <ЗначениеРеквизита>
            <Наименование>ПометкаУдаления</Наименование>
            <Значение>true</Значение>
          </ЗначениеРеквизита>
        </ЗначенияРеквизитов>
      </Товар>
    </Товары>
  </Каталог>
</КоммерческаяИнформация>`;

describe("parseCommerceML", () => {
  const parsed = parseCommerceML(SAMPLE);

  it("schema versiyasi va qisman yuklama bayrog'ini o'qiydi", () => {
    expect(parsed.schemaVersion).toBe("2.05");
    expect(parsed.onlyChanges).toBe(true);
  });

  it("ichma-ich guruhlarni ota-bola bog'lanishi bilan yig'adi", () => {
    expect(parsed.groups).toHaveLength(3);
    const kiyim = parsed.groups.find((g) => g.id === "g-kiyim");
    const futbolka = parsed.groups.find((g) => g.id === "g-futbolka");
    expect(kiyim?.parentId).toBeNull();
    expect(futbolka?.parentId).toBe("g-kiyim");
    // Ota guruh bolasidan oldin kelishi shart — import shu tartibga tayanadi
    expect(parsed.groups.findIndex((g) => g.id === "g-kiyim")).toBeLessThan(
      parsed.groups.findIndex((g) => g.id === "g-futbolka"),
    );
  });

  it("mahsulot maydonlarini to'liq o'qiydi", () => {
    const p = parsed.products.find((x) => x.id === "p-1");
    expect(p).toBeDefined();
    expect(p?.sku).toBe("ART-001");
    expect(p?.name).toBe("Oq futbolka");
    expect(p?.description).toBe("Paxta 100%");
    expect(p?.groupIds).toEqual(["g-futbolka"]);
    expect(p?.images).toEqual(["import_files/aa/bb.jpg", "import_files/aa/cc.jpg"]);
    expect(p?.country).toBe("Узбекистан");
    expect(p?.deleted).toBe(false);
  });

  it("atributli tegni matn qiymati bilan chalkashtirmaydi", () => {
    // <БазоваяЕдиница Код="796">шт</БазоваяЕдиница> nomga ta'sir qilmasligi kerak
    expect(parsed.products.find((x) => x.id === "p-1")?.name).toBe("Oq futbolka");
  });

  it("Artikulni raqamga aylantirib yubormaydi", () => {
    expect(parsed.products.find((x) => x.id === "p-3")?.sku).toBe("007");
  });

  it("o'chirish belgisini ikkala shaklda ham tanidi", () => {
    expect(parsed.products.find((x) => x.id === "p-2")?.deleted).toBe(true);
    expect(parsed.products.find((x) => x.id === "p-3")?.deleted).toBe(true);
  });

  it("takrorlangan Ид'da oxirgisini oladi", () => {
    const dup = parseCommerceML(`<?xml version="1.0" encoding="UTF-8"?>
      <КоммерческаяИнформация>
        <Каталог><Товары>
          <Товар><Ид>x</Ид><Наименование>Birinchi</Наименование></Товар>
          <Товар><Ид>x</Ид><Наименование>Ikkinchi</Наименование></Товар>
        </Товары></Каталог>
      </КоммерческаяИнформация>`);
    expect(dup.products).toHaveLength(1);
    expect(dup.products[0].name).toBe("Ikkinchi");
  });

  it("CommerceML bo'lmagan XML'ni rad etadi", () => {
    expect(() => parseCommerceML("<html><body>404</body></html>")).toThrow();
  });
});

describe("decodeXml", () => {
  it("UTF-8 BOM'ni olib tashlaydi", () => {
    const buf = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from('<?xml version="1.0"?><a>Салом</a>', "utf8"),
    ]);
    expect(decodeXml(buf)).toBe('<?xml version="1.0"?><a>Салом</a>');
  });

  it("windows-1251 prologini hurmat qiladi", () => {
    // "Ток" — cp1251 da 0xD2 0xEE 0xEA
    const xml = Buffer.concat([
      Buffer.from('<?xml version="1.0" encoding="windows-1251"?><a>', "latin1"),
      Buffer.from([0xd2, 0xee, 0xea]),
      Buffer.from("</a>", "latin1"),
    ]);
    expect(decodeXml(xml)).toContain("Ток");
  });
});

describe("isCatalogFilename", () => {
  it("import*.xml ni tanidi, offers.xml ni yo'q", () => {
    expect(isCatalogFilename("import.xml")).toBe(true);
    expect(isCatalogFilename("import___1.xml")).toBe(true);
    expect(isCatalogFilename("webdata/000000001/import.xml")).toBe(true);
    expect(isCatalogFilename("offers.xml")).toBe(false);
    expect(isCatalogFilename("import_files/a/b.jpg")).toBe(false);
  });
});

describe("safeRelPath", () => {
  it("oddiy yo'llarni qabul qiladi", () => {
    expect(safeRelPath("import.xml")).toBe("import.xml");
    expect(safeRelPath("import_files/aa/bb.jpg")).toBe("import_files/aa/bb.jpg");
    expect(safeRelPath("import_files\\aa\\bb.jpg")).toBe("import_files/aa/bb.jpg");
  });

  it("path traversal va absolyut yo'llarni rad etadi", () => {
    expect(safeRelPath("../../etc/passwd")).toBeNull();
    expect(safeRelPath("import_files/../../../etc/passwd")).toBeNull();
    expect(safeRelPath("/etc/passwd")).toBeNull();
    expect(safeRelPath("C:\\Windows\\system32")).toBeNull();
    expect(safeRelPath("")).toBeNull();
    expect(safeRelPath("a\u0000b")).toBeNull();
  });
});

describe("1C exchange sessiyasi", () => {
  const prevJwt = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "test-secret-for-1c-exchange-sessions-0123456789";

  it("imzolangan tokenni o'zi tekshira oladi", () => {
    const token = issueSessionToken("tenant-abc");
    expect(verifySessionToken(token)).toBe("tenant-abc");
  });

  it("buzilgan yoki soxta tokenni rad etadi", () => {
    const token = issueSessionToken("tenant-abc");
    expect(verifySessionToken(token.slice(0, -2) + "ff")).toBeNull();
    expect(verifySessionToken("qalbaki.token")).toBeNull();
    expect(verifySessionToken(undefined)).toBeNull();
    expect(verifySessionToken("")).toBeNull();
  });

  it("cookie sarlavhasidan qiymatni ajratadi", () => {
    expect(readSessionCookie("other=1; shopflow_1c=abc.def; x=2")).toBe("abc.def");
    expect(readSessionCookie("other=1")).toBeNull();
    expect(readSessionCookie(undefined)).toBeNull();
  });

  if (prevJwt !== undefined) process.env.JWT_SECRET = prevJwt;
});

describe("parseBasicAuth", () => {
  it("login va parolni ajratadi", () => {
    const header = "Basic " + Buffer.from("1c_demo:parol123", "utf8").toString("base64");
    expect(parseBasicAuth(header)).toEqual({ login: "1c_demo", password: "parol123" });
  });

  it("parol ichidagi ikki nuqtani saqlaydi", () => {
    const header = "Basic " + Buffer.from("user:a:b:c", "utf8").toString("base64");
    expect(parseBasicAuth(header)?.password).toBe("a:b:c");
  });

  it("Basic bo'lmagan sxemani rad etadi", () => {
    expect(parseBasicAuth("Bearer abc")).toBeNull();
    expect(parseBasicAuth(undefined)).toBeNull();
  });
});
