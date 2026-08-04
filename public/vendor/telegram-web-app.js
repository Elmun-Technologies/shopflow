// Telegram Mini App SDK — ZAXIRA STUB.
//
// Production image'da bu fayl Docker build vaqtida telegram.org dan yuklab
// olingan HAQIQIY `telegram-web-app.js` bilan almashtiriladi (qarang: Dockerfile).
// Repoda stub turadi, chunki SDK Telegram'ning mulki va muntazam yangilanadi.
//
// Stub ishga tushsa (lokal dev, yoki build vaqtida yuklab olish uddalanmagan
// holat) — SDK Telegram CDN'idan yuklanadi, lekin ATAYLAB ASINXRON:
// `document.write` yoki sinxron <script> ishlatilmaydi. Sabab: ayrim mobil
// operatorlar telegram.org ni "jimgina" bloklaydi (RST emas, paket tashlanadi),
// va sinxron skript o'shanda TCP timeout'igacha butun HTML tahlilini to'xtatadi
// — mijoz uzoq vaqt OQ EKRAN ko'radi. Asinxron yuklashda esa sahifa normal
// chiziladi, SDK kechroq kelsa `sf:telegram-sdk` hodisasi bilan xabar beriladi
// (src/utils/telegramSdk.ts uni kutadi).
(function () {
  if (window.Telegram && window.Telegram.WebApp) return;

  var s = document.createElement("script");
  s.src = "https://telegram.org/js/telegram-web-app.js";
  s.async = true;
  s.onload = function () {
    if (window.__sfBoot) window.__sfBoot.sdk = "ok (CDN, kech)";
    window.dispatchEvent(new Event("sf:telegram-sdk"));
  };
  s.onerror = function () {
    if (window.__sfBoot) window.__sfBoot.sdk = "yo'q (CDN bloklangan)";
  };
  document.head.appendChild(s);
})();
