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
} from "lucide-react";
import { useAsync } from "../hooks/useAsync";
import { leadsApi } from "../api/endpoints";
import { useAuth } from "../contexts/AuthContext";
import { formatCompactCurrency, formatRelative } from "../utils/format";
import type { Lead, LeadStatus, ChannelType } from "../types/api";
import LeadDetailModal from "./LeadDetailModal";

const statusConfig: Record<LeadStatus, { label: string; color: string; bg: string }> = {
  NEW: { label: "Yangi", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  CONTACTED: { label: "Bog'lanildi", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  QUALIFIED: { label: "Saralangan", color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20" },
  PROPOSAL: { label: "Taklif", color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20" },
  NEGOTIATION: { label: "Muzokara", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
  WON: { label: "Yutuq", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  LOST: { label: "Yoqotildi", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
};

const channelTypeLabels: Record<ChannelType, string> = {
  WEBSITE: "Veb-sayt",
  LANDING_PAGE: "Landing",
  INSTAGRAM: "Instagram",
  TELEGRAM: "Telegram",
  FACEBOOK: "Facebook",
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
  PHONE: "Telefon",
  REFERRAL: "Referral",
  GOOGLE_ADS: "Google Ads",
  YANDEX_DIRECT: "Yandex Direct",
  MARKETPLACE: "Marketplace",
  OFFLINE: "Offline",
};

export default function LeadsPage() {
  const { tenant } = useAuth();
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

  const statusButtons: ({ key: LeadStatus | "all"; label: string })[] = [
    { key: "all", label: "Hammasi" },
    { key: "NEW", label: "Yangi" },
    { key: "CONTACTED", label: "Bog'lanildi" },
    { key: "QUALIFIED", label: "Saralangan" },
    { key: "NEGOTIATION", label: "Muzokara" },
    { key: "WON", label: "Yutuq" },
    { key: "LOST", label: "Yoqotildi" },
  ];

  const statusCount = (status: LeadStatus): number =>
    stats?.byStatus.find((s) => s.status === status)?.count ?? 0;

  return (
    <>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-bold text-white">Lidlar</h1>
        <p className="text-sm text-slate-500 mt-1">
          Barcha kanallardan kelgan lidlar va ularning holati
        </p>
      </motion.div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard label="Jami lidlar" value={total.toString()} accent="text-white" />
        <StatCard
          label="Yangi"
          value={statusCount("NEW").toString()}
          accent="text-blue-400"
        />
        <StatCard
          label="Yutuq"
          value={statusCount("WON").toString()}
          accent="text-emerald-400"
        />
        <StatCard
          label="Yutuq qiymati"
          value={formatCompactCurrency(stats?.wonValue ?? 0, currency)}
          accent="text-emerald-400"
        />
      </div>

      {/* Channel breakdown */}
      {stats && stats.byChannel.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-5">
          {stats.byChannel.slice(0, 6).map((ch) => (
            <div
              key={ch.channelId ?? "none"}
              className="bg-slate-900 border border-slate-800 rounded-lg p-3"
            >
              <p className="text-[10px] text-slate-500 uppercase truncate">
                {ch.channel?.name ?? "Boshqa"}
              </p>
              <p className="text-lg font-bold text-white mt-1">{ch.count}</p>
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
            placeholder="Ism, telefon, email, kompaniya..."
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
          />
        </label>
        <button
          type="button"
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-sm font-medium text-white transition-all"
        >
          <Plus className="w-4 h-4" />
          Yangi lid
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
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
                ? "bg-emerald-500 text-white"
                : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
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
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-slate-600 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <AlertCircle className="w-10 h-10 text-red-400 mb-2" />
            <p className="text-sm text-slate-300">{error.message}</p>
            <button
              onClick={refetch}
              className="mt-3 px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300"
            >
              Qaytadan urinish
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
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
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
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-800">
            <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">Lid</th>
            <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">Aloqa</th>
            <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">Kanal</th>
            <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">Status</th>
            <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">Qiymat</th>
            <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">Sana</th>
            <th className="py-3 px-4"></th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => {
            const cfg = statusConfig[lead.status];
            return (
              <tr key={lead.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                <td className="py-3 px-4">
                  <div>
                    <p className="text-sm font-medium text-white">{lead.name}</p>
                    <p className="text-xs text-slate-500">#{lead.code}</p>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <div className="flex flex-col gap-0.5">
                    {lead.phone && (
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Phone className="w-3 h-3" /> {lead.phone}
                      </span>
                    )}
                    {lead.email && (
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Mail className="w-3 h-3" /> {lead.email}
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4">
                  {lead.channel ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-800 text-xs text-slate-300">
                      <MessageSquare className="w-3 h-3" />
                      {channelTypeLabels[lead.channel.type] ?? lead.channel.name}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-600">—</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.color}`}
                  >
                    {cfg.label}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className="text-sm font-medium text-white">
                    {formatCompactCurrency(Number(lead.value), currency)}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className="text-xs text-slate-500">{formatRelative(lead.createdAt)}</span>
                </td>
                <td className="py-3 px-4 text-right">
                  <button
                    onClick={() => onOpen(lead.id)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-all"
                    aria-label="Tafsilotlar"
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
  );
}

function EmptyLeads({ search }: { search: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <Inbox className="w-12 h-12 text-slate-700 mb-3" />
      <h3 className="text-base font-semibold text-white">
        {search ? "Lid topilmadi" : "Hozircha lidlar yo'q"}
      </h3>
      <p className="text-sm text-slate-500 mt-1 max-w-md">
        {search
          ? "Boshqa qidiruv so'rovini kiriting yoki filtrni tozalang."
          : "Kanallar (Instagram, Telegram, veb-sayt va h.k.) webhook orqali ulangach, yangi lidlar shu yerda paydo bo'ladi."}
      </p>
    </div>
  );
}
