import { describe, it, expect } from "vitest";
import { slugify } from "./slug.js";
import {
  absoluteUrl,
  localizeContent,
  shapeProduct,
  telegramPhotoUrl,
  type RawProductForShape,
} from "./public-shape.js";

describe("slugify", () => {
  it("o'zbek apostrofli nomni tozalaydi", () => {
    expect(slugify("O'simlik Choyi")).toBe("osimlik-choyi");
  });
  it("kirill nomni transliteratsiya qiladi", () => {
    expect(slugify("Витамин С")).toBe("vitamin-s");
  });
  it("bo'sh natijada '' qaytaradi", () => {
    expect(slugify("!!!")).toBe("");
  });
});

describe("absoluteUrl", () => {
  it("nisbiy yo'lni absolyut HTTPS qiladi", () => {
    expect(absoluteUrl("/uploads/a.jpg")).toBe("https://shop-flow.uz/uploads/a.jpg");
  });
  it("http'ni https'ga aylantiradi", () => {
    expect(absoluteUrl("http://cdn.x/y.png")).toBe("https://cdn.x/y.png");
  });
  it("null → null", () => {
    expect(absoluteUrl(null)).toBeNull();
  });
});

describe("telegramPhotoUrl", () => {
  it("cover imageUrl ni images dan oldin oladi", () => {
    expect(telegramPhotoUrl("/uploads/cover.jpg", ["/uploads/gallery.jpg"])).toBe(
      "https://shop-flow.uz/uploads/cover.jpg",
    );
  });

  it("cover yo'q bo'lsa gallery rasmini oladi", () => {
    expect(telegramPhotoUrl(null, ["", "/uploads/g.jpg"])).toBe("https://shop-flow.uz/uploads/g.jpg");
  });

  it("http'ni https qiladi", () => {
    expect(telegramPhotoUrl("http://cdn.x/a.png")).toBe("https://cdn.x/a.png");
  });

  it("hech narsa bo'lmasa undefined", () => {
    expect(telegramPhotoUrl(null, [], undefined, "")).toBeUndefined();
  });
});

describe("localizeContent", () => {
  it("per-locale obyektdan to'g'ri tilni tanlaydi", () => {
    const content = { uz: { tagline: "Salom" }, ru: { tagline: "Привет" } };
    expect(localizeContent(content, "ru")).toEqual({ tagline: "Привет" });
  });
  it("flat obyektni o'zini qaytaradi", () => {
    const content = { tagline: "Hi" };
    expect(localizeContent(content, "ru")).toEqual({ tagline: "Hi" });
  });
  it("umumiy maydonlarni uz bazasidan boshqa tilga ko'chiradi (admin editor kontrakti)", () => {
    // ProductContentEditor umumiy maydonlarni (servings/bespoke) faqat uz'ga yozadi.
    // ru so'ralganda ular uz bazasidan merge orqali kelishi shart.
    const content = {
      uz: { tagline: "Salom", servings: 30, bespoke: true },
      ru: { tagline: "Привет" },
    };
    expect(localizeContent(content, "ru")).toEqual({ tagline: "Привет", servings: 30, bespoke: true });
  });
  it("faqat ru'da mavjud til bo'lsa ham uz bazasi bo'sh bo'lmasa qaytaradi", () => {
    const content = { uz: { bespoke: true }, ru: { tagline: "Привет" } };
    expect(localizeContent(content, "ru")).toEqual({ tagline: "Привет", bespoke: true });
    expect(localizeContent(content, "uz")).toEqual({ bespoke: true });
  });
});

function rawProduct(overrides: Partial<RawProductForShape> = {}): RawProductForShape {
  const base: RawProductForShape = {
    id: "p1",
    slug: "vitamin-d3",
    name: "Vitamin D3",
    description: "Asosiy tavsif",
    price: 89000,
    oldPrice: 120000,
    currency: "UZS",
    stock: 5,
    imageUrl: "/uploads/d3.jpg",
    images: ["https://cdn.x/d3-2.jpg"],
    origin: "Germaniya",
    content: {
      tagline: "Kunlik quvvat",
      highlights: ["Yuqori sifat", 42],
      benefits: [{ icon: "leaf", title: "Immunitet", description: "Mustahkamlaydi" }, { title: "" }],
      ingredients: [{ name: "D3", amount: "2000 IU", dailyValue: "500%" }],
      faq: [{ question: "Qachon?", answer: "Ertalab" }],
      servings: "30",
      bespoke: true,
    },
    categoryId: "c1",
    category: { id: "c1", slug: "vitaminlar" },
    saleCampaign: { label: "Chegirma", active: true, startsAt: null, endsAt: null },
  };
  return { ...base, ...overrides };
}

describe("shapeProduct", () => {
  it("spec shakliga to'g'ri map qiladi", () => {
    const out = shapeProduct(rawProduct(), { locale: "uz", rating: 4.666, reviewCount: 3 });

    expect(out.id).toBe("p1");
    expect(out.slug).toBe("vitamin-d3");
    expect(out.price).toBe(89000);
    expect(out.oldPrice).toBe(120000);
    expect(out.currency).toBe("UZS");
    expect(out.rating).toBe(4.7); // 1 kasrgacha
    expect(out.reviewCount).toBe(3);
    expect(out.inStock).toBe(true);
    expect(out.tagline).toBe("Kunlik quvvat");
    expect(out.origin).toBe("Germaniya");
    expect(out.bespoke).toBe(true);
    expect(out.servings).toBe(30);
    expect(out.categorySlug).toBe("vitaminlar");

    // Rasmlar absolyut HTTPS + dedup
    expect(out.images).toEqual([
      { url: "https://shop-flow.uz/uploads/d3.jpg", alt: "Vitamin D3" },
      { url: "https://cdn.x/d3-2.jpg", alt: "Vitamin D3" },
    ]);

    // highlights faqat stringlar
    expect(out.highlights).toEqual(["Yuqori sifat"]);
    // benefits — bo'sh title filtrlandi
    expect(out.benefits).toEqual([{ icon: "leaf", title: "Immunitet", description: "Mustahkamlaydi" }]);
    expect(out.ingredients).toEqual([{ name: "D3", amount: "2000 IU", dailyValue: "500%" }]);
    expect(out.faq).toEqual([{ question: "Qachon?", answer: "Ertalab" }]);
    // badge — faol kampaniyadan
    expect(out.badges).toEqual(["Chegirma"]);
    // list rejimida reviews bo'sh
    expect(out.reviews).toEqual([]);
  });

  it("stock 0 → inStock false, oldPrice yo'q bo'lsa omitted", () => {
    const out = shapeProduct(
      rawProduct({ stock: 0, oldPrice: null, content: null, origin: null, saleCampaign: null }),
      { locale: "uz", rating: 0, reviewCount: 0 },
    );
    expect(out.inStock).toBe(false);
    expect(out.oldPrice).toBeUndefined();
    expect(out.badges).toEqual([]);
    expect(out.tagline).toBe("");
    expect(out.bespoke).toBe(false);
    // content yo'q → description Product.description'ga fallback
    expect(out.description).toBe("Asosiy tavsif");
  });
});
