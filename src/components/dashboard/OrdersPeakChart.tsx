import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Loader2 } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useNotifications } from "../../lib/notifications";
import type { PeriodRange } from "./PeriodSelector";

export default function OrdersPeakChart({ range }: { range: PeriodRange }) {
  const { onShopEvent } = useNotifications();
  const [data, setData] = useState<Array<{ hour: number; new: number; cancelled: number; completed: number }> | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setData(await api.analytics.ordersByHour({ from: range.from, to: range.to }));
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

  const chartData = (data ?? []).map((d) => ({ ...d, label: `${d.hour}:00` }));

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-white">Buyurtma vaqti</h3>
        <p className="text-xs text-slate-500 mt-0.5">Soat bo'yicha buyurtmalar - peak vaqtni aniqlash</p>
      </div>

      <div className="h-64">
        {loading && !data ? (
          <div className="h-full flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-600" /></div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} interval={2} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                labelStyle={{ color: "#cbd5e1" }}
                itemStyle={{ fontSize: "12px" }}
              />
              <Legend wrapperStyle={{ fontSize: "11px" }} formatter={(v) => <span className="text-slate-400">{v}</span>} />
              <Bar dataKey="new" stackId="a" fill="#3b82f6" name="Yangi" radius={[0, 0, 0, 0]} />
              <Bar dataKey="completed" stackId="a" fill="#10b981" name="Yakunlangan" radius={[0, 0, 0, 0]} />
              <Bar dataKey="cancelled" stackId="a" fill="#ef4444" name="Bekor" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
