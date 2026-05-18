import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, Plus, Loader2, Package, AlertCircle } from "lucide-react";
import { useAsync } from "../hooks/useAsync";
import { productsApi } from "../api/endpoints";
import { useAuth } from "../contexts/AuthContext";
import { formatCurrency } from "../utils/format";

export default function ProductsPage() {
  const { tenant } = useAuth();
  const currency = tenant?.currency ?? "UZS";
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 24;

  const params = useMemo(
    () => ({ page, pageSize, search: search || undefined }),
    [page, search],
  );
  const { data, loading, error, refetch } = useAsync(() => productsApi.list(params), [page, search]);

  const products = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-bold text-white">Mahsulotlar</h1>
        <p className="text-sm text-slate-500 mt-1">Katalog va omborlar</p>
      </motion.div>

      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <label className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Mahsulot nomi yoki SKU..."
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
          />
        </label>
        <button
          type="button"
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-sm font-medium text-white transition-all"
        >
          <Plus className="w-4 h-4" />
          Yangi mahsulot
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-slate-600 animate-spin" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center bg-slate-900 border border-slate-800 rounded-xl">
          <AlertCircle className="w-10 h-10 text-red-400 mb-2" />
          <p className="text-sm text-slate-300">{error.message}</p>
          <button onClick={refetch} className="mt-3 px-3 py-1.5 text-xs bg-slate-800 rounded-lg text-slate-300">
            Qaytadan urinish
          </button>
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center bg-slate-900 border border-slate-800 rounded-xl">
          <Package className="w-12 h-12 text-slate-700 mb-3" />
          <p className="text-base font-semibold text-white">
            {search ? "Mahsulot topilmadi" : "Hozircha mahsulotlar yo'q"}
          </p>
          <p className="text-sm text-slate-500 mt-1 max-w-md">
            "Yangi mahsulot" tugmasi orqali birinchi mahsulotingizni qo'shing.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map((p) => (
            <div
              key={p.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors"
            >
              <div className="w-full aspect-video bg-slate-800 rounded-lg flex items-center justify-center mb-3">
                <Package className="w-8 h-8 text-slate-600" />
              </div>
              <p className="text-xs text-slate-500 uppercase tracking-wider">{p.sku}</p>
              <p className="text-sm font-semibold text-white truncate mt-0.5">{p.name}</p>
              <p className="text-xs text-slate-500 mt-1">{p.category?.name ?? "Kategoriyasiz"}</p>
              <div className="flex items-center justify-between mt-3">
                <span className="text-base font-bold text-white">
                  {formatCurrency(Number(p.price), p.currency || currency)}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-md ${
                    p.stock > 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                  }`}
                >
                  Ombor: {p.stock}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {total > pageSize && (
        <div className="flex items-center justify-between mt-4 text-xs text-slate-500">
          <span>
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} / {total}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30"
            >
              Oldingi
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page * pageSize >= total}
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30"
            >
              Keyingi
            </button>
          </div>
        </div>
      )}
    </>
  );
}
