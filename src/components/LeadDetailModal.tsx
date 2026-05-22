import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Phone,
  Mail,
  Building2,
  MapPin,
  Tag,
  Clock,
  MessageSquare,
  Send,
  FileText,
  GitBranch,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useAsync } from "../hooks/useAsync";
import { leadsApi } from "../api/endpoints";
import { useAuth } from "../contexts/AuthContext";
import { formatCompactCurrency, formatDateTime, formatRelative } from "../utils/format";
import type { LeadStatus, InteractionType, Interaction } from "../types/api";
import { useT } from "../i18n";

interface Props {
  leadId: string;
  onClose: () => void;
  onUpdated?: () => void;
}

// Faqat ranglar — labellar t() orqali (leads.status.{X})
const statusStyle: Record<LeadStatus, { color: string; bg: string }> = {
  NEW: { color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  CONTACTED: { color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  QUALIFIED: { color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20" },
  PROPOSAL: { color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20" },
  NEGOTIATION: { color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
  WON: { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  LOST: { color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
};

const allStatuses: LeadStatus[] = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
  "LOST",
];

const interactionIcons: Record<InteractionType, React.ElementType> = {
  CALL: Phone,
  EMAIL: Mail,
  SMS: MessageSquare,
  WHATSAPP: MessageSquare,
  TELEGRAM: Send,
  MEETING: Building2,
  NOTE: FileText,
  STATUS_CHANGE: GitBranch,
};

export default function LeadDetailModal({ leadId, onClose, onUpdated }: Props) {
  const { tenant } = useAuth();
  const { t } = useT();
  const currency = tenant?.currency ?? "UZS";
  const { data: lead, loading, error, refetch } = useAsync(() => leadsApi.get(leadId), [leadId]);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleStatusChange = async (newStatus: LeadStatus) => {
    setShowStatusMenu(false);
    await leadsApi.update(leadId, { status: newStatus });
    refetch();
    onUpdated?.();
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setSubmitting(true);
    try {
      await leadsApi.addInteraction(leadId, {
        type: "NOTE",
        direction: "OUTBOUND",
        content: noteText,
      });
      setNoteText("");
      refetch();
      onUpdated?.();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
            </div>
          ) : error || !lead ? (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
              <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
              <p className="text-sm text-slate-300">{error?.message ?? "Lid topilmadi"}</p>
              <button
                onClick={onClose}
                className="mt-4 px-3 py-1.5 text-xs bg-slate-800 rounded-lg text-slate-300"
              >
                Yopish
              </button>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-start justify-between p-5 border-b border-slate-800">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-500">#{lead.code}</p>
                  <h2 className="text-xl font-bold text-white mt-0.5 truncate">{lead.name}</h2>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <div className="relative">
                      <button
                        onClick={() => setShowStatusMenu(!showStatusMenu)}
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusStyle[lead.status].bg} ${statusStyle[lead.status].color}`}
                      >
                        {t(`leads.status.${lead.status}`)}
                      </button>
                      {showStatusMenu && (
                        <div className="absolute top-full mt-1 left-0 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 z-10 min-w-[150px]">
                          {allStatuses.map((s) => (
                            <button
                              key={s}
                              onClick={() => handleStatusChange(s)}
                              className={`w-full px-3 py-1.5 text-left text-xs hover:bg-slate-700 ${statusStyle[s].color}`}
                            >
                              {t(`leads.status.${s}`)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {lead.channel && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 text-xs text-slate-300">
                        {lead.channel.name}
                      </span>
                    )}
                    <span className="text-xs text-slate-500">
                      <Clock className="w-3 h-3 inline mr-0.5" />
                      {formatRelative(lead.createdAt)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Info grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <InfoRow icon={Phone} label="Telefon" value={lead.phone} />
                  <InfoRow icon={Mail} label="Email" value={lead.email} />
                  <InfoRow icon={Building2} label="Kompaniya" value={lead.company} />
                  <InfoRow icon={MapPin} label="Manzil" value={lead.location} />
                  <InfoRow
                    icon={Tag}
                    label="Qiymat"
                    value={formatCompactCurrency(Number(lead.value), currency)}
                  />
                </div>

                {lead.notes && (
                  <div className="bg-slate-800/50 border border-slate-800 rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-1">Izoh</p>
                    <p className="text-sm text-slate-200 whitespace-pre-wrap">{lead.notes}</p>
                  </div>
                )}

                {/* Interactions */}
                <div>
                  <h3 className="text-sm font-semibold text-white mb-3">{t("leadDetail.interactions")}</h3>
                  {lead.interactions.length === 0 ? (
                    <p className="text-xs text-slate-500">Aloqa yo'q</p>
                  ) : (
                    <div className="space-y-3">
                      {lead.interactions.map((interaction) => (
                        <InteractionRow key={interaction.id} interaction={interaction} />
                      ))}
                    </div>
                  )}
                </div>

                {/* Add note */}
                <div>
                  <h3 className="text-sm font-semibold text-white mb-2">{t("leadDetail.addNote")}</h3>
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    rows={3}
                    placeholder="Lid haqida eslatma yozing..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 resize-none"
                  />
                  <button
                    onClick={handleAddNote}
                    disabled={!noteText.trim() || submitting}
                    className="mt-2 flex items-center gap-2 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-all"
                  >
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Qo'shish
                  </button>
                </div>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm text-slate-200 truncate">{value || "—"}</p>
      </div>
    </div>
  );
}

function InteractionRow({ interaction }: { interaction: Interaction }) {
  const Icon = interactionIcons[interaction.type] ?? MessageSquare;
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-3.5 h-3.5 text-slate-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-300 font-medium">{interaction.createdBy}</span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-500">{formatDateTime(interaction.createdAt)}</span>
        </div>
        <p className="text-sm text-slate-200 mt-0.5 whitespace-pre-wrap">{interaction.content}</p>
      </div>
    </div>
  );
}
