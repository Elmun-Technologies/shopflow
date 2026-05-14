import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Settings, Eye, CheckCircle2, XCircle, Clock,
  Banknote, MousePointerClick, CreditCard, CalendarClock, Wallet,
  TrendingUp, ChevronLeft, ChevronRight,
  Copy, ExternalLink, BookOpen, Save, X,
  AlertTriangle, Check, DollarSign,
  Activity, ShieldCheck, Download,
} from "lucide-react";
import {
  paymentMethods, transactions, dailyPaymentStats, methodColors,
} from "../data/paymentsData";
import type { PaymentMethod, PaymentConfig } from "../data/paymentsData";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

const statusConfig: Record<string, { color: string; bg: string; label: string; icon: any }> = {
  active: { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", label: "Faol", icon: CheckCircle2 },
  inactive: { color: "text-slate-400", bg: "bg-slate-500/10 border-slate-500/20", label: "Nofaol", icon: XCircle },
  pending: { color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", label: "Kutilmoqda", icon: Clock },
  error: { color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", label: "Xatolik", icon: AlertTriangle },
};

const txnStatusConfig: Record<string, { color: string; label: string }> = {
  success: { color: "text-emerald-400", label: "Muvaffaqiyatli" },
  pending: { color: "text-amber-400", label: "Kutilmoqda" },
  failed: { color: "text-red-400", label: "Bekor" },
  refunded: { color: "text-slate-400", label: "Qaytarildi" },
};

const iconMap: Record<string, React.ElementType> = {
  Banknote, MousePointerClick, CreditCard, CalendarClock, Wallet,
};

export default function PaymentsPage() {
  const [methods, setMethods] = useState<PaymentMethod[]>(paymentMethods);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [txnFilter, setTxnFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [savedMessage, setSavedMessage] = useState("");
  const [testMode, setTestMode] = useState<Record<string, boolean>>({});

  const filteredMethods = useMemo(() => {
    let result = [...methods];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((m) => m.name.toLowerCase().includes(q) || m.code.includes(q));
    }
    return result;
  }, [searchQuery, methods]);

  const filteredTxns = useMemo(() => {
    let result = [...transactions];
    if (txnFilter !== "all") result = result.filter((t) => t.status === txnFilter);
    return result;
  }, [txnFilter]);

  const totalPages = Math.ceil(filteredTxns.length / itemsPerPage);
  const paginatedTxns = filteredTxns.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const toggleMethod = (id: string) => {
    setMethods((prev) => prev.map((m) => {
      if (m.id !== id) return m;
      const newStatus = m.status === "active" ? "inactive" : "active";
      return { ...m, status: newStatus as any, lastUpdated: new Date().toISOString() };
    }));
  };

  const saveConfig = (id: string, config: PaymentConfig) => {
    setMethods((prev) => prev.map((m) => m.id === id ? { ...m, config, lastUpdated: new Date().toISOString() } : m));
    setSavedMessage("Sozlamalar saqlandi!");
    setTimeout(() => setSavedMessage(""), 2000);
    setShowConfig(false);
    setSelectedMethod(null);
  };

  const totalRevenue = methods.reduce((s, m) => s + m.stats.totalAmount, 0);
  const totalTxns = methods.reduce((s, m) => s + m.stats.totalTransactions, 0);
  const avgSuccess = methods.length > 0 ? (methods.reduce((s, m) => s + m.stats.successRate, 0) / methods.length).toFixed(1) : "0";
  const todayRevenue = methods.reduce((s, m) => s + m.stats.todayAmount, 0);

  const pieData = methods.map((m) => ({ name: m.nameUz, value: m.stats.totalTransactions, color: methodColors[m.nameUz] || "#64748b" }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-xl">
          <p className="text-xs text-white font-medium">{payload[0].payload.date}</p>
          {payload.map((p: any, i: number) => (
            <p key={i} className="text-xs" style={{ color: p.color }}>{p.name}: {p.value} ta</p>
          ))}
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
          <h1 className="text-2xl font-bold text-white">Способы оплаты</h1>
          <p className="text-sm text-slate-500 mt-1">To'lov usullarini sozlash va monitoring</p>
        </div>
        {savedMessage && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
            <Check className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-emerald-400">{savedMessage}</span>
          </motion.div>
        )}
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Jami daromad", value: (totalRevenue / 1000000).toFixed(1) + "M so'm", icon: DollarSign, color: "text-emerald-400" },
          { label: "Jami tranzaksiyalar", value: totalTxns.toLocaleString(), icon: Activity, color: "text-blue-400" },
          { label: "O'rtacha muvaffaqiyat", value: avgSuccess + "%", icon: ShieldCheck, color: "text-violet-400" },
          { label: "Bugun", value: (todayRevenue / 1000000).toFixed(1) + "M so'm", icon: TrendingUp, color: "text-amber-400" },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <p className="text-xs text-slate-500">{stat.label}</p>
            </div>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Kunlik tranzaksiyalar</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyPaymentStats} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="click" name="Click" fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={20} />
                <Bar dataKey="payme" name="Payme" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={20} />
                <Bar dataKey="uzum" name="Uzum" fill="#f59e0b" radius={[3, 3, 0, 0]} maxBarSize={20} />
                <Bar dataKey="alif" name="Alif" fill="#8b5cf6" radius={[3, 3, 0, 0]} maxBarSize={20} />
                <Bar dataKey="cash" name="Naqd" fill="#64748b" radius={[3, 3, 0, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Usullar bo'yicha</h3>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value" stroke="none">
                  {pieData.map((entry, index) => (<Cell key={index} fill={entry.color} />))}
                </Pie>
                <Tooltip content={({ active, payload }: any) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-xl">
                        <p className="text-xs text-white font-medium">{payload[0].name}</p>
                        <p className="text-xs text-slate-400">{payload[0].value} ta tranzaksiya</p>
                      </div>
                    );
                  }
                  return null;
                }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5 mt-2">
            {pieData.map((d) => (
              <div key={d.name} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-xs text-slate-400">{d.name}</span>
                </div>
                <span className="text-xs text-white font-medium">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Payment Methods */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">To'lov usullari</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Qidirish..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {filteredMethods.map((method, index) => {
            const st = statusConfig[method.status];
            const StatusIcon = st.icon;
            const MethodIcon = iconMap[method.icon] || Banknote;

            return (
              <motion.div
                key={method.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${method.status === "active" ? "bg-emerald-500/10" : "bg-slate-800"}`}>
                      <MethodIcon className={`w-6 h-6 ${method.status === "active" ? "text-emerald-400" : "text-slate-500"}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-white">{method.name}</h3>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${st.bg} ${st.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {st.label}
                        </span>
                        {method.type === "installment" && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[10px] font-medium">Nasiya</span>
                        )}
                      </div>
                      <p className="text-sm text-slate-400 mt-1">{method.description}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-xs text-slate-500">Oxirgi yangilanish: {new Date(method.lastUpdated).toLocaleString("uz-UZ", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short", year: "numeric" })}</span>
                        {method.config.commissionPercent !== undefined && (
                          <span className="text-xs text-slate-500">Komissiya: {method.config.commissionPercent}%</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => {
                        setSelectedMethod(method);
                        setShowConfig(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs text-white transition-all"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      Sozlash
                    </button>
                    <button
                      onClick={() => toggleMethod(method.id)}
                      className={`relative w-11 h-6 rounded-full transition-all ${method.status === "active" ? "bg-emerald-500" : "bg-slate-700"}`}
                    >
                      <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${method.status === "active" ? "left-5" : "left-0.5"}`} />
                    </button>
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-5 gap-3 mt-4 pt-4 border-t border-slate-800">
                  <div>
                    <p className="text-[10px] text-slate-500">Tranzaksiyalar</p>
                    <p className="text-sm font-bold text-white">{method.stats.totalTransactions.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500">Daromad</p>
                    <p className="text-sm font-bold text-emerald-400">{(method.stats.totalAmount / 1000000).toFixed(1)}M</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500">Muvaffaqiyat</p>
                    <p className="text-sm font-bold text-white">{method.stats.successRate}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500">O'rtacha</p>
                    <p className="text-sm font-bold text-white">{(method.stats.avgAmount / 1000).toFixed(0)}k</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500">Bugun</p>
                    <p className="text-sm font-bold text-amber-400">{method.stats.todayTransactions}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">So'nggi tranzaksiyalar</h3>
          <div className="flex items-center gap-2">
            <select value={txnFilter} onChange={(e) => setTxnFilter(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none">
              <option value="all">Barcha</option>
              <option value="success">Muvaffaqiyatli</option>
              <option value="pending">Kutilmoqda</option>
              <option value="failed">Bekor</option>
              <option value="refunded">Qaytarildi</option>
            </select>
            <button className="flex items-center gap-1 px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-400 hover:text-white transition-all">
              <Download className="w-3 h-3" />
              Export
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-800/30">
                <th className="py-3 px-5 text-left text-xs text-slate-500 uppercase">ID</th>
                <th className="py-3 px-5 text-left text-xs text-slate-500 uppercase">Buyurtma</th>
                <th className="py-3 px-5 text-left text-xs text-slate-500 uppercase">Mijoz</th>
                <th className="py-3 px-5 text-left text-xs text-slate-500 uppercase">Usul</th>
                <th className="py-3 px-5 text-right text-xs text-slate-500 uppercase">Summa</th>
                <th className="py-3 px-5 text-left text-xs text-slate-500 uppercase">Status</th>
                <th className="py-3 px-5 text-left text-xs text-slate-500 uppercase">Sana</th>
              </tr>
            </thead>
            <tbody>
              {paginatedTxns.map((txn, i) => {
                const ts = txnStatusConfig[txn.status];
                return (
                  <motion.tr key={txn.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-5 text-sm text-slate-400">{txn.id}</td>
                    <td className="py-3 px-5 text-sm text-white">{txn.orderId}</td>
                    <td className="py-3 px-5">
                      <p className="text-sm text-white">{txn.customer}</p>
                      <p className="text-xs text-slate-500">{txn.phone}</p>
                    </td>
                    <td className="py-3 px-5">
                      <span className="text-xs font-medium" style={{ color: methodColors[txn.method] || "#94a3b8" }}>{txn.method}</span>
                      {txn.installmentMonths && <p className="text-[10px] text-slate-500">{txn.installmentMonths} oy</p>}
                    </td>
                    <td className="py-3 px-5 text-sm font-semibold text-white text-right">{txn.amount.toLocaleString()}</td>
                    <td className="py-3 px-5">
                      <span className={`text-xs font-medium ${ts.color}`}>{ts.label}</span>
                      {txn.errorMessage && <p className="text-[10px] text-red-400 mt-0.5">{txn.errorMessage}</p>}
                    </td>
                    <td className="py-3 px-5 text-sm text-slate-400">{txn.createdAt}</td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredTxns.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800">
            <p className="text-xs text-slate-500">
              {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredTxns.length)} / {filteredTxns.length} ta
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
      </div>

      {/* Config Modal */}
      <AnimatePresence>
        {showConfig && selectedMethod && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => { setShowConfig(false); setSelectedMethod(null); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-800">
                <div>
                  <h2 className="text-lg font-bold text-white">{selectedMethod.name} sozlamalari</h2>
                  <p className="text-sm text-slate-500 mt-0.5">Integratsiya ma'lumotlari</p>
                </div>
                <button onClick={() => { setShowConfig(false); setSelectedMethod(null); }} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Test mode */}
                <div className="flex items-center justify-between bg-slate-800/50 rounded-xl p-3">
                  <div>
                    <p className="text-sm text-white">Test rejimi</p>
                    <p className="text-xs text-slate-500">Haqiqiy to'lovlarni o'tkazmaydi</p>
                  </div>
                  <button
                    onClick={() => setTestMode((prev) => ({ ...prev, [selectedMethod.id]: !(prev[selectedMethod.id] ?? selectedMethod.config.testMode) }))}
                    className={`relative w-11 h-6 rounded-full transition-all ${(testMode[selectedMethod.id] ?? selectedMethod.config.testMode) ? "bg-amber-500" : "bg-slate-700"}`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${(testMode[selectedMethod.id] ?? selectedMethod.config.testMode) ? "left-5" : "left-0.5"}`} />
                  </button>
                </div>

                {/* Config fields */}
                {selectedMethod.config.merchantId !== undefined && (
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">Merchant ID</label>
                    <div className="flex items-center gap-2">
                      <input defaultValue={selectedMethod.config.merchantId} className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50" />
                      <button className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors" title="Nusxa olish">
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
                {selectedMethod.config.serviceId !== undefined && (
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">Service ID</label>
                    <input defaultValue={selectedMethod.config.serviceId} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50" />
                  </div>
                )}
                {selectedMethod.config.apiKey !== undefined && (
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">API Key</label>
                    <div className="flex items-center gap-2">
                      <input type="password" defaultValue={selectedMethod.config.apiKey} className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50" />
                      <button className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors">
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
                {selectedMethod.config.secretKey !== undefined && (
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">Secret Key</label>
                    <div className="flex items-center gap-2">
                      <input type="password" defaultValue={selectedMethod.config.secretKey} className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50" />
                      <button className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors">
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
                {selectedMethod.config.terminalId !== undefined && (
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">Terminal ID</label>
                    <input defaultValue={selectedMethod.config.terminalId} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50" />
                  </div>
                )}
                {selectedMethod.config.login !== undefined && (
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">Login</label>
                    <input defaultValue={selectedMethod.config.login} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50" />
                  </div>
                )}
                {selectedMethod.config.password !== undefined && (
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">Parol</label>
                    <input type="password" defaultValue={selectedMethod.config.password} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50" />
                  </div>
                )}
                {selectedMethod.config.webhookUrl !== undefined && (
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">Webhook URL</label>
                    <div className="flex items-center gap-2">
                      <input defaultValue={selectedMethod.config.webhookUrl} className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-400" readOnly />
                      <button className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors">
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
                {selectedMethod.config.redirectUrl !== undefined && (
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">Redirect URL</label>
                    <input defaultValue={selectedMethod.config.redirectUrl} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50" />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">Minimal summa</label>
                    <input type="number" defaultValue={selectedMethod.config.minAmount} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">Maksimal summa</label>
                    <input type="number" defaultValue={selectedMethod.config.maxAmount} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50" />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Komissiya (%)</label>
                  <input type="number" step="0.1" defaultValue={selectedMethod.config.commissionPercent} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50" />
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-xs text-slate-500">Avtomatik tasdiqlash</label>
                  <button
                    className={`relative w-8 h-4 rounded-full transition-all ${selectedMethod.config.autoConfirm ? "bg-emerald-500" : "bg-slate-700"}`}
                  >
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${selectedMethod.config.autoConfirm ? "left-4" : "left-0.5"}`} />
                  </button>
                </div>

                {/* Links */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                  {selectedMethod.docsUrl && (
                    <a href={selectedMethod.docsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
                      <BookOpen className="w-3.5 h-3.5" />
                      Hujjatlar
                    </a>
                  )}
                  {selectedMethod.integrationUrl && (
                    <a href={selectedMethod.integrationUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" />
                      API docs
                    </a>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 p-6 pt-0">
                <button onClick={() => { setShowConfig(false); setSelectedMethod(null); }} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-white transition-all">Bekor</button>
                <button onClick={() => saveConfig(selectedMethod.id, selectedMethod.config)} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-all">
                  <Save className="w-4 h-4" />
                  Saqlash
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
