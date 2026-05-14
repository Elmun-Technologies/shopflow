import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api.ts";
import { useCart } from "../cart.ts";
import { formatMoney } from "../format.ts";

export function CheckoutPage() {
  const { slug } = useParams();
  const nav = useNavigate();
  const cart = useCart();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.post("/storefront/orders", {
        customerName: name,
        customerPhone: phone,
        shippingAddress: address,
        items: cart.lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity })),
      });
      cart.clear();
      nav(`/${slug}/order/${res.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik yuz berdi");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-4 pb-32">
      <h1 className="text-xl font-semibold">Buyurtma berish</h1>
      <div className="mt-4 space-y-3">
        <input
          className="w-full rounded-lg border border-neutral-200 px-3 py-2"
          placeholder="Ismingiz"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="w-full rounded-lg border border-neutral-200 px-3 py-2"
          placeholder="+998 ..."
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <textarea
          className="w-full rounded-lg border border-neutral-200 px-3 py-2"
          placeholder="Yetkazib berish manzili"
          rows={3}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </div>
      <div className="mt-4 flex justify-between text-lg font-semibold">
        <span>Jami:</span>
        <span>{formatMoney(cart.total())}</span>
      </div>
      {error && <p className="mt-3 text-red-600 text-sm">{error}</p>}
      <button
        type="button"
        disabled={submitting || cart.lines.length === 0}
        onClick={submit}
        className="fixed bottom-4 left-4 right-4 rounded-xl bg-emerald-600 py-3 text-white font-semibold disabled:bg-neutral-400"
      >
        {submitting ? "Yuborilmoqda…" : "Tasdiqlash"}
      </button>
    </div>
  );
}
