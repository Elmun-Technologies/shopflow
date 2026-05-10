import { useEffect, useState } from "react";
import { Loader2, Users, MessageCircle } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useNotifications } from "../../lib/notifications";

interface TopCustomer {
  id: string; name: string; username: string | null; phone: string | null;
  totalSpent: number; orderCount: number; lastOrderAt: number;
}

export default function Top10Customers() {
  const { onShopEvent } = useNotifications();
  const [data, setData] = useState<TopCustomer[] | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setData(await api.analytics.topCustomers(10));
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
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-white">Top 10 mijoz</h3>
        <p className="text-xs text-slate-500 mt-0.5">Eng ko'p xarajat qilgan mijozlar</p>
      </div>

      {loading && !data ? (
        <div className="h-48 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-600" /></div>
      ) : !data || data.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-12 h-12 mx-auto text-slate-700 mb-3" />
          <p className="text-slate-500 text-sm">Hali mijoz yo'q</p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-5">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-2">#</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-3 py-2">Mijoz</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-3 py-2">Telefon</th>
                <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wider px-3 py-2">Buyurtma</th>
                <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-2">Xarajat</th>
              </tr>
            </thead>
            <tbody>
              {data.map((c, i) => (
                <tr key={c.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-5 py-3 text-sm text-slate-500">{i + 1}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-semibold text-xs shrink-0">
                        {c.name[0]?.toUpperCase() ?? "?"}
                      </div>
                      <div>
                        <p className="text-sm text-white">{c.name}</p>
                        {c.username && (
                          <a href={`https://t.me/${c.username}`} target="_blank" rel="noopener noreferrer" className="text-[11px] text-slate-500 hover:text-emerald-400 inline-flex items-center gap-0.5">
                            @{c.username} <MessageCircle className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-sm text-slate-300">
                    {c.phone ? <a href={`tel:${c.phone}`} className="hover:text-emerald-400">{c.phone}</a> : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-3 py-3 text-sm font-medium text-white text-right">{c.orderCount}</td>
                  <td className="px-5 py-3 text-sm font-semibold text-emerald-400 text-right whitespace-nowrap">{c.totalSpent.toLocaleString()} so'm</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
