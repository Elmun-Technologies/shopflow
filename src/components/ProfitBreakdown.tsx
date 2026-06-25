// Dashboard widget: Sof foyda / xarajatlar tarkibi (management ko'rinishi).
// Tadbirkor qancha SOF PUL topayotganini ko'radi:
//   daromad − yetkazib berish (deliveryPct%) − xizmat (servicePct%) = sof foyda.
// Faqat boshqaruv uchun — mijoz to'loviga ta'sir qilmaydi.

import { TrendingUp, Truck, Wrench, Wallet } from "lucide-react";
import { useQueryAsync } from "../hooks/useQueryAsync";
import { dashboardApi } from "../api/endpoints";
import { useAuth } from "../contexts/AuthContext";
import { useT } from "../i18n";
import { formatCurrency } from "../utils/format";

export default function ProfitBreakdown() {
  const { t } = useT();
  const { tenant } = useAuth();
  const { data, loading } = useQueryAsync(["dashboard", "kpis"], () => dashboardApi.kpis());

  const currency = tenant?.currency ?? "UZS";
  const dPct = tenant?.deliveryPct ?? 3;
  const sPct = tenant?.servicePct ?? 15;
  const revenue = Number(data?.revenue?.value ?? 0);
  const delivery = Math.round((revenue * dPct) / 100);
  const service = Math.round((revenue * sPct) / 100);
  const net = revenue - delivery - service;

  const tiles = [
    { icon: TrendingUp, label: t("profit.revenue"), value: formatCurrency(revenue, currency), highlight: false },
    { icon: Truck, label: `${t("pricing.delivery")} (${dPct}%)`, value: `− ${formatCurrency(delivery, currency)}`, highlight: false },
    { icon: Wrench, label: `${t("pricing.service")} (${sPct}%)`, value: `− ${formatCurrency(service, currency)}`, highlight: false },
    { icon: Wallet, label: t("profit.net"), value: formatCurrency(net, currency), highlight: true },
  ];

  return (
    <div className="bg-white border border-cream-300 rounded-2xl p-5 mt-4">
      <h3 className="text-sm font-semibold text-forest-800">{t("profit.title")}</h3>
      <p className="text-xs text-slate-400 mb-4">{t("profit.subtitle")}</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map((tile, i) => {
          const Icon = tile.icon;
          return (
            <div
              key={i}
              className={`rounded-xl p-3.5 border ${
                tile.highlight ? "bg-leaf-100 border-leaf-200" : "bg-cream-50 border-cream-300"
              }`}
            >
              <div
                className={`flex items-center gap-1.5 text-xs mb-2 ${
                  tile.highlight ? "text-forest-700" : "text-slate-500"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tile.label}</span>
              </div>
              <div
                className={`tabular-nums ${
                  tile.highlight ? "text-lg font-bold text-forest-800" : "text-sm font-semibold text-forest-700"
                }`}
              >
                {loading ? "…" : tile.value}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
