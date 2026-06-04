// Push notifikatsiya — admin paneliga ulanganda foydalanuvchidan ruxsat so'raydi,
// Service Worker'da obuna yaratadi va backend'ga yuboradi. Settings'da o'chirish.
//
// Foydalanuvchi tajribasi:
//  - Auto-prompt YO'Q. Faqat foydalanuvchi tugmani bossagina ruxsat so'raymiz.
//  - Bir marta rad etilsa qayta so'ramaymiz (brauzer eslaydi).
//  - sw.js push event'ini handle qiladi (mavjud).

import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { api } from "../api/client";
import { useAppToast } from "./ui/Toast";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const buf = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function PushNotificationManager() {
  const toast = useAppToast();
  const [supported, setSupported] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [publicKey, setPublicKey] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ok = typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      window.Notification != null;
    setSupported(ok);
    if (!ok) return;

    // Backend VAPID kaliti sozlanganmi va joriy holatda obuna bormi
    (async () => {
      try {
        const res = await api<{ publicKey: string; configured: boolean }>("/push/public-key");
        setPublicKey(res.publicKey);
        setConfigured(res.configured);
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setSubscribed(!!sub);
      } catch {
        /* sokin — backend yopiq yoki SW tayyor emas */
      }
    })();
  }, []);

  const subscribe = async () => {
    if (!supported || !configured || !publicKey) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Ruxsat berilmadi. Brauzer sozlamalaridan yoqing.");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        // PushManager BufferSource'ni qabul qiladi; Uint8Array<ArrayBufferLike>
        // tipini cheklov tufayli BufferSource'ga cast
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
      });
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      await api("/push/subscribe", { method: "POST", body: json });
      setSubscribed(true);
      toast.success("Push bildirishnoma yoqildi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Obuna bo'lib bo'lmadi");
    } finally {
      setBusy(false);
    }
  };

  const unsubscribe = async () => {
    if (!supported) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api("/push/unsubscribe", { method: "POST", body: { endpoint: sub.endpoint } });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      toast.success("Push bildirishnoma o'chirildi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xato");
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    try {
      const res = await api<{ sent: number }>("/push/test", { method: "POST" });
      toast.success(`Yuborildi: ${res.sent} ta qurilmaga`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xato");
    } finally {
      setBusy(false);
    }
  };

  if (!supported) {
    return (
      <div className="bg-white rounded-2xl border border-cream-300 p-5">
        <h3 className="text-base font-semibold text-forest-800 mb-1">Push bildirishnomalar</h3>
        <p className="text-xs text-slate-500">Sizning brauzer push notifikatsiyalarni qo'llab-quvvatlamaydi.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-cream-300 p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-base font-semibold text-forest-800 mb-1 flex items-center gap-2">
            {subscribed ? <Bell className="w-4 h-4 text-leaf-500" /> : <BellOff className="w-4 h-4 text-slate-400" />}
            Push bildirishnomalar
          </h3>
          <p className="text-xs text-slate-500">
            {!configured
              ? "Server'da push notifikatsiya sozlanmagan (VAPID kalitlar yo'q)."
              : subscribed
              ? "Yangi buyurtma kelganda OS darajasida xabar olasiz — tab yopiq bo'lsa ham."
              : "Yoqing — admin paneli yopiq bo'lsa ham yangi buyurtma haqida darhol bilasiz."}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {!subscribed ? (
          <button
            onClick={subscribe}
            disabled={busy || !configured}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-leaf-400 hover:bg-leaf-500 disabled:opacity-50 rounded-lg text-sm font-medium text-forest-800"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            Yoqish
          </button>
        ) : (
          <>
            <button
              onClick={test}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-cream-100 hover:bg-cream-200 rounded-lg text-sm font-medium text-slate-700"
            >
              Sinab ko'rish
            </button>
            <button
              onClick={unsubscribe}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-100 hover:bg-rose-200 text-rose-600 rounded-lg text-sm font-medium"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              O'chirish
            </button>
          </>
        )}
      </div>
    </div>
  );
}
