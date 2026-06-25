// Kanal manbalari — modern progress-bar uslubidagi ro'yxat.
// Recharts'siz, faqat CSS + width animation. Sof, kichik va o'qish oson.

import { motion } from "framer-motion";
import { Loader2, Radio } from "lucide-react";
import { useQueryAsync } from "../hooks/useQueryAsync";
import { dashboardApi } from "../api/endpoints";
import { useT } from "../i18n";

const COLORS = [
  "from-leaf-500 to-leaf-400",
  "from-sky-500 to-sky-400",
  "from-amber-500 to-amber-400",
  "from-violet-500 to-violet-400",
  "from-pink-500 to-pink-400",
  "from-forest-600 to-forest-500",
  "from-rose-500 to-rose-400",
];

export default function TrafficSources() {
  const { t } = useT();
  const { data, loading } = useQueryAsync(["dashboard", "trafficSources"], () => dashboardApi.trafficSources());
  const sources = data ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.7 }}
      className="bg-white border border-cream-300/80 rounded-2xl p-5"
    >
      <h3 className="text-base font-semibold text-forest-800 flex items-center gap-2">
        <Radio className="w-4 h-4 text-forest-700" />
        {t("widget.trafficSources")}
      </h3>
      <p className="text-xs text-slate-500 mt-0.5 mb-4">{t("widget.trafficSources.subtitle")}</p>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
        </div>
      ) : sources.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-center">
          <p className="text-sm text-slate-500">{t("widget.trafficSources.empty")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sources.slice(0, 6).map((s, index) => (
            <motion.div
              key={`${s.channelId ?? index}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.7 + index * 0.05 }}
              className="space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-700 font-medium truncate">{s.source}</span>
                <div className="flex items-baseline gap-2 flex-shrink-0">
                  <span className="text-sm font-semibold text-forest-800">{s.visitors}</span>
                  <span className="text-[10px] text-slate-500">{s.percentage}%</span>
                </div>
              </div>
              <div className="h-1.5 bg-cream-100/60 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${s.percentage}%` }}
                  transition={{ duration: 0.7, delay: 0.7 + index * 0.05, ease: "easeOut" }}
                  className={`h-full bg-gradient-to-r ${COLORS[index % COLORS.length]} rounded-full`}
                />
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
