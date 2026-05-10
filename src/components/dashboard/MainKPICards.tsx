import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { DollarSign, ShoppingBag, Users } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useNotifications } from "../../lib/notifications";
import type { PeriodRange } from "./PeriodSelector";

function fmt(v: number): string {
  return new Intl.NumberFormat("uz-UZ").format(Math.round(v));
}

interface PeriodData {
  earnings: { total: number; costOfSales: number; deliveryAmount: number; profit: number };
  orders: { total: number; new: number; done: number; cancelled: number };
  clients: { total: number; new: number; returned: number; averageOrder: number };
}

export default function MainKPICards({ range }: { range: PeriodRange }) {
  const { onShopEvent } = useNotifications();
  const [data, setData] = useState<PeriodData | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setData(await api.analytics.period({ from: range.from, to: range.to }));
    } catch (err) {
      if (err instanceof ApiError) console.warn(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    return onShopEvent((ev) => {
      if (ev.type === "order.created" || ev.type === "order.updated") void load();
    });
  }, [range.from, range.to, onShopEvent]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <KPICard
        accent="emerald"
        icon={DollarSign}
        title="Tushum"
        value={`${fmt(data?.earnings.total ?? 0)} so'm`}
        loading={loading}
        delay={0}
        rows={[
          { label: "Sotuv tannarxi", value: `${fmt(data?.earnings.costOfSales ?? 0)} so'm`, dot: "bg-violet-500" },
          { label: "Yetkazib berish", value: `${fmt(data?.earnings.deliveryAmount ?? 0)} so'm`, dot: "bg-blue-500" },
          { label: "Foyda", value: `${fmt(data?.earnings.profit ?? 0)} so'm`, dot: "bg-emerald-500", emphasize: true },
        ]}
      />
      <KPICard
        accent="amber"
        icon={ShoppingBag}
        title="Buyurtmalar"
        value={`${fmt(data?.orders.total ?? 0)}`}
        suffix="ta"
        loading={loading}
        delay={0.05}
        rows={[
          { label: "Yangi", value: String(data?.orders.new ?? 0), dot: "bg-blue-500" },
          { label: "Yakunlangan", value: String(data?.orders.done ?? 0), dot: "bg-emerald-500" },
          { label: "Bekor qilingan", value: String(data?.orders.cancelled ?? 0), dot: "bg-red-500" },
        ]}
      />
      <KPICard
        accent="violet"
        icon={Users}
        title="Mijozlar"
        value={`${fmt(data?.clients.total ?? 0)}`}
        suffix="ta"
        loading={loading}
        delay={0.1}
        rows={[
          { label: "Yangi mijozlar", value: String(data?.clients.new ?? 0), dot: "bg-blue-500" },
          { label: "Qaytgan mijozlar", value: String(data?.clients.returned ?? 0), dot: "bg-amber-500" },
          { label: "O'rtacha buyurtma", value: `${fmt(data?.clients.averageOrder ?? 0)} so'm`, dot: "bg-violet-500" },
        ]}
      />
    </div>
  );
}

function KPICard({
  accent, icon: Icon, title, value, suffix, rows, delay, loading,
}: {
  accent: "emerald" | "amber" | "violet";
  icon: React.ElementType;
  title: string;
  value: string;
  suffix?: string;
  rows: Array<{ label: string; value: string; dot: string; emphasize?: boolean }>;
  delay: number;
  loading: boolean;
}) {
  const accentMap = {
    emerald: { border: "border-t-emerald-500", iconBg: "bg-emerald-500/15", iconColor: "text-emerald-400" },
    amber: { border: "border-t-amber-500", iconBg: "bg-amber-500/15", iconColor: "text-amber-400" },
    violet: { border: "border-t-violet-500", iconBg: "bg-violet-500/15", iconColor: "text-violet-400" },
  };
  const a = accentMap[accent];
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={`bg-slate-900 border border-slate-800 border-t-2 ${a.border} rounded-xl p-5`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">
            {loading ? "…" : value}
            {suffix && <span className="text-sm font-normal text-slate-500 ml-1">{suffix}</span>}
          </p>
        </div>
        <div className={`w-10 h-10 rounded-xl ${a.iconBg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${a.iconColor}`} />
        </div>
      </div>
      <div className="space-y-2 pt-3 border-t border-slate-800">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${r.dot}`} />
              <span className="text-slate-400">{r.label}</span>
            </div>
            <span className={`${r.emphasize ? "text-emerald-400 font-semibold" : "text-slate-200"}`}>{r.value}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
