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
import { useFocusTrap } from "../hooks/useFocusTrap";

interface Props {
  leadId: string;
  onClose: () => void;
  onUpdated?: () => void;
}

// Faqat ranglar — labellar t() orqali (leads.status.{X})
const statusStyle: Record<LeadStatus, { color: string; bg: string }> = {
  NEW: { color: "text-blue-600", bg: "bg-blue-100 border-blue-300" },
  CONTACTED: { color: "text-amber-600", bg: "bg-amber-100 border-amber-300" },
  QUALIFIED: { color: "text-violet-600", bg: "bg-violet-100 border-violet-300" },
  PROPOSAL: { color: "text-forest-700", bg: "bg-leaf-100 border-leaf-300" },
  NEGOTIATION: { color: "text-orange-600", bg: "bg-orange-100 border-orange-300" },
  WON: { color: "text-forest-700", bg: "bg-leaf-100 border-leaf-300/60" },
  LOST: { color: "text-red-600", bg: "bg-red-100 border-red-300" },
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
  // Focus-trap + Escape + fokus tiklash (modal a11y). Modal faqat mount bo'lganda
  // ko'rinadi (parent gate qiladi), shuning uchun active=true.
  const panelRef = useFocusTrap<HTMLDivElement>(true, onClose);

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
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={lead?.name ?? t("leads.title")}
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white border border-cream-300 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
            </div>
          ) : error || !lead ? (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
              <AlertCircle className="w-10 h-10 text-red-600 mb-3" />
              <p className="text-sm text-slate-700">{error?.message ?? t("leadDetail.notFound")}</p>
              <button
                onClick={onClose}
                className="mt-4 px-3 py-1.5 text-xs bg-cream-100 rounded-lg text-slate-700"
              >
                {t("common.close")}
              </button>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-start justify-between p-5 border-b border-cream-300">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-500">#{lead.code}</p>
                  <h2 className="text-xl font-bold text-forest-800 mt-0.5 truncate">{lead.name}</h2>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <div className="relative">
                      <button
                        onClick={() => setShowStatusMenu(!showStatusMenu)}
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusStyle[lead.status].bg} ${statusStyle[lead.status].color}`}
                      >
                        {t(`leads.status.${lead.status}`)}
                      </button>
                      {showStatusMenu && (
                        <div className="absolute top-full mt-1 left-0 bg-cream-100 border border-cream-300 rounded-lg shadow-xl py-1 z-10 min-w-[150px]">
                          {allStatuses.map((s) => (
                            <button
                              key={s}
                              onClick={() => handleStatusChange(s)}
                              className={`w-full px-3 py-1.5 text-left text-xs hover:bg-cream-200 ${statusStyle[s].color}`}
                            >
                              {t(`leads.status.${s}`)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {lead.channel && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cream-100 text-xs text-slate-700">
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
                  className="p-2 rounded-lg text-slate-500 hover:text-forest-900 hover:bg-cream-100 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Info grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <InfoRow icon={Phone} label={t("leadDetail.phone")} value={lead.phone} />
                  <InfoRow icon={Mail} label={t("leadDetail.email")} value={lead.email} />
                  <InfoRow icon={Building2} label={t("leadDetail.company")} value={lead.company} />
                  <InfoRow icon={MapPin} label={t("leadDetail.location")} value={lead.location} />
                  <InfoRow
                    icon={Tag}
                    label={t("leadDetail.value")}
                    value={formatCompactCurrency(Number(lead.value), currency)}
                  />
                </div>

                {lead.notes && (
                  <div className="bg-cream-100/50 border border-cream-300 rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-1">{t("leadDetail.note")}</p>
                    <p className="text-sm text-forest-700 whitespace-pre-wrap">{lead.notes}</p>
                  </div>
                )}

                {/* Interactions */}
                <div>
                  <h3 className="text-sm font-semibold text-forest-800 mb-3">{t("leadDetail.interactions")}</h3>
                  {lead.interactions.length === 0 ? (
                    <p className="text-xs text-slate-500">{t("leadDetail.noInteractions")}</p>
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
                  <h3 className="text-sm font-semibold text-forest-800 mb-2">{t("leadDetail.addNote")}</h3>
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    rows={3}
                    placeholder={t("leadDetail.notePlaceholder")}
                    className="w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2 text-sm text-forest-800 placeholder-slate-400 focus:outline-none focus:border-leaf-500/60 resize-none"
                  />
                  <button
                    onClick={handleAddNote}
                    disabled={!noteText.trim() || submitting}
                    className="mt-2 flex items-center gap-2 px-3 py-1.5 bg-leaf-400 hover:bg-leaf-500 disabled:opacity-50 rounded-lg text-sm font-medium text-forest-800 transition-all"
                  >
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {t("common.add")}
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
        <p className="text-sm text-forest-700 truncate">{value || "—"}</p>
      </div>
    </div>
  );
}

function InteractionRow({ interaction }: { interaction: Interaction }) {
  const Icon = interactionIcons[interaction.type] ?? MessageSquare;
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-full bg-cream-100 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-3.5 h-3.5 text-slate-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-700 font-medium">{interaction.createdBy}</span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-500">{formatDateTime(interaction.createdAt)}</span>
        </div>
        <p className="text-sm text-forest-700 mt-0.5 whitespace-pre-wrap">{interaction.content}</p>
      </div>
    </div>
  );
}
