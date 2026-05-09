import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, CheckCircle2, XCircle, Clock, DollarSign } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { useNotifications } from "../lib/notifications";

interface Payment {
  id: string;
  orderId: string;
  orderNumber: string | null;
  provider: string;
  providerTxnId: string | null;
  amount: number;
  state: string;
  createdAt: number;
  updatedAt: number;
}

const stateConfig: Record<string, { label: string; class: string; icon: React.ElementType }> = {
  pending: { label: "Kutilmoqda", class: "bg-slate-700 text-slate-300", icon: Clock },
  prepared: { label: "Tayyorlandi", class: "bg-blue-500/15 text-blue-400 border-blue-500/30", icon: Clock },
  paid: { label: "To'landi", class: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: CheckCircle2 },
  cancelled: { label: "Bekor qilindi", class: "bg-red-500/15 text-red-400 border-red-500/30", icon: XCircle },
  failed: { label: "Muvaffaqiyatsiz", class: "bg-red-500/15 text-red-400 border-red-500/30", icon: XCircle },
};

export default function LivePaymentsPanel() {
  const { onShopEvent } = useNotifications();
  const [list, setList] = useState<Payment[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setList(await api.payments.list());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Xato");
      setList([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    return onShopEvent((ev) => {
      if (ev.type === "order.created" || ev.type === "order.updated") void load();
    });
  }, [onShopEvent]);

  const stats = useMemo(() => {
    if (!list) return { total: 0, paid: 0, paidAmount: 0, pending: 0 };
    return {
      total: list.length,
      paid: list.filter((p) => p.state === "paid").length,
      paidAmount: list.filter((p) => p.state === "paid").reduce((s, p) => s + p.amount, 0),
      pending: list.filter((p) => p.state === "pending" || p.state === "prepared").length,
    };
  }, [list]);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <div>
            <h3 className="text-white font-semibold">💳 Onlayn to'lovlar (Click + Payme)</h3>
            <p className="text-xs text-slate-500">Real to'lov tranzaksiyalari backend'dan</p>
          </div>
        </div>
        <button onClick={load} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-6">
        <Stat label="Jami tranzaksiya" value={stats.total} />
        <Stat label="Muvaffaqiyatli" value={stats.paid} accent="text-emerald-400" />
        <Stat label="Kutilmoqda" value={stats.pending} accent="text-amber-400" />
        <Stat label="To'langan summa" value={`${stats.paidAmount.toLocaleString()} so'm`} accent="text-emerald-400" />
      </div>

      {error && <div className="px-6 py-3 text-amber-400 text-sm">⚠️ {error}</div>}

      {loading && !list ? (
        <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-600" /></div>
      ) : !list || list.length === 0 ? (
        <div className="p-12 text-center">
          <DollarSign className="w-12 h-12 mx-auto text-slate-700 mb-3" />
          <p className="text-slate-400 text-sm">Hali onlayn to'lov yo'q</p>
          <p className="text-slate-600 text-xs mt-1">Click yoki Payme orqali to'lov kelganda shu yerda paydo bo'ladi</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="bg-slate-900/50">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-6">Buyurtma</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-3">Tizim</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-3">Tranzaksiya ID</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-3">Summa</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-3">Holat</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-6">Sana</th>
              </tr>
            </thead>
            <tbody>
              {list.slice(0, 50).map((p) => {
                const st = stateConfig[p.state] ?? stateConfig.pending;
                const StIcon = st.icon;
                const provColor = p.provider === "click" ? "text-cyan-400" : p.provider === "payme" ? "text-blue-400" : "text-slate-400";
                return (
                  <tr key={p.id} className="border-t border-slate-800 hover:bg-slate-800/30">
                    <td className="py-3 px-6 text-sm font-mono text-white">{p.orderNumber ?? p.orderId.slice(0, 8)}</td>
                    <td className={`py-3 px-3 text-sm font-semibold uppercase ${provColor}`}>{p.provider}</td>
                    <td className="py-3 px-3 text-xs text-slate-500 font-mono">{p.providerTxnId ?? "—"}</td>
                    <td className="py-3 px-3 text-sm text-emerald-400 font-semibold text-right">{p.amount.toLocaleString()} so'm</td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${st.class}`}>
                        <StIcon className="w-3 h-3" /> {st.label}
                      </span>
                    </td>
                    <td className="py-3 px-6 text-xs text-slate-500 text-right whitespace-nowrap">
                      {new Date(p.createdAt).toLocaleString("uz-UZ", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-xl bg-slate-800/50 border border-slate-800 px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`text-lg font-bold mt-1 ${accent ?? "text-white"}`}>{value}</p>
    </div>
  );
}
