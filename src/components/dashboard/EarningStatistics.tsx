import { useEffect, useMemo, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Loader2 } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useNotifications } from "../../lib/notifications";
import type { PeriodRange } from "./PeriodSelector";

function daysBetween(from: string, to: string): number {
  return Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / (24 * 60 * 60 * 1000)));
}

export default function EarningStatistics({ range }: { range: PeriodRange }) {
  const { onShopEvent } = useNotifications();
  const [data, setData] = useState<Array<{ date: string; revenue: number; orders: number }> | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const days = daysBetween(range.from, range.to);
      setData(await api.analytics.revenue(days));
    } catch (err) {
      if (err instanceof ApiError) console.warn(err.message);
      setData([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    return onShopEvent((ev) => {
      if (ev.type === "order.created") void load();
    });
  }, [range.from, range.to, onShopEvent]);

  const formatted = useMemo(() => (data ?? []).map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString("uz-UZ", { day: "2-digit", month: "short" }),
  })), [data]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 h-full flex flex-col">
      <div className="mb-3">
        <h3 className="text-base font-semibold text-white">Tushum statistikasi</h3>
        <p className="text-xs text-slate-500 mt-0.5">Tanlangan davr bo'yicha kun ravishda</p>
      </div>

      <div className="flex-1 min-h-[260px]">
        {loading && !data ? (
          <div className="h-full flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-600" /></div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={formatted}>
              <defs>
                <linearGradient id="dashRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as { revenue: number; orders: number };
                  return (
                    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs">
                      <p className="text-slate-300">{label}</p>
                      <p className="text-emerald-400 font-semibold">{p.revenue.toLocaleString()} so'm</p>
                      <p className="text-slate-500">{p.orders} buyurtma</p>
                    </div>
                  );
                }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fill="url(#dashRev)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
