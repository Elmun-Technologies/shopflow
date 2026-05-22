import { motion } from "framer-motion";
import { Package, Loader2 } from "lucide-react";
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.8 }}
      className="bg-slate-900 border border-slate-800 rounded-xl p-5"
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-base font-semibold text-white">{t("widget.topProducts")}</h3>
          <p className="text-sm text-slate-500 mt-0.5">{t("widget.topProducts.subtitle")}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-slate-600 animate-spin" />
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Package className="w-8 h-8 text-slate-700 mb-2" />
          <p className="text-sm text-slate-500">{t("widget.topProducts.empty")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((product, index) => (
            <motion.div
              key={product.id ?? index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors group"
            >
              <div className="w-12 h-12 bg-slate-700 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-slate-600 transition-colors">
                <Package className="w-5 h-5 text-slate-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{product.name}</p>
                <p className="text-xs text-slate-500">{product.category ?? "—"}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-semibold text-white">{formatCurrency(product.price, currency)}</p>
                <p className="text-xs text-slate-500 mt-0.5">Ombor: {product.stock}</p>
              </div>
              <div className="text-right flex-shrink-0 w-16">
                <p className="text-xs text-slate-400">Sotildi</p>
                <p className="text-sm font-medium text-emerald-400">{product.sold}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
