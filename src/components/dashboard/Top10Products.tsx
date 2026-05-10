import { useEffect, useState } from "react";
import { Loader2, Package } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useNotifications } from "../../lib/notifications";

interface TopProduct { productId: string | null; productName: string; totalSold: number; totalRevenue: number; orderCount: number }

export default function Top10Products() {
  const { onShopEvent } = useNotifications();
  const [data, setData] = useState<TopProduct[] | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setData(await api.analytics.topProducts(10));
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

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 h-full">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-white">Top 10 mahsulot</h3>
        <p className="text-xs text-slate-500 mt-0.5">Eng ko'p sotilgan</p>
      </div>

      {loading && !data ? (
        <div className="h-48 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-600" /></div>
      ) : !data || data.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-12 h-12 mx-auto text-slate-700 mb-3" />
          <p className="text-slate-500 text-sm">Top mahsulot yo'q</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((p, i) => (
            <div key={p.productId ?? p.productName} className="flex items-center gap-3 py-2 border-b border-slate-800 last:border-0">
              <div className={`w-6 h-6 rounded-md text-[10px] font-bold flex items-center justify-center shrink-0 ${
                i === 0 ? "bg-amber-500/20 text-amber-400" :
                i === 1 ? "bg-slate-500/20 text-slate-300" :
                i === 2 ? "bg-orange-500/20 text-orange-400" :
                "bg-slate-800 text-slate-500"
              }`}>
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{p.productName}</p>
                <p className="text-[10px] text-slate-500">{p.orderCount} buyurtma · {p.totalSold} dona</p>
              </div>
              <p className="text-sm text-emerald-400 font-semibold shrink-0">{p.totalRevenue.toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
