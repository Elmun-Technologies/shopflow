import { useEffect, useMemo, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Loader2 } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useNotifications } from "../../lib/notifications";

const COLORS: Record<string, string> = {
  telegram: "#3b82f6",
  miniapp: "#10b981",
  admin: "#a855f7",
};
const LABELS: Record<string, string> = {
  telegram: "Telegram",
  miniapp: "Mini App",
  admin: "Admin",
};

export default function TrafficSourceChart() {
  const { onShopEvent } = useNotifications();
  const [data, setData] = useState<Array<{ source: string; orders: number; revenue: number; customers: number }> | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setData(await api.analytics.traffic());
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
  }, [onShopEvent]);

  const chartData = useMemo(
    () => (data ?? [])
      .filter((d) => d.orders > 0)
      .map((d) => ({ name: LABELS[d.source] ?? d.source, value: d.orders, color: COLORS[d.source] ?? "#94a3b8", revenue: d.revenue })),
    [data],
  );

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 h-full">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-white">Trafik manbai</h3>
        <p className="text-xs text-slate-500 mt-0.5">Mijozlar qaerdan keladi</p>
      </div>

      {loading && !data ? (
        <div className="h-48 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-600" /></div>
      ) : chartData.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-500 text-sm">Trafik ma'lumoti yo'q</p>
        </div>
      ) : (
        <>
          <div className="h-48 mb-3">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3}>
                  {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2">
            {chartData.map((d) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-slate-300">{d.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-white font-medium">{d.value}</span>
                  <span className="text-slate-500 ml-2">{d.revenue.toLocaleString()} so'm</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
