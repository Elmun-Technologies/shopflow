// Telegram Mini App SDK'ni "kech kelishi mumkin" deb hisoblab kutish.
//
// Nega kerak: SDK odatda `/vendor/telegram-web-app.js` dan sinxron yuklanadi va
// bundle ishga tushganda `window.Telegram` allaqachon bor bo'ladi. Lekin zaxira
// stub yo'li (telegram.org dan asinxron) ishlaganda u KECHROQ keladi. O'sha
// holatda `ready()`/`expand()` hech qachon chaqirilmasa, Telegram o'z yuklanish
// ekranini olib tashlamaydi — mijoz uchun "do'kon ochilmayapti" bo'lib ko'rinadi.

interface TelegramWebAppLike {
  ready: () => void;
  expand: () => void;
}

function current(): TelegramWebAppLike | undefined {
  return (window as unknown as { Telegram?: { WebApp?: TelegramWebAppLike } }).Telegram?.WebApp;
}

/**
 * SDK mavjud bo'lishi bilan `cb` ni chaqiradi (agar allaqachon bor bo'lsa —
 * darhol). `timeoutMs` ichida kelmasa — jim taslim bo'ladi: Telegram'siz muhitda
 * (oddiy brauzer) do'kon baribir ishlaydi.
 *
 * Tozalash funksiyasini qaytaradi.
 */
export function onTelegramReady(
  cb: (twa: TelegramWebAppLike) => void,
  timeoutMs = 6000,
): () => void {
  const now = current();
  if (now) {
    cb(now);
    return () => {};
  }

  let done = false;
  const finish = () => {
    if (done) return;
    const twa = current();
    if (!twa) return;
    done = true;
    cleanup();
    cb(twa);
  };

  const poll = window.setInterval(finish, 100);
  const stop = window.setTimeout(() => {
    done = true;
    cleanup();
  }, timeoutMs);

  function cleanup() {
    window.clearInterval(poll);
    window.clearTimeout(stop);
    window.removeEventListener("sf:telegram-sdk", finish);
  }

  window.addEventListener("sf:telegram-sdk", finish);
  return cleanup;
}
