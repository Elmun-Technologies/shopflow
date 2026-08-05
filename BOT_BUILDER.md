# Bot konstruktori (BotFlow)

Telegram botning suhbat oqimini har bir tenant o'zi quradi — kod yozmasdan.
Bu **opt-in**: yoqilmagan tenantlar avvalgi standart botda qoladi.

Admin panel: **Kanallar → Bot** (`/botbuilder`, yorliq `g b`).

---

## Nima uchun kerak

Standart bot hamma uchun bir xil edi: 4 ta tugma (Do'kon / Buyurtmani kuzatish /
Yordam / Til), matnlar `webhooks.ts` ichida qattiq kodlangan. Chakana do'kon
uchun yetarli, lekin B2B mijozlar boshqacha ishlaydi:

- ko'p bosqichli katalog (kategoriya → tur → mahsulot);
- soha bo'yicha tanlash (ichimliklar / sut / kosmetika / maishiy kimyo …);
- 10 savolli "yechim tanlash" anketasi;
- namuna (obrazets), narx va hujjat so'rovlari;
- savat yo'q — har bir yo'l **lidga** olib boradi, narxni menejer tasdiqlaydi.

BotFlow shu farqni kod o'zgartirmasdan qoplaydi.

---

## Arxitektura

```
Admin (BotBuilderPage)
    │  PUT /api/bot-flow  { definition }
    ▼
BotFlow.definition (JSON)  ──zod──▶  bot-flow-schema.ts
    │
    │  Telegram update → POST /api/webhooks/telegram/:webhookKey
    ▼
bot-engine.ts (runtime)  ◀──holat──▶  BotSession (DB)
    │
    ├─▶ Lead + Interaction   (anketa yakunlanganda)
    ├─▶ Conversation         (erkin matn → Chat sahifasi)
    ├─▶ notifyAdmin          (Telegram xabari)
    └─▶ SSE lead.created     (admin panelga real-time)
```

| Fayl | Vazifa |
|---|---|
| `backend/src/lib/bot-flow-schema.ts` | Oqim kontrakti (zod) + `validateFlowRefs` / `findOrphanScreens` |
| `backend/src/lib/bot-flow-templates.ts` | `retail` / `b2b` / `blank` shablonlari |
| `backend/src/lib/bot-engine.ts` | Runtime interpretator |
| `backend/src/lib/bot-flow-ai.ts` | Brif → oqim generatori (Claude) |
| `backend/src/routes/bot-flow.ts` | Admin API |
| `backend/src/routes/webhooks.ts` | Engine'ga ulanish nuqtasi |
| `src/components/BotBuilderPage.tsx` | Vizual konstruktor + jonli preview |

### Oqim shakli

```jsonc
{
  "version": 1,
  "settings": {
    "startScreenId": "main",
    "welcome": { "uz": "…{store}…", "ru": "…{store}…" },
    "languages": ["uz", "ru"],
    "showStoreButton": true,        // pastdagi doimiy Mini App tugmasi
    "fallback": "operator",         // ai | lead | operator | menu
    "commands": [ { "command": "start", "description": {…}, "screenId": null } ]
  },
  "screens": [
    {
      "id": "main",                 // ^[a-z0-9_]{1,24}$
      "name": "Bosh menyu",         // faqat admin ko'radi
      "text": { "uz": "…", "ru": "…" },
      "buttons": [
        { "id": "catalog", "label": {…}, "fullWidth": true,
          "action": { "type": "screen", "screenId": "catalog" } }
      ]
    }
  ],
  "forms": [
    {
      "id": "sample",
      "successText": { "uz": "… #{id}", "ru": "… #{id}" },   // {id} → lid kodi
      "fields": [
        { "id": "company", "label": {…}, "type": "text", "mapTo": "company" }
      ]
    }
  ]
}
```

### Tugma amallari

| `action.type` | Nima qiladi |
|---|---|
| `screen` | Boshqa ekranga o'tadi (tarix bilan — "Orqaga" ishlaydi) |
| `form` | Anketani boshlaydi |
| `text` | Statik matn sahifasi (Kompaniya haqida, Kontaktlar) |
| `webapp` | Mini App do'konini ochadi |
| `url` | Tashqi havola |
| `catalog` | DB'dagi mahsulotlar ro'yxati (sahifalash + kartochka). `openInApp: true` bo'lsa bot ichida ro'yxat o'rniga **Mini App do'konini** ochadi (chakana uchun — ilovada rasm/variant/savat batafsil; kategoriya tanlansa deep-link bilan). Storefront `?view=catalog&category=…` ni o'qiydi. |
| `track_order` | Buyurtma raqamini so'raydi va topib beradi |
| `operator` | Suhbat ochadi + adminni xabardor qiladi |
| `language` | Til almashtirish |
| `back` / `home` | Navigatsiya |

### Anketa maydonlari

`text` · `phone` · `email` · `number` · `choice` (inline variantlar) ·
`contact` (Telegram "raqamni yuborish" tugmasi).

`mapTo` javobni CRM lid ustuniga yozadi (`name`/`phone`/`email`/`company`/
`position`/`location`). Qolgan javoblar lid izohiga tushadi — Lidlar sahifasida
va CSV eksportda ko'rinadi.

---

## Muhim qarorlar

**Holat DB'da.** Ilgari `convState` xotiradagi `Map<chatId, …>` edi: server
restartda yo'qolardi va tenantlar orasida chatId bo'yicha to'qnashardi (bir
foydalanuvchi ikki tenant botida). 10 savolli anketa uchun bu yaramaydi —
holat endi `BotSession` jadvalida, `@@unique([tenantId, chatId])`.

**callback_data 64 bayt.** Shuning uchun ekran/tugma/anketa ID'lari ≤24 belgi
(zod majburlaydi) va qisqa prefiksli sxema: `b:<screen>:<button>`, `f:<form>`,
`o:<idx>`, `cat:<cat>:<page>`, `p:<productId>`, `nav:back`, `lang:ru`.

**Buzuq oqim botni o'ldirmaydi.** `webhooks.ts` `safeParse` qiladi; sxemaga mos
kelmasa log yozib standart botga tushadi. Engine ichidagi istalgan xato ham
ushlanadi va 200 qaytariladi (aks holda Telegram cheksiz qayta uradi).

**Saqlashda tekshiruv.** `PUT /api/bot-flow` mavjud bo'lmagan ekran/anketaga
ishora qiluvchi tugmalarni, bo'sh anketani va variantsiz `choice` savolini rad
etadi (400) — buzuq oqim DB'ga umuman tushmaydi.

**Preview va bot bir manba.** Konstruktordagi Telegram oynasi o'sha
`definition`'ni o'qiydi — tugmalar bosiladi, anketa qadamlari yuriladi.

---

## AI generator

**Bot → AI generator** tugmasi. Mijozning texnik topshirig'ini (rus tilida
bo'lsa ham) qanday yozilgan bo'lsa shundayligicha qo'yasiz — model to'liq oqim
JSON'ini qaytaradi, zod tekshiradi, admin ko'rib chiqib saqlaydi.

- **Kalit kerak** — `OPENAI_API_KEY` yoki `ANTHROPIC_API_KEY`. Bo'lmasa tugma
  o'chirilgan holatda va shablonlardan foydalaniladi. Batafsil: quyidagi
  "Provayder va model" bo'limi.
- Model faqat **taklif** qaytaradi: avtomatik saqlanmaydi va yoqilmaydi.
- "Mavjud oqimni asos qilib olish" — joriy oqimni brifga qarab tahrirlaydi,
  ID'larni saqlab qolishga harakat qiladi.
- Rate limit: 10 so'rov / 10 daqiqa.

### Provayder va model

Kod bitta provayderga bog'lanmagan — `backend/src/lib/ai-provider.ts` kalitga
qarab tanlaydi:

| Holat | Ishlatiladi |
|---|---|
| `OPENAI_API_KEY` bor | OpenAI |
| Faqat `ANTHROPIC_API_KEY` bor | Anthropic |
| Ikkalasi bor | OpenAI (`AI_PROVIDER=anthropic` bilan majburlash mumkin) |
| Hech biri yo'q | AI funksiyalari jim o'chadi |

Model `.env` orqali almashadi — **kalitingiz qaysi modelga ruxsat berishini
bilmasdan default qo'yilgan**, shuning uchun "modelga ruxsat yo'q" xatosi
chiqsa shu qatorlarni to'g'rilang:

```bash
OPENAI_MODEL=gpt-4o            # bot oqimini generatsiya qilish (sifat muhim)
OPENAI_MODEL_FAST=gpt-4o-mini  # Telegram'dagi AI javoblar (tez/arzon)
```

Anthropic uchun `ANTHROPIC_MODEL` / `ANTHROPIC_MODEL_FAST`.

Admin panelidagi AI oynasi sarlavhasi ostida **hozir qaysi model ishlayotgani**
ko'rsatiladi — `.env` to'g'ri qo'llanganini shu yerdan tekshirasiz.

OpenAI tomonida ikkita farq avtomatik qoplanadi, model almashganda kodga
tegish shart emas: yangi modellar `max_tokens` o'rniga `max_completion_tokens`
talab qiladi, ba'zilari `response_format: json_object` ni qo'llab-quvvatlamaydi
— ikkalasida ham bir marta boshqacha shakl bilan qayta uriniladi.

---

## Ishga tushirish (yangi mijoz uchun)

1. **Platformalar → Telegram** — bot tokenini kiriting, `setWebhook` bajarilsin.
2. **Bot → Shablonlar** — `B2B` yoki `Chakana` tanlang (yoki AI generator).
3. Matnlarni tahrirlang; UZ va RU ikkalasini to'ldiring (bo'sh til ikkinchisiga
   fallback qiladi, lekin tarjima qilingani yaxshi).
4. **Saqlash** → **Yoqilgan**.
5. Telegram'da `/start` bosib tekshiring.

Oqim o'zgargandan keyin o'z suhbatingiz yarim qadamda qolsa —
`POST /api/bot-flow/reset-session { chatId }` holatni tozalaydi.

---

## Deploy

Yangi jadvallar bor — migratsiya majburiy:

```bash
cd /opt/shopflow && git fetch origin && git reset --hard origin/main
docker compose up -d --build          # xizmat nomisiz — backend ham qayta quriladi
```

Migratsiya: `20260804120000_add_bot_flow` (`BotFlow`, `BotSession`).
