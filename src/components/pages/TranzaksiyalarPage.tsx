import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, Download, Filter, Workflow } from "lucide-react";
import type { LoyaltyTransaction, TransactionType } from "../../data/marketingData";
import { initialTransactions, transactionTypeLabels } from "../../data/marketingData";
import EmptyState from "../EmptyState";

const thClass = "text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-3";
const tdClass = "py-3 px-3 text-sm text-slate-200 border-t border-slate-800";

function TransactionTypeBadge({ type }: { type: TransactionType }) {
  const map: Record<TransactionType, string> = {
    earn: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    spend: "bg-orange-500/15 text-orange-400 border border-orange-500/30",
    expire: "bg-red-500/15 text-red-400 border border-red-500/30",
    manual_add: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
    manual_remove: "bg-slate-700 text-slate-300",
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full border ${map[type]}`}>{transactionTypeLabels[type]}</span>;
}

export default function TranzaksiyalarPage() {
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>(initialTransactions);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<TransactionType | "all">("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((t) => {
      const matchesSearch = !q || t.customerName.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
      const matchesType = filterType === "all" || t.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [transactions, search, filterType]);

  const stats = useMemo(() => {
    const earned = transactions.filter((t) => t.type === "earn").reduce((s, t) => s + t.points, 0);
    const spent = transactions.filter((t) => t.type === "spend").reduce((s, t) => s + Math.abs(t.points), 0);
    const totalTransactions = transactions.length;
    return { earned, spent, totalTransactions };
  }, [transactions]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Ball tranzaksiyalari</h1>
          <p className="text-sm text-slate-500 mt-1">Sodiqlik ball movaffaqiyatlari va operatsiyalari</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">Jami operatsiyalar</p>
            <p className="text-lg font-semibold text-white">{stats.totalTransactions}</p>
          </div>
          <div className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">Olingan ball</p>
            <p className="text-lg font-semibold text-emerald-400">+{stats.earned}</p>
          </div>
          <div className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">Sarflangan ball</p>
            <p className="text-lg font-semibold text-orange-400">-{stats.spent}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Qidirish..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 pl-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as TransactionType | "all")}
            className="px-3 py-2 rounded-lg text-sm bg-slate-800 text-slate-300 border border-slate-700 focus:outline-none focus:border-emerald-500/50"
          >
            <option value="all">Barcha turlar</option>
            <option value="earn">Olingan balllar</option>
            <option value="spend">Sarflangan balllar</option>
            <option value="expire">Muddati o'tgan</option>
            <option value="manual_add">Qo'lda qo'shilgan</option>
            <option value="manual_remove">Qo'lda ayirilgan</option>
          </select>
          <button className="px-4 py-2 rounded-lg text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 inline-flex items-center gap-2 font-medium">
            <Download className="w-4 h-4" />
            Yuklab olish
          </button>
        </div>
      </div>

      {transactions.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
          <EmptyState
            icon={Workflow}
            title="Hali tranzaksiya yo'q"
            description="Sodiqlik dasturi ball operatsiyalari bu yerda ko'rinadi. Qoidalar yarating va xaridorlarga ball bering."
            buttonText="Sodiqlik dasturiga o'tish"
            onButtonClick={() => {}}
            iconColor="text-indigo-400"
          />
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
          <table className="w-full min-w-[900px]">
            <thead className="bg-slate-900/80">
              <tr>
                <th className={thClass}>Foydalanuvchi</th>
                <th className={thClass}>Turi</th>
                <th className={thClass}>Balllar</th>
                <th className={thClass}>Balans</th>
                <th className={thClass}>Tavsifi</th>
                <th className={thClass}>Buyurtma ID</th>
                <th className={thClass}>Sana</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 text-sm">
                    Ma'lumot topilmadi
                  </td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/40">
                    <td className={tdClass + " font-medium"}>{t.customerName}</td>
                    <td className={tdClass}><TransactionTypeBadge type={t.type} /></td>
                    <td className={tdClass + (t.points >= 0 ? " text-emerald-400" : " text-orange-400")}>
                      {t.points >= 0 ? "+" : ""}{t.points}
                    </td>
                    <td className={tdClass}>{t.balance}</td>
                    <td className={tdClass + " text-xs max-w-xs truncate"}>{t.description}</td>
                    <td className={tdClass + " text-xs text-slate-400"}>{t.orderId || "—"}</td>
                    <td className={tdClass + " text-xs text-slate-400"}>{t.createdAt}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </motion.div>
      )}

      {filtered.length > 0 && (
        <div className="text-xs text-slate-500 text-center">
          {filtered.length} ta operatsiya ko'rsatilmoqda
        </div>
      )}
    </div>
  );
}
