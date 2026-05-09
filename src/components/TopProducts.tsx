import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Package, Loader2, TrendingUp } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { useNotifications } from "../lib/notifications";

interface TopProduct {
  productId: string | null;
  productName: string;
  totalSold: number;
  totalRevenue: number;
  orderCount: number;
}

export default function TopProducts() {
  const { onShopEvent } = useNotifications();
  const [products, setProducts] = useState<TopProduct[] | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const d = await api.analytics.topProducts(8);
      setProducts(d);
    } catch (err) {
      if (err instanceof ApiError) console.warn("Top products:", err.message);
      setProducts([]);
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.8 }}
      className="bg-slate-900 border border-slate-800 rounded-xl p-5"
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-base font-semibold text-white">Eng ko'p sotiladigan</h3>
          <p className="text-sm text-slate-500 mt-0.5">Telegram bot orqali kelgan haqiqiy ma'lumot</p>
        </div>
        <TrendingUp className="w-5 h-5 text-emerald-400" />
      </div>

      {loading && !products ? (
        <div className="h-32 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-600" /></div>
      ) : !products || products.length === 0 ? (
        <p className="text-center text-sm text-slate-500 py-8">Hali sotilgan mahsulot yo'q</p>
      ) : (
        <div className="space-y-3">
          {products.map((product, index) => (
            <motion.div
              key={product.productId ?? product.productName}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0">
                {index + 1}
              </div>
              <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center flex-shrink-0">
                <Package className="w-4 h-4 text-slate-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{product.productName}</p>
                <p className="text-xs text-slate-500">{product.orderCount} buyurtma · {product.totalSold} dona</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-emerald-400">{product.totalRevenue.toLocaleString()}</p>
                <p className="text-[10px] text-slate-500">so'm</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
