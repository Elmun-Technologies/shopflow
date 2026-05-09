import { ChevronLeft, Receipt } from "lucide-react";
import { fmtMoney, fmtDate } from "../lib/format";
import type { OrderSummary } from "../lib/api";

const statusConfig: Record<string, { label: string; class: string }> = {
  pending: { label: "Kutilmoqda", class: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  confirmed: { label: "Tasdiqlandi", class: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  preparing: { label: "Tayyorlanmoqda", class: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  shipping: { label: "Yetkazilmoqda", class: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  delivered: { label: "Yetkazildi", class: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  cancelled: { label: "Bekor qilindi", class: "bg-red-500/15 text-red-400 border-red-500/30" },
};

interface Props {
  orders: OrderSummary[];
  currency: string;
  onBack: () => void;
}

export default function OrdersPage({ orders, currency, onBack }: Props) {
  return (
    <div>
      <div className="px-4 pt-4 pb-3 sticky top-0 bg-slate-950/95 backdrop-blur z-10 border-b border-slate-900 flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-slate-900"><ChevronLeft className="w-5 h-5" /></button>
        <h1 className="text-lg font-bold">Buyurtmalarim</h1>
      </div>

      {orders.length === 0 ? (
        <div className="px-4 pt-20 text-center">
          <Receipt className="w-16 h-16 mx-auto text-slate-700 mb-4" />
          <p className="text-slate-300 font-medium">Hali buyurtma yo'q</p>
          <p className="text-slate-500 text-sm mt-1">Birinchi xaridingizni amalga oshiring</p>
        </div>
      ) : (
        <div className="px-4 pt-4 space-y-3">
          {orders.map((o) => {
            const st = statusConfig[o.status] ?? { label: o.status, class: "bg-slate-700 text-slate-300 border-slate-600" };
            return (
              <div key={o.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold font-mono">{o.orderNumber}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{fmtDate(o.createdAt)}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${st.class}`}>{st.label}</span>
                </div>
                <p className="text-sm text-emerald-400 font-semibold">{fmtMoney(o.total, currency)}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
