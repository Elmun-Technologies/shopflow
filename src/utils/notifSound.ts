// Yangi voqea kelganda eshittiriladigan tovushlar.
// Web Audio API ishlatadi — tashqi fayl yoki bog'liqlik kerak emas.
// 3 ta variant: "ding" (qisqa 2 nota), "bell" (3 nota arpeggio), "chime" (4 nota descending).
//
// Brauzer policy: AudioContext faqat user gesture'dan keyin ishlay boshlaydi.
// Birinchi click/keydown'da resume() qilamiz va keyin chaqiriqlar erkin ishlaydi.

import type { SoundType } from "./notifPrefs";

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
    document.removeEventListener("click", resume);
    document.removeEventListener("keydown", resume);
    document.removeEventListener("touchstart", resume);
  };
  document.addEventListener("click", resume, { once: false });
  document.addEventListener("keydown", resume, { once: false });
  document.addEventListener("touchstart", resume, { once: false });
}

if (typeof window !== "undefined") {
  initOnFirstGesture();
}

function playTone(audioCtx: AudioContext, freq: number, start: number, duration: number, gain: number) {
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gainNode.gain.setValueAtTime(0, start);
  gainNode.gain.linearRampToValueAtTime(gain, start + 0.005);
  gainNode.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  osc.start(start);
  osc.stop(start + duration);
}

// Ovoz pattern'lari — har biri pleasant va kichik (200-600ms)
const PATTERNS: Record<SoundType, Array<{ freq: number; delay: number; duration: number; gain: number }>> = {
  // 2 nota — qisqa va aniq
  ding: [
    { freq: 880, delay: 0, duration: 0.12, gain: 0.08 },
    { freq: 1318.51, delay: 0.08, duration: 0.18, gain: 0.10 },
  ],
  // 3 nota arpeggio — chiroyli, biroz musiqiy
  bell: [
    { freq: 783.99, delay: 0, duration: 0.10, gain: 0.07 },     // G5
    { freq: 1046.50, delay: 0.10, duration: 0.10, gain: 0.08 }, // C6
    { freq: 1318.51, delay: 0.20, duration: 0.22, gain: 0.10 }, // E6
  ],
  // 4 nota descending — softer, "yumshoq xabar"
  chime: [
    { freq: 1318.51, delay: 0, duration: 0.10, gain: 0.06 },    // E6
    { freq: 1174.66, delay: 0.10, duration: 0.10, gain: 0.07 }, // D6
    { freq: 1046.50, delay: 0.20, duration: 0.10, gain: 0.08 }, // C6
    { freq: 880, delay: 0.30, duration: 0.20, gain: 0.10 },     // A5
  ],
};

export function playSound(type: SoundType = "ding"): void {
  if (getMuted()) return;
  if (!ctx || ctx.state !== "running") return;
  const pattern = PATTERNS[type] ?? PATTERNS.ding;
  const now = ctx.currentTime;
  for (const note of pattern) {
    playTone(ctx, note.freq, now + note.delay, note.duration, note.gain);
  }
}

// Legacy alias — eski chaqiriqlar uchun
export function playNewOrderSound(type: SoundType = "ding"): void {
  playSound(type);
}

// Browser native notification — tab background'da bo'lsa ham ko'rinadi
export async function showBrowserNotification(title: string, body: string): Promise<void> {
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "denied") return;
  if (Notification.permission === "default") {
    try {
      if (localStorage.getItem(PERM_KEY)) return;
      localStorage.setItem(PERM_KEY, "1");
    } catch { /* ignore */ }
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return;
  }
  try {
    const n = new Notification(title, { body, icon: "/favicon.svg", tag: "shopflow-order" });
    setTimeout(() => n.close(), 5000);
  } catch { /* ignore */ }
}

// Permission'ni majburiy so'rash — Settings'dan tugma orqali
export async function requestBrowserNotifPermission(): Promise<NotificationPermission> {
  if (typeof Notification === "undefined") return "denied";
  if (Notification.permission !== "default") return Notification.permission;
  return await Notification.requestPermission();
}
