"use client";

import { useEffect, useState } from "react";

interface Props {
  tenantSlug: string;
  phone: string;
  onVerified: (jwt: string) => void;
}

/**
 * Optional phone-OTP block on the checkout page. After the customer types a
 * phone number, they can tap "Tasdiqlash kodi" to receive a 4-digit SMS via
 * Eskiz. Verifying the code returns a 30-minute JWT, which we attach to
 * subsequent order creation so the customer's order history is linked.
 */
export function PhoneVerifier({ tenantSlug, phone, onVerified }: Props) {
  const [stage, setStage] = useState<"idle" | "sent" | "verifying" | "verified" | "error">("idle");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (remaining <= 0) return;
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining]);

  async function sendOtp() {
    setError(null);
    try {
      const res = await fetch("/api/storefront/auth/request-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantSlug, phone }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(typeof body.message === "string" ? body.message : "SMS yuborib bo'lmadi");
      }
      setStage("sent");
      setRemaining(60);
    } catch (err) {
      setStage("error");
      setError(err instanceof Error ? err.message : "Xatolik");
    }
  }

  async function verify() {
    setError(null);
    setStage("verifying");
    try {
      const res = await fetch("/api/storefront/auth/verify-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantSlug, phone, code }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(typeof body.message === "string" ? body.message : "Noto'g'ri kod");
      }
      const data = (await res.json()) as { accessToken: string };
      setStage("verified");
      onVerified(data.accessToken);
    } catch (err) {
      setStage("sent");
      setError(err instanceof Error ? err.message : "Xatolik");
    }
  }

  if (stage === "verified") {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
        ✓ Telefon tasdiqlandi. Buyurtmalar tarixi shu raqamga bog'lanadi.
      </div>
    );
  }

  if (stage === "idle" || stage === "error") {
    return (
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
        <p className="text-xs text-neutral-600 mb-2">
          Telefonni tasdiqlasangiz, keyingi xaridlaringizda tezroq buyurtma berasiz va buyurtma tarixini ko'ra olasiz (ixtiyoriy).
        </p>
        {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
        <button
          type="button"
          onClick={sendOtp}
          disabled={phone.replace(/\D+/g, "").length < 9}
          className="rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-300 px-3 py-1.5 text-xs font-medium text-white"
        >
          SMS orqali tasdiqlash kodini olish
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
      <p className="text-xs text-neutral-600 mb-2">
        4 xonali kod {phone} raqamiga yuborildi. Quyiga kiriting:
      </p>
      <div className="flex gap-2">
        <input
          inputMode="numeric"
          pattern="\d*"
          maxLength={4}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D+/g, ""))}
          className="w-24 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm tabular-nums"
          placeholder="••••"
        />
        <button
          type="button"
          onClick={verify}
          disabled={code.length !== 4 || stage === "verifying"}
          className="rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-300 px-3 py-1.5 text-xs font-medium text-white"
        >
          {stage === "verifying" ? "Tekshirilmoqda…" : "Tasdiqlash"}
        </button>
        {remaining > 0 ? (
          <span className="self-center text-xs text-neutral-500">{remaining}s</span>
        ) : (
          <button
            type="button"
            onClick={sendOtp}
            className="self-center text-xs text-emerald-700 hover:underline"
          >
            Qayta yuborish
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
