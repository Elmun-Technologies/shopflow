# ShopFlow Public API (v1)

Tashqi mijoz websaytlari uchun **read-mostly** katalog + buyurtma API'si.
Mini App'ning ichki `/api/storefront/*` endpointlaridan **alohida** — bu barqaror,
versiyalangan, API-kalit bilan himoyalangan kontrakt.

---

## Umumiy qoidalar

| | |
|---|---|
| **Base URL** | `https://shop-flow.uz/api/v1` (yoki `SHOPFLOW_API_URL`) |
| **Auth** | Har so'rovda `Authorization: Bearer <SHOPFLOW_API_KEY>` |
| **Til** | GET'larda `?locale=uz\|ru\|en`. Matn **bitta string** bo'lib qaytadi (ko'p tilli obyekt emas). Default: `uz` |
| **Pul** | Butun son, so'mda (UZS), kasrsiz. `currency` doim string (`"UZS"`) |
| **slug** | Barqaror (URL/SEO shunga bog'liq). Rasm URL'lari absolyut HTTPS |
| **Keshlash** | GET'lar `Cache-Control: public, max-age=300`. `POST /orders` keshlanmaydi |

> **API kalit qayerdan?** Admin panel → **Sozlamalar → API** tab'dan yarating,
> yoki server'da:
> ```bash
> cd backend && npm run create-api-key -- <tenant-slug> "Website API"
> ```
> Kalit (`sf_...`) **faqat bir marta** ko'rsatiladi — saqlang.

Xato javoblari: `4xx/5xx` + `{ "error": "..." }` (POST /orders'da `{ "ok": false, "message": "..." }`).
Auth yo'q/yaroqsiz → `401`. Topilmadi → `404`.

---

## 1. `GET /categories` → `Category[]`

Kategoriyalar ro'yxati.

```ts
interface Category {
  id: string;
  slug: string;
  name: string;
  description?: string;
  image?: string;        // absolyut HTTPS
  productCount?: number; // faol mahsulotlar soni
}
```

```bash
curl -H "Authorization: Bearer $SHOPFLOW_API_KEY" \
  "$SHOPFLOW_API_URL/categories?locale=uz"
```

---

## 2. `GET /products` → `{ items: Product[]; total; page; pageSize }`

Ro'yxat + qidiruv + filtr. `total` — filtrlardan keyingi, **sahifalashdan oldingi** umumiy son.

| Param | Izoh |
|---|---|
| `locale` | `uz\|ru\|en` |
| `category` | kategoriya **slug**'i |
| `search` | nom bo'yicha qidiruv |
| `origin` | ishlab chiqarilgan davlat |
| `minPrice`, `maxPrice` | narx oralig'i (so'm) |
| `sort` | `popular` (default) \| `price_asc` \| `price_desc` \| `new` |
| `page`, `pageSize` | default `1` / `20`, max `pageSize` `100` |

```bash
curl -H "Authorization: Bearer $SHOPFLOW_API_KEY" \
  "$SHOPFLOW_API_URL/products?locale=uz&category=vitaminlar&sort=price_asc&page=1&pageSize=20"
```

> Ro'yxatda har element to'liq `Product` shaklida, lekin `reviews: []` (bo'sh) —
> sharhlar faqat bitta mahsulot endpointida to'ladi.

---

## 3. `GET /products/{slug}` → `Product` (topilmasa `404`)

To'liq mahsulot. `{slug}` o'rniga `id` ham qabul qilinadi (fallback).

```ts
interface Product {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  categoryId: string | null;
  categorySlug: string | null;
  price: number;
  oldPrice?: number;
  currency: string;
  rating: number;       // 0..5 (1 kasrgacha)
  reviewCount: number;
  inStock: boolean;
  images: { url: string; alt: string }[];
  highlights: string[];
  benefits: { icon?: string; title: string; description: string }[];
  ingredients: { name: string; amount: string; dailyValue?: string }[];
  howToUse: string;
  faq: { question: string; answer: string }[];
  reviews: { author: string; rating: number; date: string; text: string }[];
  badges: string[];     // faol aksiya yorlig'i (masalan "Chegirma")
  servings?: number;
  origin?: string;
  bespoke: boolean;
}
```

```bash
curl -H "Authorization: Bearer $SHOPFLOW_API_KEY" \
  "$SHOPFLOW_API_URL/products/vitamin-d3?locale=uz"
```

> **Boy maydonlar** (`tagline`, `highlights`, `benefits`, `ingredients`, `howToUse`,
> `faq`, `servings`, `bespoke`) ShopFlow'da har mahsulotning `content` (JSON) maydonida
> saqlanadi. To'ldirilmagan bo'lsa — bo'sh array / `""` / `false` qaytadi. `rating`,
> `reviewCount`, `inStock`, `images`, `badges` — mavjud ma'lumotdan hisoblanadi.

---

## 4. `GET /products/{productId}/upsells` → `UpsellOffer[]`

Cross-sell ("birga olishadi"). Yo'lda **`id`** (slug emas).

```ts
interface UpsellOffer {
  product: Product;
  discountPercent: number; // 0..100
  reason: string;          // localized
}
```

> Manba: admin paneldagi **combo / add-on** bog'lanishlari (ProductAddon).

---

## 5. `GET /promotions` → `Promotion[]`

Savatcha darajasidagi aksiyalar.

```ts
interface Promotion {
  id: string;
  type: "free_shipping_over" | "percent_off" | "buy_x_get_y";
  title: string;
  description: string;
  threshold?: number; // free_shipping_over uchun
  percent?: number;   // percent_off uchun
}
```

> Hozircha `free_shipping_over` qo'llab-quvvatlanadi — yetkazib berish usullaridagi
> "bepul yetkazish chegarasi" (`freeAbove`) dan hosil bo'ladi. `percent_off` /
> `buy_x_get_y` kelajakdagi "do'kon aksiyalari" moduli bilan to'ldiriladi.

---

## 6. `POST /orders` → `{ ok; orderId?; message? }`

Zayavka (buyurtma). Keshlanmaydi. **Narxlar server tomonda qayta hisoblanadi** —
`totals` faqat `shipping` uchun maslahat sifatida ishlatiladi (xavfsizlik).

```ts
interface OrderRequest {
  customer: { name: string; phone: string };
  delivery: {
    region?: string;
    address?: string;
    note?: string;
    method: "courier" | "pickup"; // pickup → yetkazish bepul
  };
  items: { productId?: string; slug?: string; name?: string; quantity: number; unitPrice?: number }[];
  appliedUpsells?: string[];     // productId'lar — combo chegirmasi qo'llanadi
  appliedPromotions?: string[];  // promotion id'lar (masalan "free-shipping")
  totals?: { subtotal?: number; discount?: number; shipping?: number; total?: number };
  locale?: string;
  attribution?: {                // reklama atributsiyasi (operator izohiga yoziladi)
    utmSource?: string; utmMedium?: string; utmCampaign?: string;
    landing?: string; referrer?: string;
  };
}
```

```bash
curl -X POST -H "Authorization: Bearer $SHOPFLOW_API_KEY" -H "Content-Type: application/json" \
  "$SHOPFLOW_API_URL/orders" -d '{
    "customer": { "name": "Ali", "phone": "+998901234567" },
    "delivery": { "region": "Toshkent", "address": "Chilonzor 5", "method": "courier" },
    "items": [{ "productId": "ckxx...", "quantity": 2 }],
    "attribution": { "utmSource": "google", "utmCampaign": "spring" }
  }'
```

Buyurtma `PENDING` holatda yaratiladi, admin panelda real-time ko'rinadi (SSE + web push),
WEBSITE kanaliga bog'lanadi, stock atomik kamayadi, `order.created` outbound webhook
otiladi. Javob: `{ "ok": true, "orderId": "...", "message": "Buyurtma #ORD-7524 qabul qilindi" }`.

---

## Cheklovlar / kelajak

- **Rate limit**: kalit emas, IP bo'yicha (300/daqiqa). SSR/proxy server-to-server chaqiriqlar
  uchun yetarli; GET'lar 300s keshlanadi.
- **Lokalizatsiya**: `name`/`description` merchant kiritgan bitta tilda; `content` JSON
  per-locale (`{uz,ru,en}`) bo'lsa, tanlangan til olinadi.
- **Boy kontent admin UI** — alohida ish; hozircha `content` DB/seed orqali to'ldiriladi.
