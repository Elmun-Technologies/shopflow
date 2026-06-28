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

## Xulosa

| Integratsiya | Holat | Kerak |
|---|---|---|
| Push (VAPID) | ✅ kod tayyor | VAPID kalitlar (`.env`) |
| Email (SMTP) | ✅ kod tayyor | SMTP login (`.env`) |
| Eskiz SMS | ✅ kod tayyor | Eskiz login/parol (`.env`) |
| Yandex Go | ⚠️ stub | Yandex hisob + **kod qurish** |

Batafsil `.env` namunasi: `.env.example`. Deploy: `OPS.md`.
