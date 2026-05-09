import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Eye,
  MoreHorizontal,
  Plus,
  ArrowUpDown,
  Download,
  Trash2,
  CheckSquare,
  Square,
  TrendingUp,
  Grid3X3,
  List,
  Phone,
  Mail,
  MessageSquare,
  Target,
  BarChart3,
  Layers,
  Funnel,
  Percent,
  DollarSign,
  Users,
  Globe,
  Smartphone,
  MessageCircle,
  Send,
  Monitor,
  ShoppingBag,
  MapPin,
} from "lucide-react";
import { leads, sourceStats, funnelData, conversionByDay, sourceLabels, statusLabels, statusConfig, priorityConfig } from "../data/leadsData";
import type { Lead, LeadStatus, LeadSource } from "../data/leadsData";
import LeadDetailModal from "./LeadDetailModal";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";

type ViewMode = "list" | "kanban";
type SortKey = "name" | "value" | "createdAt" | "status";
type SortDir = "asc" | "desc";

const sourceIcons: Record<string, React.ElementType> = {
  website: Globe,
  instagram: Smartphone,
  telegram: Send,
  facebook: Monitor,
  whatsapp: MessageCircle,
  email: Mail,
  phone: Phone,
  referral: Users,
  google_ads: Target,
  yandex_direct: Target,
  marketplace: ShoppingBag,
  offline: MapPin,
  landing_page: Monitor,
};

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

export default function LeadsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [assignedFilter, setAssignedFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [showFilters, setShowFilters] = useState(false);
  const [leadList, setLeadList] = useState<Lead[]>(leads);
  const [analyticsView, setAnalyticsView] = useState(false);

  const managers = [...new Set(leads.map((l) => l.assignedTo))];

  const filteredLeads = useMemo(() => {
    let result = [...leadList];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.phone.includes(q) ||
          l.email.toLowerCase().includes(q) ||
          l.id.toLowerCase().includes(q) ||
          (l.company && l.company.toLowerCase().includes(q))
      );
    }

    if (sourceFilter !== "all") result = result.filter((l) => l.source === sourceFilter);
    if (statusFilter !== "all") result = result.filter((l) => l.status === statusFilter);
    if (priorityFilter !== "all") result = result.filter((l) => l.priority === priorityFilter);
    if (assignedFilter !== "all") result = result.filter((l) => l.assignedTo === assignedFilter);

    result.sort((a, b) => {
      let aVal: string | number = a[sortKey];
      let bVal: string | number = b[sortKey];
      if (sortKey === "value") { aVal = a.value; bVal = b.value; }
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [searchQuery, sourceFilter, statusFilter, priorityFilter, assignedFilter, sortKey, sortDir, leadList]);

  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);
  const paginatedLeads = filteredLeads.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setCurrentPage(1);
  };

  const toggleSelectAll = () => {
    if (selectedLeads.size === paginatedLeads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(paginatedLeads.map((l) => l.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedLeads);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedLeads(next);
  };

  const handleStatusChange = (leadId: string, newStatus: string) => {
    setLeadList((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? { ...l, status: newStatus as LeadStatus, updatedAt: new Date().toISOString().slice(0, 16).replace("T", " ") }
          : l
      )
    );
  };

  // Stats
  const totalLeads = leadList.length;
  const newLeads = leadList.filter((l) => l.status === "new").length;
  const wonLeads = leadList.filter((l) => l.status === "won").length;
  const wonValue = leadList.filter((l) => l.status === "won").reduce((s, l) => s + l.value, 0);
  const conversionRate = totalLeads > 0 ? ((wonLeads / totalLeads) * 100).toFixed(1) : "0";

  const kanbanStatuses: LeadStatus[] = ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-xl">
          <p className="text-sm font-medium text-white">{label}</p>
          <p className="text-sm text-emerald-400">{payload[0].value} ta</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Лиды (Омниканал)</h1>
          <p className="text-sm text-slate-500 mt-1">Barcha kanallardan kelgan lidlar va ularni boshqaruvi</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAnalyticsView(!analyticsView)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm transition-all ${
              analyticsView ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-slate-800 border-slate-700 text-white hover:bg-slate-700"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Analytics
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-white transition-all">
            <Download className="w-4 h-4" />
            Export
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-all">
            <Plus className="w-4 h-4" />
            Yangi lid
          </button>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {[
          { label: "Jami lidlar", value: totalLeads.toString(), icon: Users, color: "text-white" },
          { label: "Yangi", value: newLeads.toString(), icon: Target, color: "text-blue-400", alert: newLeads > 0 },
          { label: "Yutuq", value: wonLeads.toString(), icon: TrendingUp, color: "text-emerald-400" },
          { label: "Konversiya", value: conversionRate + "%", icon: Percent, color: "text-violet-400" },
          { label: "Yutuq qiymati", value: (wonValue / 1000000).toFixed(1) + "M", icon: DollarSign, color: "text-emerald-400" },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08 }}
            className={`bg-slate-900 border rounded-xl p-5 ${stat.alert ? "border-blue-500/20" : "border-slate-800"}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <p className="text-xs text-slate-500">{stat.label}</p>
            </div>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Analytics Panel */}
      <AnimatePresence>
        {analyticsView && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-6"
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Funnel */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <Funnel className="w-4 h-4 text-emerald-400" />
                  Sotuv funnely
                </h3>
                <div className="space-y-2">
                  {funnelData.map((stage, i) => (
                    <div key={stage.stage}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-400">{stage.stage}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-white font-medium">{stage.count}</span>
                          <span className="text-xs text-slate-500">{(stage.value / 1000000).toFixed(1)}M</span>
                        </div>
                      </div>
                      <div className="h-6 bg-slate-800 rounded-md overflow-hidden relative">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(stage.count / Math.max(...funnelData.map((d) => d.count))) * 100}%` }}
                          transition={{ duration: 0.6, delay: i * 0.1 }}
                          className="h-full rounded-md"
                          style={{ backgroundColor: stage.color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sources Pie */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  Kanallar bo'yicha
                </h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sourceStats.slice(0, 6)}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={3}
                        dataKey="count"
                        stroke="none"
                      >
                        {sourceStats.slice(0, 6).map((_, index) => (
                          <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }: any) => {
                          if (active && payload && payload.length) {
                            const s = sourceStats[payload[0].payload.index ?? 0];
                            return (
                              <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-xl">
                                <p className="text-sm font-medium text-white">{sourceLabels[s.source as LeadSource]}</p>
                                <p className="text-xs text-slate-400">{s.count} lid</p>
                                <p className="text-xs text-emerald-400">{s.converted} konversiya</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-1 mt-2">
                  {sourceStats.slice(0, 6).map((s, i) => (
                    <div key={s.source} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i] }} />
                      <span className="text-[10px] text-slate-400 truncate">{sourceLabels[s.source as LeadSource]}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Conversion by Day */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-emerald-400" />
                  Haftalik konversiya
                </h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={conversionByDay} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="incoming" fill="#334155" radius={[3, 3, 0, 0]} maxBarSize={20} />
                      <Bar dataKey="converted" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-center gap-4 mt-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-slate-700" />
                    <span className="text-xs text-slate-500">Kiruvchi</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                    <span className="text-xs text-slate-500">Konversiya</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Source Channel Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        {sourceStats.slice(0, 7).map((stat, index) => {
          const Icon = sourceIcons[stat.source] || Globe;
          return (
            <motion.button
              key={stat.source}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => setSourceFilter(sourceFilter === stat.source ? "all" : stat.source)}
              className={`bg-slate-900 border rounded-xl p-3 text-left transition-all hover:border-slate-600 ${
                sourceFilter === stat.source ? "border-emerald-500/50 bg-emerald-500/5" : "border-slate-800"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <Icon className="w-4 h-4 text-slate-500" />
                <span className={`text-[10px] font-medium ${stat.trend > 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {stat.trend > 0 ? "+" : ""}{stat.trend}%
                </span>
              </div>
              <p className="text-lg font-bold text-white">{stat.count}</p>
              <p className="text-[10px] text-slate-500 truncate">{sourceLabels[stat.source as LeadSource]}</p>
            </motion.button>
          );
        })}
      </div>

      {/* Filters & View Toggle */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Lid ismi, telefon, email, kompaniya bo'yicha qidirish..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode(viewMode === "list" ? "kanban" : "list")}
              className="flex items-center gap-2 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-400 hover:text-white transition-all"
            >
              {viewMode === "list" ? <Grid3X3 className="w-4 h-4" /> : <List className="w-4 h-4" />}
              {viewMode === "list" ? "Kanban" : "Ro'yxat"}
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-400 hover:text-white transition-all"
            >
              <Filter className="w-4 h-4" />
              Filter
            </button>
          </div>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-3 mt-3 border-t border-slate-800">
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Status</label>
                  <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50">
                    <option value="all">Barcha statuslar</option>
                    {Object.entries(statusLabels).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Prioritet</label>
                  <select value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setCurrentPage(1); }} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50">
                    <option value="all">Barcha</option>
                    <option value="high">Yuqori</option>
                    <option value="medium">O'rta</option>
                    <option value="low">Past</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Mas'ul</label>
                  <select value={assignedFilter} onChange={(e) => { setAssignedFilter(e.target.value); setCurrentPage(1); }} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50">
                    <option value="all">Barcha</option>
                    {managers.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Sahifada</label>
                  <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50">
                    <option value={10}>10 ta</option>
                    <option value={20}>20 ta</option>
                    <option value={50}>50 ta</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setSearchQuery(""); setSourceFilter("all"); setStatusFilter("all");
                      setPriorityFilter("all"); setAssignedFilter("all"); setCurrentPage(1);
                    }}
                    className="w-full px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-400 hover:text-white transition-all"
                  >
                    Tozalash
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bulk Actions */}
      <AnimatePresence>
        {selectedLeads.size > 0 && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 mb-4">
            <p className="text-sm text-emerald-400 font-medium">{selectedLeads.size} ta lid tanlandi</p>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium rounded-lg transition-colors">
                <MessageSquare className="w-3.5 h-3.5" />
                Xabar yuborish
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-medium rounded-lg transition-colors">
                <Download className="w-3.5 h-3.5" />
                Export
              </button>
              <button onClick={() => setSelectedLeads(new Set())} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-medium rounded-lg transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
                Tozalash
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LIST VIEW */}
      {viewMode === "list" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-800/30">
                  <th className="py-3 px-4 w-10">
                    <button onClick={toggleSelectAll} className="text-slate-500 hover:text-white transition-colors">
                      {selectedLeads.size === paginatedLeads.length && paginatedLeads.length > 0 ? <CheckSquare className="w-4 h-4 text-emerald-400" /> : <Square className="w-4 h-4" />}
                    </button>
                  </th>
                  <th className="py-3 px-4 text-left">
                    <button onClick={() => handleSort("name")} className="flex items-center gap-1 text-xs font-medium text-slate-500 uppercase tracking-wider hover:text-white transition-colors">
                      Lid <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Manba</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="py-3 px-4 text-right">
                    <button onClick={() => handleSort("value")} className="flex items-center gap-1 text-xs font-medium text-slate-500 uppercase tracking-wider hover:text-white transition-colors ml-auto">
                      Qiymat <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Mas'ul</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Prioritet</th>
                  <th className="py-3 px-4 text-left">
                    <button onClick={() => handleSort("createdAt")} className="flex items-center gap-1 text-xs font-medium text-slate-500 uppercase tracking-wider hover:text-white transition-colors">
                      Sana <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Amallar</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLeads.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center">
                      <Users className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                      <p className="text-sm text-slate-500">Lidlar topilmadi</p>
                    </td>
                  </tr>
                ) : (
                  paginatedLeads.map((lead, index) => {
                    const sCfg = statusConfig[lead.status];
                    const pCfg = priorityConfig[lead.priority];
                    const isSelected = selectedLeads.has(lead.id);
                    const SourceIcon = sourceIcons[lead.source] || Globe;

                    return (
                      <motion.tr
                        key={lead.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.03 }}
                        className={`border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors ${isSelected ? "bg-emerald-500/5" : ""}`}
                      >
                        <td className="py-3.5 px-4">
                          <button onClick={() => toggleSelect(lead.id)} className="text-slate-500 hover:text-white transition-colors">
                            {isSelected ? <CheckSquare className="w-4 h-4 text-emerald-400" /> : <Square className="w-4 h-4" />}
                          </button>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 text-xs font-bold flex-shrink-0">
                              {lead.name.split(" ").map((n) => n[0]).join("")}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-white truncate">{lead.name}</p>
                              <p className="text-xs text-slate-500">{lead.phone}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <SourceIcon className="w-3.5 h-3.5 text-slate-500" />
                            <span className="text-sm text-slate-300">{sourceLabels[lead.source]}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${sCfg.bg} ${sCfg.color}`}>
                            {statusLabels[lead.status]}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span className="text-sm font-semibold text-white">{lead.value.toLocaleString()}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-slate-700 rounded-full flex items-center justify-center text-[10px] text-slate-300 font-bold">
                              {lead.assignedAvatar}
                            </div>
                            <span className="text-sm text-slate-300">{lead.assignedTo}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`text-xs font-medium ${pCfg.color}`}>{pCfg.label}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="text-sm text-slate-400">{lead.createdAt.split(" ")[0]}</span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => setDetailLead(lead)} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-all">
                              <Eye className="w-4 h-4" />
                            </button>
                            <button className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-all">
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {filteredLeads.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800">
              <p className="text-xs text-slate-500">
                {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredLeads.length)} / {filteredLeads.length} ta
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition-all">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) pageNum = i + 1;
                  else if (currentPage <= 3) pageNum = i + 1;
                  else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                  else pageNum = currentPage - 2 + i;
                  return (
                    <button key={pageNum} onClick={() => setCurrentPage(pageNum)} className={`w-7 h-7 rounded-lg text-xs font-medium transition-all ${currentPage === pageNum ? "bg-emerald-500 text-white" : "text-slate-500 hover:text-white hover:bg-slate-800"}`}>
                      {pageNum}
                    </button>
                  );
                })}
                <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition-all">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* KANBAN VIEW */}
      {viewMode === "kanban" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-4 overflow-x-auto pb-2">
          {kanbanStatuses.map((status) => {
            const statusLeads = filteredLeads.filter((l) => l.status === status);
            const sCfg = statusConfig[status];
            return (
              <div key={status} className="flex-shrink-0 w-72">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${sCfg.color.replace("text-", "bg-")}`} />
                    <span className="text-sm font-semibold text-white">{statusLabels[status]}</span>
                  </div>
                  <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{statusLeads.length}</span>
                </div>
                <div className="space-y-3">
                  {statusLeads.map((lead, index) => (
                    <motion.div
                      key={lead.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => setDetailLead(lead)}
                      className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-600 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="w-8 h-8 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 text-[10px] font-bold">
                          {lead.name.split(" ").map((n) => n[0]).join("")}
                        </div>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${priorityConfig[lead.priority].bg} ${priorityConfig[lead.priority].color}`}>
                          {priorityConfig[lead.priority].label}
                        </span>
                      </div>
                      <h4 className="text-sm font-medium text-white truncate">{lead.name}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">{lead.phone}</p>
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-xs font-semibold text-emerald-400">{lead.value.toLocaleString()}</span>
                        <span className="text-[10px] text-slate-500">{lead.assignedAvatar}</span>
                      </div>
                      {lead.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {lead.tags.slice(0, 2).map((tag) => (
                            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{tag}</span>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  ))}
                  {statusLeads.length === 0 && (
                    <div className="bg-slate-900/50 border border-dashed border-slate-800 rounded-xl p-6 text-center">
                      <p className="text-xs text-slate-600">Bo'sh</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </motion.div>
      )}

      {/* Lead Detail Modal */}
      <AnimatePresence>
        {detailLead && (
          <LeadDetailModal
            lead={detailLead}
            onClose={() => setDetailLead(null)}
            onStatusChange={handleStatusChange}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
