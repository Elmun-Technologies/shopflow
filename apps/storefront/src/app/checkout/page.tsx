"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/lib/cart-store";
import { formatMoney } from "@/lib/format";
import { PhoneVerifier } from "@/components/PhoneVerifier";

export default function CheckoutPage() {
  const cart = useCart();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [storefrontJwt, setStorefrontJwt] = useState<string | null>(null);
  const [tenantSlug, setTenantSlug] = useState<string>("");
  useEffect(() => {
    setTenantSlug(window.location.hostname.split(".")[0] ?? "");
  }, []);

  if (cart.lines.length === 0 && !submitting) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-neutral-900">Savatcha bo'sh</h1>
        <Link
          href="/catalog"
          className="mt-6 inline-block rounded-lg bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-sm font-medium text-white"
        >
          Katalogga o'tish
        </Link>
      </div>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/storefront/orders", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(storefrontJwt ? { authorization: `Bearer ${storefrontJwt}` } : {}),
        },
        body: JSON.stringify({
          customerName: name,
          customerPhone: phone,
          shippingAddress: address,
          notes,
          items: cart.lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity })),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.message === "string" ? body.message : Array.isArray(body.message) ? body.message.join(", ") : "Order yaratib bo'lmadi",
        );
      }
      const order = (await res.json()) as { id: string };
      cart.clear();
      router.push(`/order/${order.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Server bilan bog'lanishda xatolik");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="text-2xl font-bold text-neutral-900 mb-6">Buyurtmani rasmiylashtirish</h1>

      <form onSubmit={submit} className="grid gap-6 md:grid-cols-3">
        <section className="md:col-span-2 space-y-4 rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="text-base font-semibold text-neutral-900">Aloqa va yetkazib berish</h2>

          <Field label="Ism" required>
            <input
              required
              minLength={2}
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="To'liq ismingiz"
            />
          </Field>

          <Field label="Telefon raqami" required>
            <input
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input"
              placeholder="+998 90 123 45 67"
              inputMode="tel"
            />
          </Field>

          {phone.replace(/\D+/g, "").length >= 9 && tenantSlug && (
            <PhoneVerifier tenantSlug={tenantSlug} phone={phone} onVerified={setStorefrontJwt} />
          )}

          <Field label="Yetkazib berish manzili">
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="input"
              rows={3}
              placeholder="Shahar, ko'cha, uy raqami"
            />
          </Field>

          <Field label="Izoh (ixtiyoriy)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input"
              rows={2}
              placeholder="Qo'shimcha xohishlar"
            />
          </Field>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </section>

        <aside className="rounded-xl border border-neutral-200 bg-white p-5 h-fit sticky top-20">
          <h2 className="text-base font-semibold text-neutral-900 mb-3">Buyurtma tarkibi</h2>
          <ul className="space-y-2 text-sm">
            {cart.lines.map((l) => (
              <li key={`${l.productId}:${l.variantId ?? ""}`} className="flex justify-between gap-2">
                <span className="text-neutral-700 line-clamp-2">
                  {l.name} <span className="text-neutral-400">×{l.quantity}</span>
                </span>
                <span className="text-neutral-900 shrink-0">{formatMoney(l.priceKopecks * l.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-between border-t border-neutral-100 pt-3 text-base font-semibold">
            <span>Jami</span>
            <span>{formatMoney(cart.total)}</span>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="mt-4 w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-400 py-3 text-sm font-semibold text-white"
          >
            {submitting ? "Yuborilmoqda…" : "Buyurtma berish"}
          </button>
        </aside>
      </form>

      <style>{`
        .input {
          width: 100%;
          background: white;
          border: 1px solid #e5e7eb;
          color: #111827;
          padding: 0.5rem 0.75rem;
          border-radius: 0.5rem;
          font-size: 0.875rem;
        }
        .input:focus {
          outline: none;
          border-color: #10b981;
          box-shadow: 0 0 0 3px rgb(16 185 129 / 0.15);
        }
      `}</style>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-neutral-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}
