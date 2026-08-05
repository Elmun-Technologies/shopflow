import { describe, it, expect } from "vitest";
import {
  buildVariantLabel,
  defaultVariant,
  parseOptions,
  productPricing,
  purchasableVariants,
  toVariantLike,
  validateVariants,
  variantImages,
  visibleVariants,
  type ProductOption,
  type VariantLike,
} from "./variant-shape.js";

function variant(over: Partial<VariantLike> & { id: string; price: number }): VariantLike {
  return {
    sku: `SKU-${over.id}`,
    name: over.id,
    optionValues: {},
    oldPrice: null,
    stock: 10,
    active: true,
    images: [],
    attributes: [],
    sortOrder: 0,
    ...over,
  };
}

const OPTIONS: ProductOption[] = [
  {
    id: "hajm",
    name: { uz: "Hajm", ru: "Объём" },
    values: [
      { id: "50g", label: { uz: "50 gr", ru: "50 гр" } },
      { id: "1kg", label: { uz: "1 kg", ru: "1 кг" } },
      { id: "5kg", label: { uz: "5 kg", ru: "5 кг" } },
    ],
  },
];

describe("defaultVariant — PDP ochilganda nima tanlanadi", () => {
  it("eng arzonini tanlaydi", () => {
    const v = defaultVariant([
      variant({ id: "b", price: 50_000 }),
      variant({ id: "a", price: 12_000 }),
      variant({ id: "c", price: 200_000 }),
    ]);
    expect(v?.id).toBe("a");
  });

  it("zaxirasi tugagan arzonni o'tkazib yuboradi", () => {
    const v = defaultVariant([
      variant({ id: "arzon", price: 10_000, stock: 0 }),
      variant({ id: "keyingi", price: 30_000, stock: 5 }),
    ]);
    expect(v?.id).toBe("keyingi");
  });

  it("hammasi tugagan bo'lsa baribir eng arzonini ko'rsatadi", () => {
    const v = defaultVariant([
      variant({ id: "arzon", price: 10_000, stock: 0 }),
      variant({ id: "qimmat", price: 30_000, stock: 0 }),
    ]);
    expect(v?.id).toBe("arzon");
  });

  it("o'chirilgan variantni tanlamaydi", () => {
    const v = defaultVariant([
      variant({ id: "yashirin", price: 1_000, active: false }),
      variant({ id: "koringan", price: 9_000 }),
    ]);
    expect(v?.id).toBe("koringan");
  });

  it("aktiv variant bo'lmasa null", () => {
    expect(defaultVariant([variant({ id: "x", price: 1, active: false })])).toBeNull();
    expect(defaultVariant([])).toBeNull();
  });
});

describe("visibleVariants tartibi", () => {
  it("sortOrder bo'yicha, teng bo'lsa narx bo'yicha", () => {
    const list = visibleVariants([
      variant({ id: "c", price: 5, sortOrder: 2 }),
      variant({ id: "b", price: 9, sortOrder: 1 }),
      variant({ id: "a", price: 3, sortOrder: 1 }),
    ]);
    expect(list.map((v) => v.id)).toEqual(["a", "b", "c"]);
  });

  it("o'chirilganlarni chiqarib tashlaydi", () => {
    const list = visibleVariants([variant({ id: "a", price: 1 }), variant({ id: "b", price: 2, active: false })]);
    expect(list.map((v) => v.id)).toEqual(["a"]);
  });
});

describe("purchasableVariants", () => {
  it("faqat aktiv va zaxirada borlari", () => {
    const list = purchasableVariants([
      variant({ id: "ok", price: 1 }),
      variant({ id: "tugagan", price: 1, stock: 0 }),
      variant({ id: "yashirin", price: 1, active: false }),
    ]);
    expect(list.map((v) => v.id)).toEqual(["ok"]);
  });
});

describe("productPricing — karta narxi va zaxirasi", () => {
  const product = { price: 99_000, oldPrice: 120_000, stock: 7 };

  it("variantsiz mahsulot avvalgidek ishlaydi", () => {
    const p = productPricing(product, []);
    expect(p).toEqual({
      price: 99_000,
      oldPrice: 120_000,
      stock: 7,
      priceVaries: false,
      maxPrice: 99_000,
      variantCount: 0,
    });
  });

  it("variant bo'lsa narx eng arzon sotib olinadigandan", () => {
    const p = productPricing(product, [
      variant({ id: "1kg", price: 45_000, stock: 3 }),
      variant({ id: "5kg", price: 180_000, stock: 2 }),
    ]);
    expect(p.price).toBe(45_000);
    expect(p.variantCount).toBe(2);
  });

  it("zaxira variantlar yig'indisi", () => {
    const p = productPricing(product, [
      variant({ id: "a", price: 10, stock: 3 }),
      variant({ id: "b", price: 20, stock: 4 }),
    ]);
    expect(p.stock).toBe(7);
  });

  it("manfiy zaxira yig'indini pasaytirmaydi", () => {
    const p = productPricing(product, [
      variant({ id: "a", price: 10, stock: 5 }),
      variant({ id: "b", price: 20, stock: -3 }),
    ]);
    expect(p.stock).toBe(5);
  });

  it("narxlar turlicha bo'lsa priceVaries", () => {
    expect(productPricing(product, [variant({ id: "a", price: 10 }), variant({ id: "b", price: 20 })]).priceVaries).toBe(true);
    expect(productPricing(product, [variant({ id: "a", price: 10 }), variant({ id: "b", price: 10 })]).priceVaries).toBe(false);
  });

  it("o'chirilgan variantlar narx diapazoniga kirmaydi", () => {
    const p = productPricing(product, [
      variant({ id: "a", price: 10 }),
      variant({ id: "yashirin", price: 999, active: false }),
    ]);
    expect(p.maxPrice).toBe(10);
    expect(p.priceVaries).toBe(false);
  });

  it("hamma variant o'chirilgan bo'lsa mahsulotning o'z narxiga qaytadi", () => {
    const p = productPricing(product, [variant({ id: "a", price: 10, active: false })]);
    expect(p.price).toBe(99_000);
    expect(p.variantCount).toBe(0);
  });

  it("zaxirasi tugagan arzon variant kartada narx bo'lib turmaydi", () => {
    const p = productPricing(product, [
      variant({ id: "tugagan", price: 5_000, stock: 0 }),
      variant({ id: "bor", price: 40_000, stock: 2 }),
    ]);
    expect(p.price).toBe(40_000);
  });
});

describe("variantImages", () => {
  const product = { price: 0, stock: 0, imageUrl: "main.jpg", images: ["a.jpg", "b.jpg"] };

  it("variantning o'z rasmlari ustun", () => {
    expect(variantImages(product, variant({ id: "v", price: 1, images: ["v1.jpg"] }))).toEqual(["v1.jpg"]);
  });

  it("variant rasmsiz bo'lsa mahsulotnikiga tushadi", () => {
    expect(variantImages(product, variant({ id: "v", price: 1 }))).toEqual(["main.jpg", "a.jpg", "b.jpg"]);
  });

  it("takroriy rasmlarni tashlaydi", () => {
    const p = { price: 0, stock: 0, imageUrl: "a.jpg", images: ["a.jpg", "b.jpg"] };
    expect(variantImages(p, null)).toEqual(["a.jpg", "b.jpg"]);
  });
});

describe("buildVariantLabel", () => {
  it("o'q qiymatlaridan nom yig'adi", () => {
    expect(buildVariantLabel(OPTIONS, { hajm: "1kg" })).toBe("1 kg");
  });

  it("tilni hisobga oladi", () => {
    expect(buildVariantLabel(OPTIONS, { hajm: "1kg" }, "ru")).toBe("1 кг");
  });

  it("bir nechta o'qni ' / ' bilan qo'shadi", () => {
    const opts: ProductOption[] = [
      ...OPTIONS,
      { id: "rang", name: { uz: "Rang", ru: "Цвет" }, values: [{ id: "qora", label: { uz: "Qora", ru: "Чёрный" } }] },
    ];
    expect(buildVariantLabel(opts, { hajm: "5kg", rang: "qora" })).toBe("5 kg / Qora");
  });

  it("noma'lum qiymatni o'tkazib yuboradi", () => {
    expect(buildVariantLabel(OPTIONS, { hajm: "yoq" })).toBe("");
  });
});

describe("validateVariants", () => {
  const ok = [
    { sku: "A-50", name: "50 gr", optionValues: { hajm: "50g" } },
    { sku: "A-1", name: "1 kg", optionValues: { hajm: "1kg" } },
  ];

  it("to'g'ri variantlarda xato yo'q", () => {
    expect(validateVariants(OPTIONS, ok)).toEqual([]);
  });

  it("variantsiz mahsulot tekshirilmaydi", () => {
    expect(validateVariants([], [])).toEqual([]);
  });

  it("o'qsiz variant xato", () => {
    expect(validateVariants([], ok).join()).toContain("o'q");
  });

  it("takroriy artikulni topadi", () => {
    const dup = [ok[0], { ...ok[1], sku: "a-50" }];
    expect(validateVariants(OPTIONS, dup).join()).toContain("Artikul takrorlangan");
  });

  it("artikulsiz variantni topadi", () => {
    expect(validateVariants(OPTIONS, [{ sku: "  ", name: "x", optionValues: { hajm: "50g" } }]).join()).toContain("artikul");
  });

  it("tanlanmagan o'qni topadi", () => {
    expect(validateVariants(OPTIONS, [{ sku: "A", name: "x", optionValues: {} }]).join()).toContain("tanlanmagan");
  });

  it("noma'lum qiymatni topadi", () => {
    expect(validateVariants(OPTIONS, [{ sku: "A", name: "x", optionValues: { hajm: "100kg" } }]).join()).toContain("noma'lum");
  });

  it("bir xil kombinatsiyani topadi", () => {
    const dup = [
      { sku: "A", name: "x", optionValues: { hajm: "1kg" } },
      { sku: "B", name: "y", optionValues: { hajm: "1kg" } },
    ];
    expect(validateVariants(OPTIONS, dup).join()).toContain("Bir xil kombinatsiya");
  });
});

describe("parseOptions", () => {
  it("to'g'ri JSON'ni o'qiydi", () => {
    expect(parseOptions(OPTIONS)).toHaveLength(1);
  });

  it("buzuq JSON'da bo'sh massiv (bot/PDP o'lmasin)", () => {
    expect(parseOptions({ nonsense: true })).toEqual([]);
    expect(parseOptions(null)).toEqual([]);
    expect(parseOptions([{ id: "x" }])).toEqual([]);
  });

  it("3 tadan ko'p o'q rad etiladi", () => {
    const four = [1, 2, 3, 4].map((i) => ({
      id: `o${i}`,
      name: { uz: `O${i}`, ru: `O${i}` },
      values: [{ id: "v", label: { uz: "v", ru: "v" } }],
    }));
    expect(parseOptions(four)).toEqual([]);
  });
});

describe("toVariantLike", () => {
  it("Decimal va Json'ni runtime shaklga aylantiradi", () => {
    const v = toVariantLike({
      id: "v1",
      sku: "A-1",
      name: "1 kg",
      optionValues: { hajm: "1kg" },
      price: "45000.00",
      oldPrice: "60000.00",
      stock: 3,
      active: true,
      images: ["a.jpg"],
      attributes: [{ label: { uz: "Og'irlik", ru: "Вес" }, value: { uz: "1 kg", ru: "1 кг" } }],
      sortOrder: 1,
    });
    expect(v.price).toBe(45_000);
    expect(v.oldPrice).toBe(60_000);
    expect(v.attributes).toHaveLength(1);
  });

  it("null oldPrice null bo'lib qoladi", () => {
    const v = toVariantLike({
      id: "v", sku: "s", name: "n", optionValues: {}, price: "1", oldPrice: null,
      stock: 0, active: true, images: [], attributes: [], sortOrder: 0,
    });
    expect(v.oldPrice).toBeNull();
  });

  it("buzuq attributes bo'sh massivga aylanadi", () => {
    const v = toVariantLike({
      id: "v", sku: "s", name: "n", optionValues: {}, price: "1", oldPrice: null,
      stock: 0, active: true, images: [], attributes: "buzuq", sortOrder: 0,
    });
    expect(v.attributes).toEqual([]);
  });
});
