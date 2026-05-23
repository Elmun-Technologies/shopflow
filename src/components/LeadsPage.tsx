import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Plus,
  Loader2,
  Inbox,
  Phone,
  Mail,
  MessageSquare,
  Eye,
  AlertCircle,
  Download,
} from "lucide-react";
import { useAsync } from "../hooks/useAsync";
import { leadsApi } from "../api/endpoints";
import { exportToCsv } from "../utils/exportCsv";
import { TableRowsSkeleton } from "./ui/Skeleton";
import { useAuth } from "../contexts/AuthContext";
import { formatCompactCurrency, formatRelative } from "../utils/format";
import type { Lead, LeadStatus, ChannelType } from "../types/api";
import { useT } from "../i18n";
import LeadDetailModal from "./LeadDetailModal";

// Faqat rangli stillar — label'lar t() orqali olinadi
const statusStyle: Record<LeadStatus, { color: string; bg: string }> = {
  NEW: { color: "text-sky-600", bg: "bg-sky-100 border-sky-300" },
  CONTACTED: { color: "text-amber-500", bg: "bg-amber-100 border-amber-300" },
  QUALIFIED: { color: "text-violet-600", bg: "bg-violet-100 border-violet-300" },
  PROPOSAL: { color: "text-cyan-600", bg: "bg-cyan-100 border-cyan-500/20" },
  NEGOTIATION: { color: "text-orange-600", bg: "bg-orange-100 border-orange-300" },
  WON: { color: "text-forest-700", bg: "bg-leaf-100 border-leaf-300/60" },
  LOST: { color: "text-rose-600", bg: "bg-rose-100 border-rose-300" },
};

export default function LeadsPage() {
  const { tenant } = useAuth();
  const { t } = useT();
  const currency = tenant?.currency ?? "UZS";
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [detailLeadId, setDetailLeadId] = useState<string | null>(null);

  const listParams = useMemo(
    () => ({
      page,
      pageSize,
      search: search || undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
    }),
    [page, search, statusFilter],
  );

  const { data, loading, error, refetch } = useAsync(() => leadsApi.list(listParams), [
    page,
    search,
    statusFilter,
  ]);
  const { data: stats } = useAsync(() => leadsApi.stats(), []);

  const leads = data?.items ?? [];
  const total = data?.total ?? 0;
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await leadsApi.list({
        page: 1,
        pageSize: 500,
        search: search || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
      });
      exportToCsv({
        filename: `leads-${new Date().toISOString().slice(0, 10)}`,
        columns: [
          { key: "code", label: "Code" },
          { key: "name", label: t("leads.col.lead") },
          { key: "phone", label: "Phone" },
          { key: "email", label: "Email" },
          { key: "channel", label: t("leads.col.channel") },
          { key: "status", label: t("leads.col.status") },
          { key: "value", label: t("leads.col.value") },
          { key: "createdAt", label: t("leads.col.date") },
        ],
        rows: res.items.map((l) => ({
          code: l.code,
          name: l.name,
          phone: l.phone ?? "",
          email: l.email ?? "",
          channel: l.channel?.name ?? "",
          status: t(`leads.status.${l.status}`),
          value: Number(l.value),
          createdAt: l.createdAt,
        })),
      });
    } finally {
      setExporting(false);
    }
  };

  const statusButtons: ({ key: LeadStatus | "all"; label: string })[] = [
    { key: "all", label: t("leads.tab.all") },
    { key: "NEW", label: t("leads.status.NEW") },
    { key: "CONTACTED", label: t("leads.status.CONTACTED") },
    { key: "QUALIFIED", label: t("leads.status.QUALIFIED") },
    { key: "NEGOTIATION", label: t("leads.status.NEGOTIATION") },
    { key: "WON", label: t("leads.status.WON") },
    { key: "LOST", label: t("leads.status.LOST") },
  ];

  const statusCount = (status: LeadStatus): number =>
    stats?.byStatus.find((s) => s.status === status)?.count ?? 0;

  return (
    <>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-forest-800">{t("leads.title")}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {t("leads.subtitle")}
        </p>
      </motion.div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard label={t("leads.kpi.total")} value={total.toString()} accent="text-forest-800" />
        <StatCard
          label={t("leads.kpi.new")}
          value={statusCount("NEW").toString()}
          accent="text-sky-600"
        />
        <StatCard
          label={t("leads.kpi.won")}
          value={statusCount("WON").toString()}
          accent="text-forest-700"
        />
        <StatCard
          label={t("leads.kpi.wonValue")}
          value={formatCompactCurrency(stats?.wonValue ?? 0, currency)}
          accent="text-forest-700"
        />
      </div>

      {/* Channel breakdown */}
      {stats && stats.byChannel.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-5">
          {stats.byChannel.slice(0, 6).map((ch) => (
            <div
              key={ch.channelId ?? "none"}
              className="bg-white border border-cream-300 rounded-lg p-3"
            >
              <p className="text-[10px] text-slate-500 uppercase truncate">
                {ch.channel?.name ?? t("leads.kpi.otherChannel")}
              </p>
              <p className="text-lg font-bold text-forest-800 mt-1">{ch.count}</p>
              <p className="text-[10px] text-slate-500 truncate">
                {formatCompactCurrency(ch.value, currency)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
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
            placeholder={t("leads.searchPlaceholder")}
            className="w-full bg-white border border-cream-300 rounded-lg pl-10 pr-4 py-2.5 text-sm text-forest-800 placeholder-slate-400 focus:outline-none focus:border-leaf-500/60"
          />
        </label>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center justify-center gap-2 px-3 py-2.5 bg-cream-100 hover:bg-cream-200 border border-cream-300 rounded-lg text-sm text-forest-800 transition-all flex-shrink-0 disabled:opacity-50"
          title={t("orders.export")}
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          <span className="hidden sm:inline">{t("orders.export")}</span>
        </button>
        <button
          type="button"
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-leaf-400 hover:bg-leaf-500 rounded-lg text-sm font-medium text-forest-800 transition-all flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">{t("leads.newLead")}</span>
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0">
        {statusButtons.map((b) => (
          <button
            key={b.key}
            type="button"
            onClick={() => {
              setStatusFilter(b.key);
              setPage(1);
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all ${
              statusFilter === b.key
                ? "bg-leaf-400 text-forest-800"
                : "bg-white border border-cream-300 text-slate-500 hover:text-forest-900"
            }`}
          >
            {b.label}
            {b.key !== "all" && (
              <span className="ml-1.5 text-slate-500">{statusCount(b.key as LeadStatus)}</span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="bg-white border border-cream-300 rounded-xl overflow-hidden">
        {loading ? (
          <TableRowsSkeleton rows={8} cols={7} />
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <AlertCircle className="w-10 h-10 text-rose-600 mb-2" />
            <p className="text-sm text-slate-700">{error.message}</p>
            <button
              onClick={refetch}
              className="mt-3 px-3 py-1.5 text-xs bg-cream-100 hover:bg-cream-200 rounded-lg text-slate-700"
            >
              {t("orders.retry")}
            </button>
          </div>
        ) : leads.length === 0 ? (
          <EmptyLeads search={search} />
        ) : (
          <LeadTable
            leads={leads}
            currency={currency}
            onOpen={(id) => setDetailLeadId(id)}
          />
        )}

        {total > pageSize && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-cream-300 text-xs text-slate-500">
            <span>
              {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} / {total}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded-lg bg-cream-100 hover:bg-cream-200 disabled:opacity-30"
              >
                {t("orders.prev")}
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page * pageSize >= total}
                className="px-3 py-1 rounded-lg bg-cream-100 hover:bg-cream-200 disabled:opacity-30"
              >
                {t("orders.next")}
              </button>
            </div>
          </div>
        )}
      </div>

      {detailLeadId && (
        <LeadDetailModal
          leadId={detailLeadId}
          onClose={() => setDetailLeadId(null)}
          onUpdated={refetch}
        />
      )}
    </>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-white border border-cream-300 rounded-xl p-4">
      <p className="text-xs text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${accent}`}>{value}</p>
    </div>
  );
}

function LeadTable({
  leads,
  currency,
  onOpen,
}: {
  leads: Lead[];
  currency: string;
  onOpen: (id: string) => void;
}) {
  const { t } = useT();
  return (
    <>
    <div className="hidden md:block overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-cream-300">
            <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">{t("leads.col.lead")}</th>
            <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">{t("leads.col.contact")}</th>
            <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">{t("leads.col.channel")}</th>
            <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">{t("leads.col.status")}</th>
            <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">{t("leads.col.value")}</th>
            <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">{t("leads.col.date")}</th>
            <th className="py-3 px-4"></th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => {
            const style = statusStyle[lead.status];
            return (
              <tr key={lead.id} className="border-b border-cream-300/50 hover:bg-cream-100/30 transition-colors">
                <td className="py-3 px-4">
                  <div>
                    <p className="text-sm font-medium text-forest-800">{lead.name}</p>
                    <p className="text-xs text-slate-500">#{lead.code}</p>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <div className="flex flex-col gap-0.5">
                    {lead.phone && (
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <Phone className="w-3 h-3" /> {lead.phone}
                      </span>
                    )}
                    {lead.email && (
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <Mail className="w-3 h-3" /> {lead.email}
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4">
                  {lead.channel ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-cream-100 text-xs text-slate-700">
                      <MessageSquare className="w-3 h-3" />
                      {channelLabel(lead.channel.type, t) || lead.channel.name}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${style.bg} ${style.color}`}
                  >
                    {t(`leads.status.${lead.status}`)}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className="text-sm font-medium text-forest-800">
                    {formatCompactCurrency(Number(lead.value), currency)}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className="text-xs text-slate-500">{formatRelative(lead.createdAt)}</span>
                </td>
                <td className="py-3 px-4 text-right">
                  <button
                    onClick={() => onOpen(lead.id)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-forest-900 hover:bg-cream-100 transition-all"
                    aria-label={t("leads.details")}
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>

    {/* Mobile — card */}
    <div className="md:hidden divide-y divide-cream-300/50">
      {leads.map((lead) => {
        const style = statusStyle[lead.status];
        return (
          <button
            key={lead.id}
            type="button"
            onClick={() => onOpen(lead.id)}
            className="w-full text-left p-4 hover:bg-cream-100/30 active:bg-cream-100/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-forest-800 truncate">{lead.name}</p>
                <p className="text-xs text-slate-500">#{lead.code}</p>
                {(lead.phone || lead.email) && (
                  <p className="text-xs text-slate-500 mt-1 truncate">{lead.phone ?? lead.email}</p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold text-forest-800 whitespace-nowrap">
                  {formatCompactCurrency(Number(lead.value), currency)}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">{formatRelative(lead.createdAt)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${style.bg} ${style.color}`}>
                {t(`leads.status.${lead.status}`)}
              </span>
              {lead.channel && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cream-100 text-[11px] text-slate-700">
                  <MessageSquare className="w-3 h-3" />
                  {channelLabel(lead.channel.type, t) || lead.channel.name}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
    </>
  );
}

function channelLabel(type: ChannelType, t: (k: string) => string): string {
  const key = `leads.channel.${type}`;
  const v = t(key);
  return v === key ? type : v;
}

function EmptyLeads({ search }: { search: string }) {
  const { t } = useT();
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <Inbox className="w-12 h-12 text-slate-700 mb-3" />
      <h3 className="text-base font-semibold text-forest-800">
        {search ? t("leads.empty.search") : t("leads.empty.none")}
      </h3>
      <p className="text-sm text-slate-500 mt-1 max-w-md">
        {search ? t("leads.empty.searchHint") : t("leads.empty.noneHint")}
      </p>
    </div>
  );
}
