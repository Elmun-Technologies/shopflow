// Dashboard widget: kam qolgan mahsulotlar ogohlantirishi.
// Stock < threshold (default 5) bo'lgan mahsulotlarni ko'rsatadi.
// Click → Products sahifaga "lowStock" filter bilan ochiladi.

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Package, ArrowRight, Loader2 } from "lucide-react";
import { productsApi } from "../api/endpoints";
import type { Product } from "../types/api";
import { useT } from "../i18n";

const LOW_STOCK_THRESHOLD = 5;

interface Props {
  onOpenProducts?: () => void;
}

export default function LowStockAlert({ onOpenProducts }: Props) {
  const { t } = useT();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [outCount, setOutCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Eng ko'p 100 ta mahsulot — yetarli kichkina katalog uchun.
        // Katta katalog'da backend lowStock filter qo'shilishi kerak.
        const res = await productsApi.list({ pageSize: 100 });
        if (cancelled) return;
        const all = res.items;
        const lowStock = all
          .filter((p) => p.active !== false && p.stock <= LOW_STOCK_THRESHOLD)
          .sort((a, b) => a.stock - b.stock);
        setProducts(lowStock.slice(0, 5));
        setOutCount(all.filter((p) => p.active !== false && p.stock === 0).length);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Hech narsa low stock emas — widget'ni ko'rsatmaymiz
  if (!loading && products.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.45 }}
      className="bg-white rounded-2xl overflow-hidden"
      style={{ border: "1px solid #eaeae0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-0.5"
        style={{ backgroundColor: "#f59e0b" }}
      />
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div
              className="flex items-center justify-center rounded-xl"
              style={{ width: 36, height: 36, backgroundColor: "rgba(245,158,11,0.1)" }}
            >
              <AlertTriangle style={{ width: 18, height: 18, color: "#f59e0b" }} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-forest-800">{t("lowStock.title")}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {outCount > 0 ? (
                  <>
                    <span className="text-red-600 font-semibold">{t("lowStock.out", { count: outCount })}</span>
                    {" · "}
                    {t("lowStock.attention", { count: products.length })}
                  </>
                ) : (
                  t("lowStock.runningOut", { count: products.length })
                )}
              </p>
            </div>
          </div>
          {onOpenProducts && (
            <button
              onClick={onOpenProducts}
              className="text-xs font-medium text-forest-700 hover:text-forest-900 flex items-center gap-1 flex-shrink-0"
            >
              {t("lowStock.all")}
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            {products.map((p, i) => (
              <motion.button
                key={p.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.5 + i * 0.04 }}
                onClick={onOpenProducts}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-cream-50 hover:bg-cream-100 transition-colors text-left group"
              >
                <div className="w-9 h-9 rounded-lg bg-cream-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-4 h-4 text-slate-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-forest-800 truncate">{p.name}</p>
                  <p className="text-[11px] text-slate-500 truncate">{p.sku}</p>
                </div>
                <div className="flex-shrink-0">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      p.stock === 0
                        ? "bg-red-100 text-red-600"
                        : p.stock <= 2
                        ? "bg-amber-100 text-amber-600"
                        : "bg-cream-100 text-slate-700"
                    }`}
                  >
                    {p.stock === 0 ? t("lowStock.outBadge") : t("lowStock.leftBadge", { count: p.stock })}
                  </span>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
