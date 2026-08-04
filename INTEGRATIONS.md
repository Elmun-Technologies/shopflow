# ShopFlow — Integratsiyalarni ulash (operator yo'riqnomasi)

Bu hujjat tashqi xizmatlarni **kod tayyor** bo'lgan integratsiyalarga ulashni tushuntiradi.
Kod allaqachon yozilgan — faqat credential/hisob ulansa ishlaydi. Barcha kalitlar
serverdagi `.env` faylga qo'yiladi (global, barcha tenantlar uchun), so'ng konteyner
qayta ishga tushiriladi:

```bash
ssh root@83.229.86.232
cd /opt/shopflow
nano .env          # kerakli o'zgaruvchilarni qo'shing
docker compose up -d --build shopflow
```

Holatni admin panelda tekshirish mumkin (har bo'lim "ulangan / ulanmagan" ko'rsatadi).

---

## 1. Push bildirishnoma (VAPID) — ✅ kod tayyor

Mijoz/operator brauzeriga push (Service Worker orqali). Hozir admin uchun **qo'lda test**
ishlaydi; buyurtmada **avtomatik** push hali ulanmagan (kelajak yaxshilanish).

**`.env`:**
```
VAPID_PUBLIC_KEY=<public>
VAPID_PRIVATE_KEY=<private>
VAPID_SUBJECT=mailto:admin@shop-flow.uz
```

**Kalit olish:**
```bash
npx web-push generate-vapid-keys
# yoki:
docker run --rm node:20-alpine sh -c "npm i -g web-push >/dev/null && web-push generate-vapid-keys"
```

**Qadamlar:** kalitlarni generatsiya qiling → `.env`'ga qo'ying → qayta build →
Sozlamalar → Bildirishnomalar → "Test" tugmasi bilan tekshiring.

---

## 2. Email hisobotlar (SMTP) — ✅ kod tayyor

Kunlik/haftalik/oylik avtomatik hisobot (nodemailer + soatlik scheduler + "Hozir yuborish").

> ⚠️ Eslatma: O'zbekiston bozorida email marketing kuchsiz. Bu funksiya ichki
> hisobotlar uchun foydali, mijozlarga marketing uchun emas.

**`.env`:**
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@example.com
SMTP_PASS=<app-password>
SMTP_FROM=ShopFlow <you@example.com>
SMTP_SECURE=false      # 465 port uchun true
```

**Credential olish:** Gmail App Password (https://myaccount.google.com/app-passwords),
SendGrid, Mailgun yoki o'z SMTP serveringiz.

**Qadamlar:** `.env` → qayta build → Sozlamalar → Bildirishnomalar → qabul
qiluvchilar + chastota → "Hozir yuborish" bilan tekshiring.

---

## 3. Eskiz SMS — ✅ kod tayyor

Bitta/ommaviy SMS (token auth + 100talik partiyalar). Hozir **qo'lda yuborish**
(marketing sahifasidan). Buyurtma/lid event'ida avtomatik SMS hali ulanmagan.

**`.env`:**
```
ESKIZ_LOGIN=email@example.com
ESKIZ_PASSWORD=<eskiz-parol>
ESKIZ_FROM=ShopFlow
```

**Hisob olish:** https://eskiz.uz da ro'yxatdan o'ting → tasdiqlang → sender name
("ESKIZ_FROM") ni dashboard'da ro'yxatdan o'tkazing.

**Qadamlar:** `.env` → qayta build → Marketing → SMS sahifasida holat "ulangan"
ko'rinadi → test yuboring.

> Kelajak: per-tenant credential (`Channel.config` orqali) rejalashtirilgan — hozir global.

---

## 4. Yandex Go yetkazib berish — ⚠️ FAQAT STUB (ulab bo'lmaydi)

**Hozircha ishlamaydi.** Loyihada umumiy yetkazib berish boshqaruvi (zonalar, usullar,
buyurtma kuzatuvi, kuryer tayinlash) bor, lekin **Yandex Go API integratsiyasi kodi YO'Q**:
- ❌ Yandex Go API klienti
- ❌ Buyurtmani Yandex tizimida yaratish
- ❌ Status webhook'lari
- ❌ Credential boshqaruvi

**Ulash uchun avval qurish kerak:** Yandex Pro biznes hisobi
(https://yandex.com/biz/pro) + API token, so'ng provayder klient/webhook kodi yoziladi.
Bu alohida ish (faqat `.env` yetarli emas).

---

## 5. 1C — ✅ ishlaydi (`.env` kerak emas)

1C: Buxgalteriya / UT bilan katalog almashinuvi — **CommerceML 2 «Обмен с сайтом»**
protokoli orqali. Boshqa integratsiyalardan farqi: bu yerda **1C bizga ulanadi**,
biz 1C'ga emas. Sabab — 1C mijoz kompyuterida/serverida turadi va odatda NAT ortida
bo'ladi; oq IP, VPN yoki 1C web-server publikatsiyasi **kerak emas**.

**Qamrov (hozircha):** kategoriya + mahsulot kartochkasi (nom, artikul, tavsif,
guruh, rasm, ishlab chiqarilgan davlat). **Narx va qoldiq sinxronlanmaydi** —
`offers.xml` qabul qilinadi, lekin qo'llanmaydi. Shu sababli 1C'dan kelgan yangi
mahsulot default holatda **yashirin** yaratiladi (vitrinada 0 so'mga chiqmasligi
uchun) — operator narx qo'yib, ko'rinadigan qiladi.

### Ulash (admin panel)

1. Sozlamalar → Integratsiyalar → **1C: Buxgalteriya** → «Ulash».
2. Panel uchta qiymat beradi: **almashinuv URL**, **login**, **parol**.
   Parolni darhol nusxalang (keyinroq «ko'z» tugmasi orqali ham ko'rish mumkin).

### Sozlash (1C tomonida)

1. `Администрирование → Обмен с сайтом` (yoki `Синхронизация с сайтом`).
2. Yangi **«Узел обмена»** qo'shing, **URL** maydoniga panel bergan manzilni kiriting:
   `https://shop-flow.uz/api/1c/exchange`
3. Foydalanuvchi/parol maydonlariga panel bergan **login/parol**ni kiriting.
4. **«Выгружать товары»** (katalog) bandini yoqing. Buyurtma yuklash hozircha shart emas.
5. **«Обменяться»** — bir necha daqiqadan so'ng mahsulotlar admin panelning
   «Mahsulotlar» bo'limida paydo bo'ladi (yashirin holatda).

### Import sozlamalari (kartochkadagi belgilar)

| Sozlama | Default | Ma'nosi |
|---|---|---|
| Yangi mahsulotlar yashirin | ✅ | Narx belgilangunicha vitrinada ko'rinmaydi |
| Rasmlar yuklab olinsin | ✅ | `<Картинка>` fayllari `/uploads/<tenant>/1c/` ga ko'chiriladi |
| Nom/tavsif ustiga yozilsin | ✅ | 1C = manba haqiqat. O'chirilsa operator tahriri saqlanadi |

### Nima *qilinmaydi* (ataylab)

- **Mahsulot hech qachon o'chirilmaydi.** 1C'da «Удален» belgilangan tovar faqat
  `active=false` qilinadi.
- **`mode=deactivate` bajarilmaydi.** 1C qisman yuklama (`СодержитТолькоИзменения`)
  yuborganda bu butun katalogni yashirib qo'yardi.
- **Buyurtmalar 1C'ga yuborilmaydi.** `type=sale` so'roviga bo'sh, lekin yaroqli
  CommerceML hujjati qaytadi — shunda 1C tomonida almashinuv xatosiz yakunlanadi.

### Diagnostika

- Kartochkadagi **«Importlar tarixi»** — har bir fayl bo'yicha nechta mahsulot/
  kategoriya/rasm qayta ishlangani, xato bo'lsa matni.
- Katta katalog `progress` protokoli bilan bo'lakma-bo'lak (300 tadan) import
  qilinadi — 1C bir so'rovda timeout bo'lib qolmaydi.
- Server logi: `docker compose logs -f backend | grep 1C`.

**Texnik tafsilotlar:** `backend/src/routes/onec-exchange.ts` (protokol),
`backend/src/lib/onec-commerceml.ts` (XML parser), `backend/src/lib/onec-import.ts`
(bazaga yozish). Staging katalogi — `ONEC_EXCHANGE_DIR` (default `/app/1c-exchange`),
**ataylab** `/app/uploads` dan tashqarida: uploads nginx orqali ochiq beriladi,
`import.xml` esa butun katalogni oshkor qilardi.

---

## Xulosa

| Integratsiya | Holat | Kerak |
|---|---|---|
| Push (VAPID) | ✅ kod tayyor | VAPID kalitlar (`.env`) |
| Email (SMTP) | ✅ kod tayyor | SMTP login (`.env`) |
| Eskiz SMS | ✅ kod tayyor | Eskiz login/parol (`.env`) |
| 1C (CommerceML) | ✅ ishlaydi | Admin panelda «Ulash» + 1C'da sozlash |
| Yandex Go | ⚠️ stub | Yandex hisob + **kod qurish** |

Batafsil `.env` namunasi: `.env.example`. Deploy: `OPS.md`.
