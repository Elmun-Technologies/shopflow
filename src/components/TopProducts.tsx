import { motion } from "framer-motion";
import { Package, Loader2, TrendingUp } from "lucide-react";
import { useAsync } from "../hooks/useAsync";
import { dashboardApi } from "../api/endpoints";
import { useAuth } from "../contexts/AuthContext";
import { formatCurrency } from "../utils/format";
import { useT } from "../i18n";

export default function TopProducts() {
  const { tenant } = useAuth();
  const { t } = useT();
  const currency = tenant?.currency ?? "UZS";
  const { data, loading } = useAsync(() => dashboardApi.topProducts(), []);
  const products = data ?? [];

  const maxSold = products.length > 0 ? Math.max(...products.map((p) => p.sold)) : 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.6 }}
      className="bg-white border border-cream-300/80 rounded-2xl p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-forest-800 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-forest-700" />
            {t("widget.topProducts")}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">{t("widget.topProducts.subtitle")}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Package className="w-8 h-8 text-cream-300 mb-2" />
          <p className="text-sm text-slate-500">{t("widget.topProducts.empty")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((product, index) => {
            const pct = (product.sold / maxSold) * 100;
            return (
              <motion.div
                key={product.id ?? index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="space-y-1.5 group"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="text-[10px] font-bold text-slate-400 w-4 text-center">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-forest-800 truncate">{product.name}</p>
                      <p className="text-[11px] text-slate-500 truncate">{product.category ?? "—"}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-forest-700">{product.sold}</p>
                    <p className="text-[11px] text-slate-500">{formatCurrency(product.price, currency)}</p>
                  </div>
                </div>
                {/* Progress bar — sotuv miqdoriga proportsional */}
                <div className="h-1 bg-cream-100/60 rounded-full overflow-hidden ml-7">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, delay: 0.6 + index * 0.05, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-leaf-500 to-leaf-400 rounded-full"
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
