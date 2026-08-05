# Mahsulot variantlari

Bitta mahsulot kartasi, ichida bir nechta o'lcham/rang — Uzum, Wildberries va
Ozon'dagi mantiqning o'zi.

**Ixtiyoriy.** Varianti yo'q mahsulot avvalgidek `Product.price` / `Product.stock`
bilan ishlaydi. Hech qanday migratsiya yoki backfill yo'q.

Admin: **Mahsulotlar → mahsulotni tahrirlash → «Variantlar (o'lcham, rang…)»**

---

## Mijoz nima ko'radi

| Joy | Xatti-harakat |
|---|---|
| Katalog kartasi | **Eng arzon sotib olinadigan** variant narxi. Narxlar turlicha bo'lsa — «dan 45 000 so'm» + «5 variant» |
| Mahsulot sahifasi (PDP) | Ochilganda eng arzon, **zaxirada bor** variant tanlangan |
| Variant tanlanganda | Narx, eski narx, rasm galereyasi va xarakteristika almashadi |
| Zaxirasi tugagan variant | Ko'rinadi, lekin xiralashgan — mijoz nima borligini biladi |
| Savat | Har variant alohida qator: «Aromatizator · 1 kg» |

---

## Ma'lumot modeli

```
Product
 ├── options  Json  — o'qlar: [{ id, name:{uz,ru}, values:[{ id, label:{uz,ru} }] }]  (max 3)
 └── variants ProductVariant[]
              ├── sku            (tenant ichida unique)
              ├── name           "1 kg" — bo'sh bo'lsa o'q qiymatlaridan yig'iladi
              ├── optionValues   { "hajm": "1kg", "rang": "qora" }
              ├── price / oldPrice / stock / active
              ├── images[]       bo'sh bo'lsa mahsulot rasmlari
              ├── attributes     [{ label:{uz,ru}, value:{uz,ru} }]
              └── sortOrder

OrderItem
 ├── variantId     → ProductVariant (SetNull)
 └── variantLabel  "1 kg" — snapshot, variant o'chirilsa ham chekda qoladi
```

### Narx va zaxira qoidasi

Yagona manba: **`backend/src/lib/variant-shape.ts`**. Storefront, admin, Public
API va bot shu funksiyalarni ishlatadi — aks holda kartada bir narx, PDP'da
boshqa narx ko'rinib qoladi.

| Holat | Karta narxi | Zaxira |
|---|---|---|
| Variant yo'q | `Product.price` | `Product.stock` |
| Variant bor | eng arzon **sotib olinadigan** variant | aktiv variantlar yig'indisi |
| Hammasi tugagan | eng arzon variant (narx baribir ko'rinsin) | 0 |

`defaultVariant()` — PDP ochilganda tanlanadigan variant. Zaxirasi tugagan
eng arzonni **o'tkazib yuboradi**: mijoz ko'rgan narxni haqiqatda sotib ololsin.

---

## Zaxira — qayerdan yechiladi

Variantli mahsulotda zaxira **variantda** turadi, `Product.stock` tegilmaydi.
Uchala buyurtma yo'li ham shunga amal qiladi:

| Yo'l | Fayl |
|---|---|
| Mini App checkout | `routes/storefront.ts` |
| Admin qo'lda buyurtma | `routes/orders.ts` |
| Public API v1 | `routes/public-api.ts` |

Hammasi `updateMany … where stock >= qty` atomik shartidan foydalanadi —
bir vaqtda kelgan ikki buyurtma oversell qilmaydi.

**Bekor qilish/qaytarish** ham variantga qaytaradi (`restoreStock`). Buni
o'tkazib yuborilsa zaxira noto'g'ri joyga tushib, hisob buzilardi.

---

## Public API v1

`Product` javobiga ikkita maydon qo'shildi (mavjud maydonlar o'zgarmadi):

```jsonc
{
  "price": 45000,        // eng arzon sotib olinadigan variant
  "inStock": true,       // istalgan variantda tovar bormi
  "options": [
    { "id": "hajm", "name": "Hajm", "values": [{ "id": "1kg", "label": "1 kg" }] }
  ],
  "variants": [
    {
      "id": "…", "sku": "AR-1KG", "name": "1 kg",
      "options": { "hajm": "1kg" },
      "price": 45000, "inStock": true,
      "images": [{ "url": "https://…", "alt": "…" }],
      "attributes": [{ "label": "Og'irlik", "value": "1 kg" }]
    }
  ]
}
```

**Buyurtma berishda:** variantli mahsulotda `items[].variantId` **majburiy**.
Yuborilmasa 400 qaytadi va javobda mavjud variantlar ro'yxati keladi:

```json
{ "ok": false, "message": "… variantli mahsulot — item'da variantId bo'lishi shart",
  "variants": [{ "id": "…", "name": "1 kg" }] }
```

Variantsiz mahsulotlar uchun kontrakt **o'zgarmagan** — mavjud integratsiyalar
ishlashda davom etadi.

---

## 1C «Характеристика»

1C xarakteristikali tovarni `Ид = "guid#guid"` bilan yuboradi (chapda asosiy
tovar, o'ngda xarakteristika). Ilgari ular **alohida mahsulot** bo'lib tushardi
— katalog dublikatlarga to'lardi.

Endi ular variant bo'lib import qilinadi:

- asosiy tovar `oneCId = baseGuid` bo'yicha topiladi; hali kelmagan bo'lsa
  shu yerda yaratiladi (1C tartibi kafolatlanmaydi va import 300 tadan
  bo'laklanadi), keyin haqiqiy kartochka kelganda yangilanadi;
- variant nomi «Tovar (1 kg)» dan «1 kg» ga qisqartiriladi;
- mahsulotga bitta umumiy o'q qo'shiladi — «Характеристика» (1C strukturalangan
  o'q yubormaydi);
- narx/qoldiq avvalgidek kelmaydi (`offers.xml` qo'llanmaydi) — operator
  belgilaydi.

Import jurnalida alohida hisoblanadi: `variantsCreated` / `variantsUpdated`.

---

## Admin muharriri

1. **O'q qo'shish** — «Hajm». Qiymatlarni vergul bilan kiritasiz:
   `50 gr, 1 kg, 5 kg, 10 kg, 25 kg`
2. **«N ta yetishmayotgan variantni yaratish»** — barcha kombinatsiyalarni
   bir bosishda yaratadi (mavjudlariga tegmaydi)
3. Har bir variantni ochib narx, zaxira, rasm va xarakteristikasini kiritasiz

Muharrir yuqorisida xulosa turadi: kartada qaysi narx ko'rinishi va PDP
ochilganda qaysi variant tanlanishi — saqlashdan oldin ko'rasiz.

**Tekshiruv** ikki qavatli: admin panelda jonli, backend'da esa `PUT /products`
takroriy artikul, bir xil kombinatsiya yoki tanlanmagan o'qni 400 bilan rad
etadi — buzuq variant DB'ga tushmaydi.

---

## Nimaga tegilmagan (ataylab)

- **Variantlarni tahrirlashda o'chirib-qayta yaratish yo'q** — `id` bo'yicha
  upsert qilinadi, aks holda `OrderItem.variantId` uzilib, buyurtma tarixi
  variantdan ajralib qolardi.
- **MoySklad / Sales Doctor** sinxronizatsiyasi hozircha mahsulot darajasida
  qoladi. Ustunlar (`ProductVariant.moyskladId`, `salesDoctorId`) tayyor,
  lekin mapping keyingi ishda — har provayder o'z qarorini talab qiladi.
- **Restock** variantli mahsulotda `variantId` talab qiladi (400 qaytaradi) —
  aks holda operator zaxirani ko'rinmaydigan joyga qo'shib qo'yardi.

---

## Deploy

Migratsiya kerak: `20260804140000_add_product_variants`
(`ProductVariant`, `Product.options`, `OrderItem.variantId/variantLabel`,
`OneCImportLog.variantsCreated/variantsUpdated`).

```bash
cd /opt/shopflow && git fetch origin && git reset --hard origin/main
docker compose up -d --build     # xizmat nomisiz — backend ham qayta quriladi
```
