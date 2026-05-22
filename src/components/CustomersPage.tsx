import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, Plus, Loader2, Users, Mail, Phone, MapPin, AlertCircle, Download } from "lucide-react";
import { exportToCsv } from "../utils/exportCsv";
import { TableRowsSkeleton } from "./ui/Skeleton";
import { useAsync } from "../hooks/useAsync";
import { customersApi } from "../api/endpoints";
import { formatDate } from "../utils/format";
import { useT } from "../i18n";
import CustomerDetailDrawer from "./CustomerDetailDrawer";

export default function CustomersPage() {
  const { t } = useT();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 30;
  const [openCustomerId, setOpenCustomerId] = useState<string | null>(null);

  const params = useMemo(
    () => ({ page, pageSize, search: search || undefined }),
    [page, search],
  );
  const { data, loading, error, refetch } = useAsync(() => customersApi.list(params), [page, search]);

  const customers = data?.items ?? [];
  const total = data?.total ?? 0;
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await customersApi.list({ search: search || undefined, page: 1, pageSize: 500 });
      exportToCsv({
        filename: `customers-${new Date().toISOString().slice(0, 10)}`,
        columns: [
          { key: "name", label: t("customers.col.customer") },
          { key: "phone", label: "Phone" },
          { key: "email", label: "Email" },
          { key: "location", label: t("customers.col.location") },
          { key: "tags", label: "Tags" },
          { key: "createdAt", label: t("customers.col.date") },
        ],
        rows: res.items.map((c) => ({
          name: c.name,
          phone: c.phone ?? "",
          email: c.email ?? "",
          location: c.location ?? "",
          tags: c.tags.join("; "),
          createdAt: c.createdAt,
        })),
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-white">{t("customers.title")}</h1>
        <p className="text-sm text-slate-500 mt-1">{t("customers.subtitle")}</p>
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
            placeholder={t("customers.searchPlaceholder")}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
          />
        </label>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center justify-center gap-2 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-white transition-all flex-shrink-0 disabled:opacity-50"
          title={t("orders.export")}
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          <span className="hidden sm:inline">{t("orders.export")}</span>
        </button>
        <button
          type="button"
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-sm font-medium text-white transition-all flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">{t("customers.newCustomer")}</span>
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <TableRowsSkeleton rows={8} cols={4} />
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <AlertCircle className="w-10 h-10 text-red-400 mb-2" />
            <p className="text-sm text-slate-300">{error.message}</p>
            <button onClick={refetch} className="mt-3 px-3 py-1.5 text-xs bg-slate-800 rounded-lg text-slate-300">
              {t("orders.retry")}
            </button>
          </div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <Users className="w-12 h-12 text-slate-700 mb-3" />
            <p className="text-base font-semibold text-white">
              {search ? t("customers.empty.search") : t("customers.empty.none")}
            </p>
            <p className="text-sm text-slate-500 mt-1 max-w-md">
              {t("customers.empty.hint")}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop — jadval */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">{t("customers.col.customer")}</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">{t("customers.col.contact")}</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">{t("customers.col.location")}</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">{t("customers.col.date")}</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors cursor-pointer"
                      onClick={() => setOpenCustomerId(c.id)}
                    >
                      <td className="py-3 px-4">
                        <p className="text-sm font-medium text-white">{c.name}</p>
                        {c.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {c.tags.slice(0, 3).map((tag) => (
                              <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-0.5">
                          {c.email && (
                            <span className="flex items-center gap-1 text-xs text-slate-400">
                              <Mail className="w-3 h-3" /> {c.email}
                            </span>
                          )}
                          {c.phone && (
                            <span className="flex items-center gap-1 text-xs text-slate-400">
                              <Phone className="w-3 h-3" /> {c.phone}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {c.location && (
                          <span className="flex items-center gap-1 text-xs text-slate-400">
                            <MapPin className="w-3 h-3" /> {c.location}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs text-slate-500">{formatDate(c.createdAt)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile — card */}
            <div className="md:hidden divide-y divide-slate-800/50">
              {customers.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setOpenCustomerId(c.id)}
                  className="w-full text-left p-4 hover:bg-slate-800/30 active:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white truncate">{c.name}</p>
                      {c.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {c.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      {(c.phone || c.email) && (
                        <p className="text-xs text-slate-400 mt-1 truncate">{c.phone ?? c.email}</p>
                      )}
                      {c.location && (
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{c.location}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 flex-shrink-0">{formatDate(c.createdAt)}</span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {total > pageSize && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 text-xs text-slate-500">
            <span>
              {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} / {total}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30"
              >
                {t("orders.prev")}
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page * pageSize >= total}
                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30"
              >
                {t("orders.next")}
              </button>
            </div>
          </div>
        )}
      </div>

      <CustomerDetailDrawer
        customerId={openCustomerId}
        onClose={() => setOpenCustomerId(null)}
        onChanged={refetch}
      />
    </>
  );
}
