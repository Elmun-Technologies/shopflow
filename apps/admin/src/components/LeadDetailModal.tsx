import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Phone,
  Mail,
  MapPin,
  Building2,
  Briefcase,
  Tag,
  Calendar,
  Clock,
  User,
  MessageSquare,
  Send,
  FileText,
  GitBranch,
  Users,
  MessageCircle,
  CheckCircle2,
  Star,
  Plus,
} from "lucide-react";
import type { Lead } from "../data/leadsData";
import { statusLabels, statusConfig, priorityConfig, sourceLabels, interactionTypeConfig } from "../data/leadsData";

interface Props {
  lead: Lead | null;
  onClose: () => void;
  onStatusChange?: (leadId: string, newStatus: string) => void;
}

type Tab = "overview" | "interactions" | "details";

const interactionIcons: Record<string, React.ElementType> = {
  Phone,
  Mail,
  MessageSquare,
  MessageCircle,
  Send,
  Users,
  FileText,
  GitBranch,
};

export default function LeadDetailModal({ lead, onClose, onStatusChange }: Props) {
  if (!lead) return null;

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [newNote, setNewNote] = useState("");
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  const status = statusConfig[lead.status];
  const priority = priorityConfig[lead.priority];

  const pipelineStatuses = ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"] as const;
  const currentIndex = pipelineStatuses.indexOf(lead.status);

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    setNewNote("");
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b border-slate-800">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 text-lg font-bold flex-shrink-0">
                {lead.name.split(" ").map((n) => n[0]).join("")}
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">{lead.name}</h2>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${status.bg} ${status.color}`}>
                    {statusLabels[lead.status]}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${priority.bg} ${priority.color}`}>
                    <Star className="w-3 h-3" />
                    {priority.label}
                  </span>
                  {lead.tags.map((tag) => (
                    <span key={tag} className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  onClick={() => setShowStatusMenu(!showStatusMenu)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-white transition-all"
                >
                  <GitBranch className="w-4 h-4" />
                  Status
                </button>
                <AnimatePresence>
                  {showStatusMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: 4, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.95 }}
                      className="absolute right-0 top-full mt-2 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-10"
                    >
                      {pipelineStatuses.map((s) => {
                        const cfg = statusConfig[s];
                        return (
                          <button
                            key={s}
                            onClick={() => {
                              onStatusChange?.(lead.id, s);
                              setShowStatusMenu(false);
                            }}
                            className={`w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors ${
                              lead.status === s ? "bg-emerald-500/10 text-emerald-400" : "text-slate-300 hover:bg-slate-700/50 hover:text-white"
                            }`}
                          >
                            <div className={`w-2 h-2 rounded-full ${cfg.color.replace("text-", "bg-")}`} />
                            {statusLabels[s]}
                            {lead.status === s && <CheckCircle2 className="w-3.5 h-3.5 ml-auto" />}
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Pipeline Progress */}
          <div className="px-6 py-4 border-b border-slate-800">
            <div className="flex items-center gap-1">
              {pipelineStatuses.map((s, i) => {
                const cfg = statusConfig[s];
                const isActive = i <= currentIndex;
                const isCurrent = i === currentIndex;
                return (
                  <div key={s} className="flex items-center flex-1">
                    <div className="flex flex-col items-center flex-1">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                          isCurrent
                            ? `${cfg.bg} ${cfg.color} border-current`
                            : isActive
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50"
                            : "bg-slate-800 text-slate-600 border-slate-700"
                        }`}
                      >
                        {isActive && i < currentIndex ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          i + 1
                        )}
                      </div>
                      <span className={`text-[10px] mt-1.5 text-center leading-tight ${isActive ? "text-slate-300" : "text-slate-600"}`}>
                        {statusLabels[s]}
                      </span>
                    </div>
                    {i < pipelineStatuses.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-1 ${i < currentIndex ? "bg-emerald-500/50" : "bg-slate-800"}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 px-4 pt-4 border-b border-slate-800">
            {[
              { key: "overview" as Tab, label: "Umumiy", icon: User },
              { key: "interactions" as Tab, label: "Interaksiyalar", icon: MessageSquare },
              { key: "details" as Tab, label: "Batafsil", icon: FileText },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all ${
                    activeTab === tab.key
                      ? "text-emerald-400 border-b-2 border-emerald-400"
                      : "text-slate-500 hover:text-white"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="p-6">
            <AnimatePresence mode="wait">
              {/* OVERVIEW TAB */}
              {activeTab === "overview" && (
                <motion.div
                  key="overview"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-5"
                >
                  {/* Contact Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-slate-800/50 rounded-xl p-4">
                      <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                        <Phone className="w-4 h-4 text-slate-400" />
                        Aloqa ma'lumotlari
                      </h3>
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                          <span className="text-white">{lead.phone}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                          <span className="text-white">{lead.email}</span>
                        </div>
                        {lead.location && (
                          <div className="flex items-center gap-2 text-sm">
                            <MapPin className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                            <span className="text-slate-300">{lead.location}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-slate-800/50 rounded-xl p-4">
                      <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        Kompaniya
                      </h3>
                      <div className="space-y-2.5">
                        {lead.company && (
                          <div className="flex items-center gap-2 text-sm">
                            <Building2 className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                            <span className="text-white">{lead.company}</span>
                          </div>
                        )}
                        {lead.position && (
                          <div className="flex items-center gap-2 text-sm">
                            <Briefcase className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                            <span className="text-slate-300">{lead.position}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-sm">
                          <User className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                          <span className="text-slate-300">Mas'ul: {lead.assignedTo}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Deal Value & Source */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-slate-800/50 rounded-xl p-4">
                      <p className="text-xs text-slate-500">Potensial qiymat</p>
                      <p className="text-2xl font-bold text-emerald-400 mt-1">
                        {lead.value.toLocaleString()} {lead.currency}
                      </p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-4">
                      <p className="text-xs text-slate-500">Manba</p>
                      <p className="text-lg font-bold text-white mt-1">{sourceLabels[lead.source]}</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-4">
                      <p className="text-xs text-slate-500">Yaratilgan</p>
                      <p className="text-lg font-bold text-white mt-1">{lead.createdAt.split(" ")[0]}</p>
                    </div>
                  </div>

                  {/* UTM Info */}
                  {(lead.utmSource || lead.utmMedium || lead.utmCampaign) && (
                    <div className="bg-slate-800/30 rounded-xl p-4">
                      <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                        <Tag className="w-4 h-4 text-slate-400" />
                        UTM teglar
                      </h3>
                      <div className="grid grid-cols-3 gap-3">
                        {lead.utmSource && (
                          <div>
                            <p className="text-xs text-slate-500">Source</p>
                            <p className="text-sm text-white mt-0.5">{lead.utmSource}</p>
                          </div>
                        )}
                        {lead.utmMedium && (
                          <div>
                            <p className="text-xs text-slate-500">Medium</p>
                            <p className="text-sm text-white mt-0.5">{lead.utmMedium}</p>
                          </div>
                        )}
                        {lead.utmCampaign && (
                          <div>
                            <p className="text-xs text-slate-500">Campaign</p>
                            <p className="text-sm text-white mt-0.5">{lead.utmCampaign}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  <div className="bg-slate-800/30 rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-400" />
                      Eslatmalar
                    </h3>
                    <p className="text-sm text-slate-300 leading-relaxed">{lead.notes}</p>
                  </div>

                  {/* Next Actions */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-slate-800/30 rounded-xl p-4">
                      <p className="text-xs text-slate-500 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        So'nggi aloqa
                      </p>
                      <p className="text-sm font-medium text-white mt-1">{lead.lastContact}</p>
                    </div>
                    <div className="bg-slate-800/30 rounded-xl p-4">
                      <p className="text-xs text-slate-500 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        Keyingi qo'ng'iroq
                      </p>
                      <p className="text-sm font-medium text-emerald-400 mt-1">{lead.nextFollowUp}</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* INTERACTIONS TAB */}
              {activeTab === "interactions" && (
                <motion.div
                  key="interactions"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-5"
                >
                  {/* Add Note */}
                  <div className="bg-slate-800/30 rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-white mb-3">Yangi interaksiya</h3>
                    <div className="flex gap-2">
                      <textarea
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        placeholder="Eslatma, qo'ng'iroq natijasi yoki boshqa ma'lumot..."
                        rows={2}
                        className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 resize-none"
                      />
                      <button
                        onClick={handleAddNote}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors self-end"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {["call", "email", "sms", "whatsapp", "telegram", "meeting"].map((type) => {
                        const cfg = interactionTypeConfig[type];
                        const Icon = interactionIcons[cfg.icon] || FileText;
                        return (
                          <button
                            key={type}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-400 hover:text-white transition-all"
                          >
                            <Icon className="w-3 h-3" />
                            {cfg.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="relative">
                    <div className="absolute left-[19px] top-2 bottom-2 w-px bg-slate-800" />
                    <div className="space-y-4">
                      {lead.interactions.map((interaction, i) => {
                        const cfg = interactionTypeConfig[interaction.type];
                        const Icon = interactionIcons[cfg.icon] || FileText;
                        return (
                          <motion.div
                            key={interaction.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="flex items-start gap-3 relative"
                          >
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${cfg.color.replace("text-", "bg-").replace("400", "500")}/10`}>
                              <Icon className={`w-4 h-4 ${cfg.color}`} />
                            </div>
                            <div className="flex-1 bg-slate-800/30 rounded-xl p-3">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium text-white">{cfg.label}</span>
                                <span className="text-xs text-slate-500">{interaction.createdAt}</span>
                              </div>
                              <p className="text-sm text-slate-300">{interaction.content}</p>
                              <div className="flex items-center gap-2 mt-1.5">
                                <span className="text-xs text-slate-500">{interaction.createdBy}</span>
                                {interaction.duration && (
                                  <span className="text-xs text-slate-500">
                                    {Math.floor(interaction.duration / 60)}:{(interaction.duration % 60).toString().padStart(2, "0")}
                                  </span>
                                )}
                                <span className={`text-xs px-1.5 py-0.5 rounded ${interaction.direction === "inbound" ? "bg-emerald-500/10 text-emerald-400" : "bg-blue-500/10 text-blue-400"}`}>
                                  {interaction.direction === "inbound" ? "Kiruvchi" : "Chiquvchi"}
                                </span>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* DETAILS TAB */}
              {activeTab === "details" && (
                <motion.div
                  key="details"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-4"
                >
                  {[
                    { label: "LID ID", value: lead.id },
                    { label: "Ism", value: lead.name },
                    { label: "Telefon", value: lead.phone },
                    { label: "Email", value: lead.email },
                    { label: "Manba", value: sourceLabels[lead.source] },
                    { label: "Status", value: statusLabels[lead.status] },
                    { label: "Prioritet", value: priority.label },
                    { label: "Potensial qiymat", value: `${lead.value.toLocaleString()} ${lead.currency}` },
                    { label: "Mas'ul", value: lead.assignedTo },
                    { label: "Yaratilgan", value: lead.createdAt },
                    { label: "Yangilangan", value: lead.updatedAt },
                    { label: "So'nggi aloqa", value: lead.lastContact },
                    { label: "Keyingi qo'ng'iroq", value: lead.nextFollowUp },
                    { label: "Kompaniya", value: lead.company || "—" },
                    { label: "Lavozim", value: lead.position || "—" },
                    { label: "Joylashuv", value: lead.location || "—" },
                    { label: "UTM Source", value: lead.utmSource || "—" },
                    { label: "UTM Medium", value: lead.utmMedium || "—" },
                    { label: "UTM Campaign", value: lead.utmCampaign || "—" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between py-2 border-b border-slate-800/50">
                      <span className="text-sm text-slate-500">{item.label}</span>
                      <span className="text-sm text-white font-medium">{item.value}</span>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
