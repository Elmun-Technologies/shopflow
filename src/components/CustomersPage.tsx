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
  AlertTriangle,
  Mail,
  ShoppingBag,
  Gift,
  Calendar,
  Ban,
  CheckCircle2,
  UserPlus,
  Users,
  Globe,
  Smartphone,
  Monitor,
  BookOpen,
  MessageCircle,
  Send,
  Store,
  MapPinned,
  Crown,
  Star,
  X,
} from "lucide-react";
import { customers, customerStats, platformStats, regionStats, platformLabels, statusLabels, statusConfig } from "../data/customersData";
import type { Customer, CustomerStatus } from "../data/customersData";
import type { ChartTooltipProps } from "../utils/chart";
import CustomerDetailModal from "./CustomerDetailModal";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

type SortKey = "firstName" | "totalOrders" | "totalSpent" | "bonusPoints" | "registeredAt";
type SortDir = "asc" | "desc";

function CustomTooltip({ active, payload, label }: ChartTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-xl">
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-sm text-emerald-400">{payload[0].value} ta</p>
      </div>
    );
  }
  return null;
}

const platformIcons: Record<string, React.ElementType> = {
  telegram_bot: Send,
  website: Globe,
  catalog_site: BookOpen,
  instagram: Smartphone,
  telegram: MessageCircle,
  facebook: Monitor,
  whatsapp: MessageCircle,
  marketplace: Store,
  offline: MapPinned,
  referral: UserPlus,
};

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316", "#14b8a6", "#a855f7"];

export default function CustomersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("registeredAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [customerList, setCustomerList] = useState<Customer[]>(customers);
  const [analyticsView, setAnalyticsView] = useState(false);

  const regions = [...new Set(customers.map((c) => c.region))];

  const filteredCustomers = useMemo(() => {
    let result = [...customerList];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.firstName.toLowerCase().includes(q) ||
          c.lastName.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== "all") result = result.filter((c) => c.status === statusFilter);
    if (platformFilter !== "all") result = result.filter((c) => c.platform === platformFilter);
    if (regionFilter !== "all") result = result.filter((c) => c.region === regionFilter);

    result.sort((a, b) => {
      let aVal: string | number = a[sortKey];
      let bVal: string | number = b[sortKey];
      if (sortKey === "totalOrders" || sortKey === "totalSpent" || sortKey === "bonusPoints") {
        aVal = a[sortKey];
        bVal = b[sortKey];
      }
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [searchQuery, statusFilter, platformFilter, regionFilter, sortKey, sortDir, customerList]);

  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const paginatedCustomers = filteredCustomers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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
    if (selectedCustomers.size === paginatedCustomers.length) {
      setSelectedCustomers(new Set());
    } else {
      setSelectedCustomers(new Set(paginatedCustomers.map((c) => c.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedCustomers);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedCustomers(next);
  };

  const handleBan = (id: string) => {
    setCustomerList((prev) => prev.map((c) => (c.id === id ? { ...c, status: "banned" as CustomerStatus } : c)));
    setDetailCustomer(null);
  };

  const handleUnban = (id: string) => {
    setCustomerList((prev) => prev.map((c) => (c.id === id ? { ...c, status: "active" as CustomerStatus } : c)));
    setDetailCustomer(null);
  };

  return (
    <div>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Mijozlar</h1>
          <p className="text-sm text-slate-500 mt-1">Barcha platformalardan kelgan mijozlar boshqaruvi</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAnalyticsView(!analyticsView)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm transition-all ${
              analyticsView ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-slate-800 border-slate-700 text-white hover:bg-slate-700"
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Analytics
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-white transition-all">
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            Mijoz qo'shish
          </button>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
        {[
          { label: "Jami mijozlar", value: customerStats.total, icon: Users, color: "text-white" },
          { label: "Faol", value: customerStats.active, icon: CheckCircle2, color: "text-emerald-400" },
          { label: "VIP", value: customerStats.vip, icon: Crown, color: "text-amber-400" },
          { label: "Yangi", value: customerStats.new, icon: Star, color: "text-blue-400" },
          { label: "Ban", value: customerStats.banned, icon: Ban, color: "text-red-400", alert: true },
          { label: "Nofaol", value: customerStats.inactive, icon: AlertTriangle, color: "text-slate-400" },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06 }}
            className={`bg-slate-900 border rounded-xl p-4 ${stat.alert ? "border-red-500/20" : "border-slate-800"}`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <p className="text-xs text-slate-500">{stat.label}</p>
            </div>
            <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Analytics Panel */}
      <AnimatePresence>
        {analyticsView && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Platform Distribution */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4">Platformalar bo'yicha</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={platformStats} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2} dataKey="count" stroke="none">
                        {platformStats.map((stat, index) => (
                          <Cell key={stat.platform} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={(props) => {
                          const { active, payload } = props as ChartTooltipProps;
                          if (active && payload && payload.length) {
                            const idx = (payload[0].payload as { index?: number } | undefined)?.index ?? 0;
                            const p = platformStats[idx];
                            if (!p) return null;
                            return (
                              <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-xl">
                                <p className="text-sm font-medium text-white">{platformLabels[p.platform]}</p>
                                <p className="text-xs text-slate-400">{p.count} mijoz ({p.percent}%)</p>
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
                  {platformStats.slice(0, 6).map((p, i) => (
                    <div key={p.platform} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i] }} />
                      <span className="text-[10px] text-slate-400 truncate">{platformLabels[p.platform]}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Region Bar Chart */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4">Viloyatlar bo'yicha</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={regionStats.slice(0, 7)} layout="vertical" margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                      <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 10 }} />
                      <YAxis type="category" dataKey="region" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 10 }} width={70} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} maxBarSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Total Stats */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4">Umumiy ko'rsatkichlar</h3>
                <div className="space-y-3">
                  {[
                    { label: "Jami daromad", value: (customerStats.totalSpent / 1000000).toFixed(1) + "M so'm", icon: ShoppingBag, color: "text-emerald-400" },
                    { label: "Jami buyurtmalar", value: customerStats.totalOrders.toString(), icon: ShoppingBag, color: "text-blue-400" },
                    { label: "O'rtacha mijoz umri", value: customerStats.avgLifetime + " kun", icon: Calendar, color: "text-amber-400" },
                    { label: "O'rtacha chek", value: Math.round(customerStats.totalSpent / customerStats.totalOrders).toLocaleString() + " so'm", icon: Gift, color: "text-violet-400" },
                  ].map((s) => (
                    <div key={s.label} className="flex items-center justify-between bg-slate-800/50 rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <s.icon className={`w-4 h-4 ${s.color}`} />
                        <span className="text-sm text-slate-400">{s.label}</span>
                      </div>
                      <span className={`text-sm font-bold ${s.color}`}>{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Platform Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-3 mb-6">
        {platformStats.map((p, index) => {
          const Icon = platformIcons[p.platform] || Globe;
          return (
            <motion.button
              key={p.platform}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              onClick={() => setPlatformFilter(platformFilter === p.platform ? "all" : p.platform)}
              className={`bg-slate-900 border rounded-xl p-3 text-left transition-all hover:border-slate-600 ${
                platformFilter === p.platform ? "border-emerald-500/50 bg-emerald-500/5" : "border-slate-800"
              }`}
            >
              <Icon className="w-4 h-4 text-slate-500 mb-2" />
              <p className="text-lg font-bold text-white">{p.count}</p>
              <p className="text-[10px] text-slate-500 truncate">{platformLabels[p.platform]}</p>
            </motion.button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Ism, telefon, email, ID bo'yicha qidirish..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-400 hover:text-white transition-all"
          >
            <Filter className="w-4 h-4" />
            Filter
          </button>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 mt-3 border-t border-slate-800">
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Status</label>
                  <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50">
                    <option value="all">Barcha</option>
                    {Object.entries(statusLabels).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Platforma</label>
                  <select value={platformFilter} onChange={(e) => { setPlatformFilter(e.target.value); setCurrentPage(1); }} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50">
                    <option value="all">Barcha</option>
                    {Object.entries(platformLabels).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Viloyat</label>
                  <select value={regionFilter} onChange={(e) => { setRegionFilter(e.target.value); setCurrentPage(1); }} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50">
                    <option value="all">Barcha</option>
                    {regions.map((r) => (
                      <option key={r} value={r}>{r}</option>
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
              </div>
              <div className="pt-3 mt-3 border-t border-slate-800 flex justify-end">
                <button
                  onClick={() => {
                    setSearchQuery(""); setStatusFilter("all"); setPlatformFilter("all");
                    setRegionFilter("all"); setCurrentPage(1);
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-400 hover:text-white transition-all"
                >
                  Tozalash
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bulk Actions */}
      <AnimatePresence>
        {selectedCustomers.size > 0 && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 mb-4">
            <p className="text-sm text-emerald-400 font-medium">{selectedCustomers.size} ta mijoz tanlandi</p>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium rounded-lg transition-colors">
                <Mail className="w-3.5 h-3.5" />
                Xabar yuborish
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-medium rounded-lg transition-colors">
                <Download className="w-3.5 h-3.5" />
                Export
              </button>
              <button onClick={() => setSelectedCustomers(new Set())} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-medium rounded-lg transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
                Tozalash
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Customers Table */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-800/30">
                <th className="py-3 px-4 w-10">
                  <button onClick={toggleSelectAll} className="text-slate-500 hover:text-white transition-colors">
                    {selectedCustomers.size === paginatedCustomers.length && paginatedCustomers.length > 0 ? <CheckSquare className="w-4 h-4 text-emerald-400" /> : <Square className="w-4 h-4" />}
                  </button>
                </th>
                <th className="py-3 px-4 text-left">
                  <button onClick={() => handleSort("firstName")} className="flex items-center gap-1 text-xs font-medium text-slate-500 uppercase tracking-wider hover:text-white transition-colors">
                    Ism <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Telefon</th>
                <th className="py-3 px-4 text-right">
                  <button onClick={() => handleSort("totalOrders")} className="flex items-center gap-1 text-xs font-medium text-slate-500 uppercase tracking-wider hover:text-white transition-colors ml-auto">
                    Buyurtma <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4 text-right">
                  <button onClick={() => handleSort("totalSpent")} className="flex items-center gap-1 text-xs font-medium text-slate-500 uppercase tracking-wider hover:text-white transition-colors ml-auto">
                    Xarajat <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4 text-right">
                  <button onClick={() => handleSort("bonusPoints")} className="flex items-center gap-1 text-xs font-medium text-slate-500 uppercase tracking-wider hover:text-white transition-colors ml-auto">
                    Bonus <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Platforma</th>
                <th className="py-3 px-4 text-left">
                  <button onClick={() => handleSort("registeredAt")} className="flex items-center gap-1 text-xs font-medium text-slate-500 uppercase tracking-wider hover:text-white transition-colors">
                    Sana <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Amallar</th>
              </tr>
            </thead>
            <tbody>
              {paginatedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center">
                    <Users className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                    <p className="text-sm text-slate-500">Mijozlar topilmadi</p>
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map((customer, index) => {
                  const sCfg = statusConfig[customer.status];
                  const isSelected = selectedCustomers.has(customer.id);
                  const PlatformIcon = platformIcons[customer.platform] || Globe;

                  return (
                    <motion.tr
                      key={customer.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.03 }}
                      className={`border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors ${isSelected ? "bg-emerald-500/5" : ""} ${customer.status === "banned" ? "opacity-60" : ""}`}
                    >
                      <td className="py-3.5 px-4">
                        <button onClick={() => toggleSelect(customer.id)} className="text-slate-500 hover:text-white transition-colors">
                          {isSelected ? <CheckSquare className="w-4 h-4 text-emerald-400" /> : <Square className="w-4 h-4" />}
                        </button>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                            customer.status === "banned" ? "bg-red-500/20 text-red-400" :
                            customer.status === "vip" ? "bg-amber-500/20 text-amber-400" :
                            "bg-emerald-500/20 text-emerald-400"
                          }`}>
                            {customer.avatar}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white truncate">{customer.firstName} {customer.lastName}</p>
                            <p className="text-xs text-slate-500">{customer.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-sm text-slate-300">{customer.phone}</span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="text-sm font-semibold text-white">{customer.totalOrders}</span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="text-sm font-semibold text-emerald-400">{(customer.totalSpent / 1000000).toFixed(1)}M</span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="text-sm font-medium text-amber-400">{customer.bonusPoints.toLocaleString()}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${sCfg.bg} ${sCfg.color}`}>
                          {statusLabels[customer.status]}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <PlatformIcon className="w-3.5 h-3.5 text-slate-500" />
                          <span className="text-xs text-slate-400">{platformLabels[customer.platform]}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-sm text-slate-400">{customer.registeredAt}</span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setDetailCustomer(customer)} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-all">
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

        {filteredCustomers.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800">
            <p className="text-xs text-slate-500">
              {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredCustomers.length)} / {filteredCustomers.length} ta
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

      {/* Add Customer Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-6 border-b border-slate-800">
                <h2 className="text-lg font-bold text-white">Yangi mijoz qo'shish</h2>
                <button onClick={() => setShowAddModal(false)} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">Ism</label>
                    <input className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50" placeholder="Ism" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">Familiya</label>
                    <input className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50" placeholder="Familiya" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Telefon</label>
                  <input className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50" placeholder="+998 90 123 45 67" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Email</label>
                  <input className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50" placeholder="email@example.com" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">Viloyat</label>
                    <select className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50">
                      <option>Toshkent</option>
                      <option>Samarqand</option>
                      <option>Farg'ona</option>
                      <option>Andijon</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">Platforma</label>
                    <select className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50">
                      {Object.entries(platformLabels).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Eslatma</label>
                  <textarea rows={2} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50 resize-none" placeholder="Mijoz haqida qo'shimcha ma'lumot..." />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 p-6 pt-0">
                <button onClick={() => setShowAddModal(false)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-white transition-all">Bekor</button>
                <button onClick={() => setShowAddModal(false)} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-all">Qo'shish</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Customer Detail Modal */}
      <AnimatePresence>
        {detailCustomer && (
          <CustomerDetailModal
            customer={detailCustomer}
            onClose={() => setDetailCustomer(null)}
            onBan={handleBan}
            onUnban={handleUnban}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
