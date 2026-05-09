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
  onSubmit: (input: { customerPhone: string; address?: object; paymentMethod: "cash" | "card_online" | "transfer"; notes?: string }) => Promise<unknown>;
  onBack: () => void;
}

export default function NewCheckoutPage({ items, productMap, currency, total, onSubmit, onBack }: Props) {
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
      await onSubmit({ customerPhone: phone, address: { city, street, house, apartment }, paymentMethod, notes: notes.trim() || undefined });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xato");
      setLoading(false);
    }
  }

  return (
    <div className="bg-gray-50 min-h-screen pb-32">
      <div className="bg-white border-b border-gray-100 px-4 py-3 sticky top-0 z-30 flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 rounded-lg hover:bg-gray-100">
          <ChevronLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-base font-bold text-gray-900">Rasmiylashtirish</h1>
      </div>

      <div className="p-4 space-y-3">
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <p className="text-xs text-gray-400 uppercase mb-3 tracking-wide">Buyurtma ({items.length} ta)</p>
          <div className="space-y-2">
            {items.map((it) => {
              const p = productMap.get(it.productId);
              if (!p) return null;
              return (
                <div key={it.productId} className="flex justify-between text-sm">
                  <span className="text-gray-700 line-clamp-1 flex-1">{p.name} × {it.quantity}</span>
                  <span className="text-gray-900 ml-2 shrink-0 font-medium">{fmtMoney(p.price * it.quantity, currency)}</span>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between pt-3 mt-3 border-t border-gray-100">
            <span className="font-semibold text-gray-900">Jami</span>
            <span className="font-bold text-violet-600 text-lg">{fmtMoney(total, currency)}</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-3">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Aloqa</p>
          <Field label="Telefon raqam">
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 90 123 45 67" className={input} />
          </Field>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-3">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Yetkazib berish manzili</p>
          <Field label="Shahar">
            <input value={city} onChange={(e) => setCity(e.target.value)} className={input} />
          </Field>
          <Field label="Ko'cha">
            <input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Mustaqillik ko'chasi" className={input} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Uy"><input value={house} onChange={(e) => setHouse(e.target.value)} placeholder="12" className={input} /></Field>
            <Field label="Xonadon"><input value={apartment} onChange={(e) => setApartment(e.target.value)} placeholder="34" className={input} /></Field>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-2">
          <p className="text-xs text-gray-400 uppercase mb-2 tracking-wide">To'lov turi</p>
          {([
            { v: "cash", label: "💵 Naqd pul (yetkazganda)" },
            { v: "card_online", label: "💳 Onlayn karta (Click/Payme)" },
            { v: "transfer", label: "🏦 Bank o'tkazma" },
          ] as const).map((opt) => (
            <label
              key={opt.v}
              className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${paymentMethod === opt.v ? "bg-violet-50 border-2 border-violet-500" : "bg-gray-50 border-2 border-transparent"}`}
              onClick={() => setPaymentMethod(opt.v)}
            >
              <div className={`w-4 h-4 rounded-full border-2 ${paymentMethod === opt.v ? "border-violet-500 bg-violet-500" : "border-gray-300"}`}>
                {paymentMethod === opt.v && <div className="w-1.5 h-1.5 bg-white rounded-full m-auto mt-[5px]" />}
              </div>
              <span className="text-sm text-gray-700 flex-1">{opt.label}</span>
            </label>
          ))}
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <Field label="Izoh (ixtiyoriy)">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Yetkazish vaqti, qo'shimcha so'rovlar..." className={`${input} min-h-[80px]`} />
          </Field>
        </div>

        {error && <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-600">{error}</div>}
      </div>

      <div className="fixed bottom-[68px] left-0 right-0 bg-white border-t border-gray-100 p-3 z-30">
        <div className="max-w-md mx-auto">
          <button
            onClick={submit}
            disabled={loading}
            className="w-full bg-violet-600 hover:bg-violet-500 disabled:bg-gray-300 text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Tasdiqlash — {fmtMoney(total, currency)}
          </button>
        </div>
      </div>
    </div>
  );
}

const input = "w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-violet-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
