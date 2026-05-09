import { useState } from "react";
import { ChevronLeft, Loader2 } from "lucide-react";
import { fmtMoney } from "../lib/format";
import type { Product } from "../lib/api";
import type { CartItem } from "../MiniApp";

interface Props {
  items: CartItem[];
  productMap: Map<string, Product>;
  currency: string;
  total: number;
  onSubmit: (input: {
    customerPhone: string;
    address?: object;
    paymentMethod: "cash" | "card_online" | "transfer";
    notes?: string;
  }) => Promise<unknown>;
  onBack: () => void;
}

export default function CheckoutPage({ items, productMap, currency, total, onSubmit, onBack }: Props) {
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("Toshkent");
  const [street, setStreet] = useState("");
  const [house, setHouse] = useState("");
  const [apartment, setApartment] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card_online" | "transfer">("cash");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError(null);
    if (!phone.match(/^\+?\d{9,15}$/)) {
      setError("Telefon raqami noto'g'ri (+998901234567 ko'rinishida)");
      return;
    }
    if (!street.trim() || !house.trim()) {
      setError("Manzil to'liq emas");
      return;
    }
    setLoading(true);
    try {
      await onSubmit({
        customerPhone: phone,
        address: { city, street, house, apartment },
        paymentMethod,
        notes: notes.trim() || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xato");
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="px-4 pt-4 pb-3 sticky top-0 bg-slate-950/95 backdrop-blur z-10 border-b border-slate-900 flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-slate-900"><ChevronLeft className="w-5 h-5" /></button>
        <h1 className="text-lg font-bold">Rasmiylashtirish</h1>
      </div>

      <div className="px-4 pt-4 pb-32 space-y-4">
        {/* Buyurtma tarkibi */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2">
          <p className="text-xs text-slate-500 uppercase">Buyurtma ({items.length} ta)</p>
          {items.map((it) => {
            const p = productMap.get(it.productId);
            if (!p) return null;
            return (
              <div key={it.productId} className="flex justify-between text-sm">
                <span className="text-slate-300 line-clamp-1">{p.name} × {it.quantity}</span>
                <span className="text-slate-200 ml-2 shrink-0">{fmtMoney(p.price * it.quantity, currency)}</span>
              </div>
            );
          })}
          <div className="flex justify-between pt-2 border-t border-slate-800">
            <span className="font-semibold">Jami</span>
            <span className="font-bold text-emerald-400">{fmtMoney(total, currency)}</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <p className="text-xs text-slate-500 uppercase">Mijoz ma'lumoti</p>
          <Field label="Telefon raqam">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+998 90 123 45 67"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50"
            />
          </Field>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <p className="text-xs text-slate-500 uppercase">Yetkazib berish manzili</p>
          <Field label="Shahar">
            <input value={city} onChange={(e) => setCity(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm" />
          </Field>
          <Field label="Ko'cha">
            <input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Mustaqillik ko'chasi" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Uy">
              <input value={house} onChange={(e) => setHouse(e.target.value)} placeholder="12" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm" />
            </Field>
            <Field label="Xonadon (ixtiyoriy)">
              <input value={apartment} onChange={(e) => setApartment(e.target.value)} placeholder="34" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm" />
            </Field>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
          <p className="text-xs text-slate-500 uppercase mb-2">To'lov turi</p>
          {([
            { v: "cash", label: "Naqd pul (yetkazganda)" },
            { v: "card_online", label: "Onlayn karta orqali" },
            { v: "transfer", label: "Bank o'tkazma" },
          ] as const).map((opt) => (
            <label key={opt.v} className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer ${paymentMethod === opt.v ? "bg-emerald-500/10 border border-emerald-500/40" : "bg-slate-800/50 border border-transparent"}`}>
              <input type="radio" checked={paymentMethod === opt.v} onChange={() => setPaymentMethod(opt.v)} className="accent-emerald-500" />
              <span className="text-sm">{opt.label}</span>
            </label>
          ))}
        </div>

        <div>
          <Field label="Izoh (ixtiyoriy)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Yetkazib berish vaqti, qo'shimcha so'rovlar..."
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50"
            />
          </Field>
        </div>

        {error && <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">{error}</div>}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur border-t border-slate-900 p-4">
        <div className="max-w-md mx-auto">
          <button
            onClick={submit}
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Tasdiqlash — {fmtMoney(total, currency)}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
