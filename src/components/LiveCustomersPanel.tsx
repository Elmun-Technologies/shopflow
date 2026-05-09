import { useEffect, useMemo, useState } from "react";
import { Loader2, Users, Search, Phone, RefreshCw, MessageCircle } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { useNotifications } from "../lib/notifications";

interface LiveCustomer {
  id: string;
  tgUserId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  createdAt: string | number;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: number | null;
}

export default function LiveCustomersPanel() {
  const { onShopEvent } = useNotifications();
  const [list, setList] = useState<LiveCustomer[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "spent" | "orders">("newest");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const d = await api.customers.list();
      setList(d);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Xato");
      setList([]);
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

  const filtered = useMemo(() => {
    if (!list) return [];
    const q = search.trim().toLowerCase();
    let arr = list.filter((c) => {
      if (!q) return true;
      return (
        (c.firstName ?? "").toLowerCase().includes(q) ||
        (c.lastName ?? "").toLowerCase().includes(q) ||
        (c.username ?? "").toLowerCase().includes(q) ||
        (c.phone ?? "").includes(q)
      );
    });
    if (sortBy === "spent") arr = [...arr].sort((a, b) => b.totalSpent - a.totalSpent);
    else if (sortBy === "orders") arr = [...arr].sort((a, b) => b.orderCount - a.orderCount);
    else arr = [...arr].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return arr;
  }, [list, search, sortBy]);

  const stats = useMemo(() => {
    if (!list) return { total: 0, withOrders: 0, totalRevenue: 0 };
    return {
      total: list.length,
      withOrders: list.filter((c) => c.orderCount > 0).length,
      totalRevenue: list.reduce((s, c) => s + c.totalSpent, 0),
    };
  }, [list]);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <div>
            <h3 className="text-white font-semibold">📱 Telegram mijozlar (real)</h3>
            <p className="text-xs text-slate-500">{stats.total} mijoz · {stats.withOrders} xarid qilgan · {stats.totalRevenue.toLocaleString()} so'm jami</p>
          </div>
        </div>
        <button onClick={load} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ism, username yoki telefon..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
          />
        </div>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm">
          <option value="newest">Yangilari</option>
          <option value="spent">Eng ko'p xarajat qilgan</option>
          <option value="orders">Eng ko'p buyurtmali</option>
        </select>
      </div>

      {error && <div className="p-4 text-amber-400 text-sm">⚠️ {error}</div>}

      {loading && !list ? (
        <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center">
          <Users className="w-12 h-12 mx-auto text-slate-700 mb-3" />
          <p className="text-slate-400 text-sm">Hali Telegram mijoz yo'q</p>
          <p className="text-slate-600 text-xs mt-1">Bot /start bosilganda yoki Mini App ochilganda mijozlar ro'yxatda paydo bo'ladi</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="bg-slate-900/50">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-6">Mijoz</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-3">Telegram</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-3">Telefon</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-3">Buyurtma</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-3">Xarajat</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-6">So'nggi xarid</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 50).map((c) => {
                const fullName = [c.firstName, c.lastName].filter(Boolean).join(" ") || c.username || "Mehmon";
                return (
                  <tr key={c.id} className="border-t border-slate-800 hover:bg-slate-800/30">
                    <td className="py-3 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-semibold text-xs">
                          {fullName[0]?.toUpperCase() ?? "?"}
                        </div>
                        <div>
                          <p className="text-sm text-white font-medium">{fullName}</p>
                          <p className="text-[10px] text-slate-500">Qo'shilgan: {new Date(c.createdAt).toLocaleDateString("uz-UZ")}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-sm text-slate-400">
                      {c.username ? (
                        <a href={`https://t.me/${c.username}`} target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 inline-flex items-center gap-1">
                          @{c.username} <MessageCircle className="w-3 h-3" />
                        </a>
                      ) : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="py-3 px-3 text-sm">
                      {c.phone ? (
                        <a href={`tel:${c.phone}`} className="text-slate-300 hover:text-emerald-400 inline-flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {c.phone}
                        </a>
                      ) : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="py-3 px-3 text-sm text-right">
                      <span className={c.orderCount > 0 ? "text-emerald-400 font-medium" : "text-slate-600"}>{c.orderCount}</span>
                    </td>
                    <td className="py-3 px-3 text-sm text-right">
                      <span className={c.totalSpent > 0 ? "text-white font-semibold" : "text-slate-600"}>
                        {c.totalSpent > 0 ? `${c.totalSpent.toLocaleString()} so'm` : "—"}
                      </span>
                    </td>
                    <td className="py-3 px-6 text-xs text-slate-400 text-right whitespace-nowrap">
                      {c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString("uz-UZ") : <span className="text-slate-600">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length > 50 && (
            <p className="text-center text-xs text-slate-500 py-3">Ko'rsatildi: 50/{filtered.length}</p>
          )}
        </div>
      )}
    </div>
  );
}
