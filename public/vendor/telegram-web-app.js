// Telegram Mini App SDK — ZAXIRA STUB.
//
// Production image'da bu fayl Docker build vaqtida telegram.org dan yuklab
// olingan HAQIQIY `telegram-web-app.js` bilan almashtiriladi (qarang: Dockerfile).
// Repoda esa stub turadi, chunki SDK Telegram'ning mulki — uni versiyalab
// saqlash noto'g'ri bo'lardi (yangilanib turadi).
//
// Stub ishga tushsa (lokal dev yoki build vaqtida yuklab olish uddalanmagan
// holat) — SDK Telegram CDN'idan sinxron yuklanadi, ya'ni eski xatti-harakat.
// `document.write` shu yerda ataylab: <head> dagi sinxron skript ichida u
// parsingni to'g'ri to'xtatib, SDK bundle'dan OLDIN ishga tushishini kafolatlaydi
// (async/appendChild bunday kafolat bermaydi — StorePage render vaqtida
// `window.Telegram` hali bo'lmasligi mumkin).
(function () {
  if (window.Telegram && window.Telegram.WebApp) return;
  document.write(
    '<script src="https://telegram.org/js/telegram-web-app.js"><\/script>'
  );
})();
