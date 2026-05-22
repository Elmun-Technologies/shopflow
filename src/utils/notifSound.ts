// Yangi buyurtma kelganda eshittiriladigan "ding" tovushi.
// Web Audio API ishlatadi — tashqi fayl yoki bog'liqlik kerak emas.
//
// Brauzer policy: AudioContext faqat user gesture'dan keyin ishlay boshlaydi.
// Birinchi click/keydown'da resume() qilamiz va keyin chaqiriqlar erkin ishlaydi.

const MUTE_KEY = "shopflow.notifMuted";
const PERM_KEY = "shopflow.browserNotifAsked";

let ctx: AudioContext | null = null;
let initialized = false;

function getMuted(): boolean {
  try { return localStorage.getItem(MUTE_KEY) === "1"; }
  catch { return false; }
}

export function setNotifMuted(muted: boolean): void {
  try {
    if (muted) localStorage.setItem(MUTE_KEY, "1");
    else localStorage.removeItem(MUTE_KEY);
  } catch { /* ignore */ }
}

export function isNotifMuted(): boolean { return getMuted(); }

// Birinchi user gesture'da AudioContext'ni resume qilish.
// Bu module-load paytida bir marta o'rnatiladi.
function initOnFirstGesture(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  const resume = () => {
    if (!ctx) {
      try {
        const Ctor = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
        ctx = new Ctor();
      } catch { /* ignore */ }
    }
    if (ctx?.state === "suspended") void ctx.resume();
    // Bir marta yetarli
    document.removeEventListener("click", resume);
    document.removeEventListener("keydown", resume);
    document.removeEventListener("touchstart", resume);
  };
  document.addEventListener("click", resume, { once: false });
  document.addEventListener("keydown", resume, { once: false });
  document.addEventListener("touchstart", resume, { once: false });
}

// Module load'da darhol listenerni o'rnatamiz
if (typeof window !== "undefined") {
  initOnFirstGesture();
}

// Maslahatlar uslubida 2-3 nota "ding"
export function playNewOrderSound(): void {
  if (getMuted()) return;
  if (!ctx || ctx.state !== "running") return;

  const now = ctx.currentTime;
  // Ikki nota — yuqori va past, pleasant
  playTone(ctx, 880, now, 0.08, 0.12);          // A5, qisqa
  playTone(ctx, 1318.51, now + 0.08, 0.18, 0.10); // E6, biroz uzun
}

function playTone(audioCtx: AudioContext, freq: number, start: number, duration: number, gain: number) {
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  // Tez attack, sekin decay (chiroyli "ding")
  gainNode.gain.setValueAtTime(0, start);
  gainNode.gain.linearRampToValueAtTime(gain, start + 0.005);
  gainNode.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  osc.start(start);
  osc.stop(start + duration);
}

// Browser native notification — tab background'da bo'lsa ham ko'rinadi
export async function showBrowserNotification(title: string, body: string): Promise<void> {
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "denied") return;
  if (Notification.permission === "default") {
    // Ruxsat allaqachon so'ralganmi tekshiramiz — ko'p marta so'rashning ma'nosi yo'q
    try {
      if (localStorage.getItem(PERM_KEY)) return;
      localStorage.setItem(PERM_KEY, "1");
    } catch { /* ignore */ }
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return;
  }
  try {
    const n = new Notification(title, { body, icon: "/favicon.svg", tag: "shopflow-order" });
    // 5 soniyada avto-yopiladi
    setTimeout(() => n.close(), 5000);
  } catch { /* ignore */ }
}
