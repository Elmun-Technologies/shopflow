// Telegram Mini App SDK — JOY BAND QILUVCHI (placeholder).
//
// Production image'da bu fayl Docker build vaqtida telegram.org dan yuklab
// olingan HAQIQIY `telegram-web-app.js` bilan almashtiriladi (qarang: Dockerfile).
// Repoda esa ataylab BO'SH placeholder turadi — SDK Telegram'ning mulki va
// muntazam yangilanadi, uni versiyalab saqlash noto'g'ri bo'lardi.
//
// Zaxira (CDN) mantiqi ATAYLAB bu yerda emas, `index.html` da:
// ilgari u shu faylning ichida edi va shuning uchun aynan bu fayl yetib
// kelmagan holatda (404, bloklangan yo'l) zaxira ham ishlamasdi. Endi
// index.html dagi `<script ... onerror="window.__sfLoadTelegramCdn()">` va
// undan keyingi tekshiruv ikkala holatni ham qoplaydi.
//
// Shu sababli bu yerda hech qanday kod yo'q: `window.Telegram` yaratilmaydi,
// index.html buni ko'radi va CDN zaxirasini asinxron yuklaydi.
