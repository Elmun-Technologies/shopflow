// Sales Overview — yarim doira (half-donut) gauge.
// Daromad o'sishini ("Sales Growth") vizual ko'rsatadi. Commerly uslubida.

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";
import { dashboardApi } from "../api/endpoints";
import { useT } from "../i18n";

// O'sish foizini 0..100 shkalaga moslash (gauge to'ldirilishi uchun).
// -50%..+50% oraliqni 0..100 ga xaritalaymiz; tashqarisi clamp bo'ladi.
function growthToPercent(change: number): number {
  const clamped = Math.max(-50, Math.min(50, change));
  return ((clamped + 50) / 100) * 100;
}

export default function SalesGauge() {
  const { t, lang } = useT();
  const [change, setChange] = useState<number | null>(null);
  const [revenue, setRevenue] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    dashboardApi
      .kpis()
      .then((k) => {
        if (cancelled) return;
        setChange(k.revenue.change);
        setRevenue(k.revenue.value);
      })
      .catch(() => { /* sokin */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const pct = change === null ? 0 : growthToPercent(change);
  const positive = (change ?? 0) >= 0;

  // Yarim doira: radius 80, markaz (100,100), 180° (chapdan o'ngga)
  const R = 80;
  const CIRC = Math.PI * R; // yarim doira uzunligi
  const dash = (pct / 100) * CIRC;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="bg-white rounded-2xl p-5"
      style={{ border: "1px solid #eaeae0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-semibold text-forest-800">{t("gauge.title")}</h3>
        {change !== null && (
          <span
            className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
              positive ? "bg-leaf-100 text-forest-700" : "bg-red-100 text-red-600"
            }`}
          >
            {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {positive ? "+" : ""}{change.toFixed(1)}%
          </span>
        )}
      </div>

      <div className="relative flex items-end justify-center" style={{ height: 130 }}>
        <svg viewBox="0 0 200 110" className="w-full max-w-[260px]">
          <defs>
            <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#A3D977" />
              <stop offset="100%" stopColor="#5FA340" />
            </linearGradient>
          </defs>
          {/* Fon yoyi */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="#EFEFE6"
            strokeWidth="16"
            strokeLinecap="round"
          />
          {/* To'ldirilgan yoy */}
          <motion.path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke={positive ? "url(#gaugeGrad)" : "#ef4444"}
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            initial={{ strokeDashoffset: CIRC }}
            animate={{ strokeDashoffset: loading ? CIRC : CIRC - dash }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </svg>
        {/* Markaziy ko'rsatkich */}
        <div className="absolute inset-x-0 bottom-1 flex flex-col items-center">
          <span className="text-3xl font-bold text-forest-800">
            {change === null ? "—" : `${positive ? "+" : ""}${change.toFixed(0)}%`}
          </span>
          <span className="text-[11px] text-slate-500">{t("gauge.growth")}</span>
        </div>
      </div>

      <div className="mt-2 pt-3 border-t border-cream-300 flex items-center justify-between">
        <span className="text-xs text-slate-500">{t("gauge.thisPeriod")}</span>
        <span className="text-sm font-semibold text-forest-800">
          {new Intl.NumberFormat(lang === "ru" ? "ru-RU" : "uz-UZ").format(revenue)} {t("gauge.currency")}
        </span>
      </div>
    </motion.div>
  );
}
