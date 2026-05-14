import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Phone,
  Mail,
  MapPin,
  Building2,
  Calendar,
  ShoppingBag,
  Star,
  Ban,
  CheckCircle2,
  AlertTriangle,
  Gift,
  Tag,
  User,
  Activity,
  BarChart3,
  ShieldCheck,
  ShieldX,
} from "lucide-react";
import type { Customer } from "../data/customersData";
import { platformLabels, statusLabels, statusConfig } from "../data/customersData";

interface Props {
  customer: Customer | null;
  onClose: () => void;
  onStatusChange?: (customerId: string, newStatus: string) => void;
  onBan?: (customerId: string) => void;
  onUnban?: (customerId: string) => void;
}

type Tab = "overview" | "orders" | "analytics" | "activity";

const orderStatusConfig: Record<string, { color: string; label: string }> = {
  completed: { color: "text-emerald-400", label: "Bajarildi" },
  processing: { color: "text-blue-400", label: "Jarayonda" },
  cancelled: { color: "text-red-400", label: "Bekor" },
  refunded: { color: "text-slate-400", label: "Qaytarildi" },
};

const activityIcons: Record<string, React.ElementType> = {
  order: ShoppingBag,
  login: User,
  view: Eye,
  review: Star,
  referral: Gift,
  bonus: Gift,
  ban: ShieldX,
  unban: ShieldCheck,
};

function Eye(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
  );
}

export default function CustomerDetailModal({ customer, onClose, onBan, onUnban }: Props) {
  if (!customer) return null;

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [showBanConfirm, setShowBanConfirm] = useState(false);

  const status = statusConfig[customer.status];

  // Analytics
  const categoryBreakdown = useMemo(() => {
    const cats: Record<string, { count: number; spent: number }> = {};
    customer.orders.forEach((o) => {
      if (!cats[o.category]) cats[o.category] = { count: 0, spent: 0 };
      cats[o.category].count += o.quantity;
      cats[o.category].spent += o.total;
    });
    return Object.entries(cats).sort((a, b) => b[1].spent - a[1].spent);
  }, [customer.orders]);

  const favoriteProduct = customer.orders.length > 0
    ? customer.orders.reduce((prev, curr) => prev.quantity > curr.quantity ? prev : curr)
    : null;

  const monthlySpending = useMemo(() => {
    const months: Record<string, number> = {};
    customer.orders.forEach((o) => {
      const month = o.date.slice(0, 7);
      months[month] = (months[month] || 0) + o.total;
    });
    return Object.entries(months).sort().slice(-6);
  }, [customer.orders]);

  const tabs = [
    { key: "overview" as Tab, label: "Umumiy", icon: User },
    { key: "orders" as Tab, label: "Buyurtmalar", icon: ShoppingBag },
    { key: "analytics" as Tab, label: "Analitika", icon: BarChart3 },
    { key: "activity" as Tab, label: "Faoliyat", icon: Activity },
  ];

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
              <div className={`w-16 h-16 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0 ${
                customer.status === "banned" ? "bg-red-500/20 text-red-400" :
                customer.status === "vip" ? "bg-amber-500/20 text-amber-400" :
                "bg-emerald-500/20 text-emerald-400"
              }`}>
                {customer.avatar}
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">{customer.firstName} {customer.lastName}</h2>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${status.bg} ${status.color}`}>
                    {statusLabels[customer.status]}
                  </span>
                  <span className="text-xs text-slate-500">{customer.id}</span>
                  {customer.gender && (
                    <span className="text-xs text-slate-500">{customer.gender === "male" ? "Erkak" : "Ayol"}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {customer.status !== "banned" ? (
                <button
                  onClick={() => setShowBanConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm font-medium rounded-lg transition-all"
                >
                  <Ban className="w-4 h-4" />
                  Ban
                </button>
              ) : (
                <button
                  onClick={() => onUnban?.(customer.id)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 text-sm font-medium rounded-lg transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Ban ochish
                </button>
              )}
              <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Ban Confirm */}
          <AnimatePresence>
            {showBanConfirm && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-b border-slate-800"
              >
                <div className="p-4 bg-red-500/5 flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-red-400 font-medium">Mijozni ban qilishni tasdiqlaysizmi?</p>
                    <p className="text-xs text-slate-500 mt-0.5">Bu mijoz tizimga kira olmaydi va buyurtma bera olmaydi.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowBanConfirm(false)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors">Bekor</button>
                    <button onClick={() => { onBan?.(customer.id); setShowBanConfirm(false); }} className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-lg transition-colors">Ban qilish</button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-6 pb-0">
            <div className="bg-slate-800/50 rounded-xl p-3">
              <p className="text-[10px] text-slate-500 uppercase">Jami xarajat</p>
              <p className="text-lg font-bold text-emerald-400">{customer.totalSpent.toLocaleString()}</p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-3">
              <p className="text-[10px] text-slate-500 uppercase">Buyurtmalar</p>
              <p className="text-lg font-bold text-white">{customer.totalOrders}</p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-3">
              <p className="text-[10px] text-slate-500 uppercase">O'rtacha chek</p>
              <p className="text-lg font-bold text-white">{customer.avgOrderValue.toLocaleString()}</p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-3">
              <p className="text-[10px] text-slate-500 uppercase">Bonus ballar</p>
              <p className="text-lg font-bold text-amber-400">{customer.bonusPoints.toLocaleString()}</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 px-4 pt-4 mt-4 border-b border-slate-800">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all ${
                    activeTab === tab.key ? "text-emerald-400 border-b-2 border-emerald-400" : "text-slate-500 hover:text-white"
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
              {/* OVERVIEW */}
              {activeTab === "overview" && (
                <motion.div key="overview" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-5">
                  {/* Contact */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-slate-800/50 rounded-xl p-4">
                      <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                        <Phone className="w-4 h-4 text-slate-400" />
                        Aloqa ma'lumotlari
                      </h3>
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                          <span className="text-white">{customer.phone}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                          <span className="text-white">{customer.email}</span>
                        </div>
                        {customer.birthday && (
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                            <span className="text-slate-300">Tug'ilgan sana: {customer.birthday}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-4">
                      <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        Manzil
                      </h3>
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                          <span className="text-white">{customer.region}, {customer.city}</span>
                        </div>
                        <div className="flex items-start gap-2 text-sm">
                          <Building2 className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 mt-0.5" />
                          <span className="text-slate-300">{customer.address}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Platform & Dates */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-slate-800/50 rounded-xl p-4">
                      <p className="text-xs text-slate-500">Platforma</p>
                      <p className="text-base font-bold text-white mt-1">{platformLabels[customer.platform]}</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-4">
                      <p className="text-xs text-slate-500">Ro'yxatdan o'tgan</p>
                      <p className="text-base font-bold text-white mt-1">{customer.registeredAt}</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-4">
                      <p className="text-xs text-slate-500">So'nggi buyurtma</p>
                      <p className="text-base font-bold text-white mt-1">{customer.lastOrderDate || "—"}</p>
                    </div>
                  </div>

                  {/* Referral */}
                  {(customer.referralCode || customer.referredBy) && (
                    <div className="bg-slate-800/30 rounded-xl p-4">
                      <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                        <Gift className="w-4 h-4 text-emerald-400" />
                        Referral dasturi
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        {customer.referralCode && (
                          <div>
                            <p className="text-xs text-slate-500">Referral kodi</p>
                            <p className="text-sm font-mono font-medium text-emerald-400 mt-0.5">{customer.referralCode}</p>
                          </div>
                        )}
                        {customer.referredBy && (
                          <div>
                            <p className="text-xs text-slate-500">Kim orqali kelgan</p>
                            <p className="text-sm text-white mt-0.5">{customer.referredBy}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tags & Notes */}
                  <div className="bg-slate-800/30 rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                      <Tag className="w-4 h-4 text-slate-400" />
                      Teglar va eslatmalar
                    </h3>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {customer.tags.map((tag) => (
                        <span key={tag} className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed">{customer.notes}</p>
                  </div>
                </motion.div>
              )}

              {/* ORDERS */}
              {activeTab === "orders" && (
                <motion.div key="orders" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
                  {customer.orders.length === 0 ? (
                    <div className="py-12 text-center">
                      <ShoppingBag className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                      <p className="text-sm text-slate-500">Hali buyurtmalar yo'q</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-slate-800/50 rounded-xl p-3">
                          <p className="text-[10px] text-slate-500">Jami buyurtma</p>
                          <p className="text-xl font-bold text-white">{customer.totalOrders}</p>
                        </div>
                        <div className="bg-slate-800/50 rounded-xl p-3">
                          <p className="text-[10px] text-slate-500">Bajarilgan</p>
                          <p className="text-xl font-bold text-emerald-400">{customer.orders.filter((o) => o.status === "completed").length}</p>
                        </div>
                        <div className="bg-slate-800/50 rounded-xl p-3">
                          <p className="text-[10px] text-slate-500">Bekor</p>
                          <p className="text-xl font-bold text-red-400">{customer.orders.filter((o) => o.status === "cancelled").length}</p>
                        </div>
                        <div className="bg-slate-800/50 rounded-xl p-3">
                          <p className="text-[10px] text-slate-500">Jarayonda</p>
                          <p className="text-xl font-bold text-blue-400">{customer.orders.filter((o) => o.status === "processing").length}</p>
                        </div>
                      </div>
                      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-slate-800 bg-slate-800/30">
                              <th className="py-2.5 px-4 text-left text-xs text-slate-500 uppercase">ID</th>
                              <th className="py-2.5 px-4 text-left text-xs text-slate-500 uppercase">Tovar</th>
                              <th className="py-2.5 px-4 text-left text-xs text-slate-500 uppercase">Kategoriya</th>
                              <th className="py-2.5 px-4 text-right text-xs text-slate-500 uppercase">Soni</th>
                              <th className="py-2.5 px-4 text-right text-xs text-slate-500 uppercase">Jami</th>
                              <th className="py-2.5 px-4 text-left text-xs text-slate-500 uppercase">Status</th>
                              <th className="py-2.5 px-4 text-left text-xs text-slate-500 uppercase">Sana</th>
                            </tr>
                          </thead>
                          <tbody>
                            {customer.orders.map((order, i) => {
                              const os = orderStatusConfig[order.status];
                              return (
                                <motion.tr key={order.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                                  <td className="py-2.5 px-4 text-sm text-slate-400">{order.id}</td>
                                  <td className="py-2.5 px-4 text-sm text-white">{order.product}</td>
                                  <td className="py-2.5 px-4 text-sm text-slate-400">{order.category}</td>
                                  <td className="py-2.5 px-4 text-sm text-white text-right">{order.quantity}</td>
                                  <td className="py-2.5 px-4 text-sm font-semibold text-emerald-400 text-right">{order.total.toLocaleString()}</td>
                                  <td className="py-2.5 px-4"><span className={`text-xs font-medium ${os.color}`}>{os.label}</span></td>
                                  <td className="py-2.5 px-4 text-sm text-slate-400">{order.date}</td>
                                </motion.tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </motion.div>
              )}

              {/* ANALYTICS */}
              {activeTab === "analytics" && (
                <motion.div key="analytics" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-5">
                  {/* Favorite Category */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-slate-800/50 rounded-xl p-4">
                      <h3 className="text-sm font-semibold text-white mb-3">Saralangan kategoriyalar</h3>
                      {categoryBreakdown.length === 0 ? (
                        <p className="text-sm text-slate-500">Ma'lumot yo'q</p>
                      ) : (
                        <div className="space-y-2">
                          {categoryBreakdown.map(([cat, data], i) => (
                            <div key={cat}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-slate-300">{cat}</span>
                                <span className="text-xs text-emerald-400">{data.spent.toLocaleString()} so'm</span>
                              </div>
                              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                <motion.div initial={{ width: 0 }} animate={{ width: `${(data.spent / (categoryBreakdown[0][1].spent || 1)) * 100}%` }} transition={{ duration: 0.5, delay: i * 0.1 }} className="h-full bg-emerald-500 rounded-full" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-4">
                      <h3 className="text-sm font-semibold text-white mb-3">Eng ko'p sotib olingan</h3>
                      {favoriteProduct ? (
                        <div>
                          <p className="text-base font-bold text-white">{favoriteProduct.product}</p>
                          <p className="text-sm text-slate-500 mt-1">{favoriteProduct.category}</p>
                          <div className="grid grid-cols-2 gap-3 mt-3">
                            <div>
                              <p className="text-xs text-slate-500">Soni</p>
                              <p className="text-lg font-bold text-emerald-400">{favoriteProduct.quantity}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Summa</p>
                              <p className="text-lg font-bold text-white">{favoriteProduct.total.toLocaleString()}</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">Ma'lumot yo'q</p>
                      )}
                    </div>
                  </div>

                  {/* Monthly Spending */}
                  <div className="bg-slate-800/30 rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-white mb-3">Oylik xarajatlar</h3>
                    {monthlySpending.length === 0 ? (
                      <p className="text-sm text-slate-500">Ma'lumot yo'q</p>
                    ) : (
                      <div className="space-y-2">
                        {monthlySpending.map(([month, spent], i) => (
                          <div key={month}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-slate-300">{month}</span>
                              <span className="text-xs text-emerald-400">{spent.toLocaleString()} so'm</span>
                            </div>
                            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                              <motion.div initial={{ width: 0 }} animate={{ width: `${(spent / Math.max(...monthlySpending.map((m) => m[1]))) * 100}%` }} transition={{ duration: 0.5, delay: i * 0.1 }} className="h-full bg-emerald-500 rounded-full" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Customer Value Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-800/50 rounded-xl p-3 text-center">
                      <p className="text-[10px] text-slate-500">Birinchi buyurtma</p>
                      <p className="text-sm font-bold text-white mt-1">{customer.firstOrderDate || "—"}</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-3 text-center">
                      <p className="text-[10px] text-slate-500">Mijoz umri</p>
                      <p className="text-sm font-bold text-white mt-1">{customer.firstOrderDate ? Math.ceil((Date.now() - new Date(customer.firstOrderDate).getTime()) / (1000 * 60 * 60 * 24)) + " kun" : "—"}</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-3 text-center">
                      <p className="text-[10px] text-slate-500">Qayta sotib olish</p>
                      <p className="text-sm font-bold text-white mt-1">{customer.totalOrders > 1 ? "Ha" : "Yo'q"}</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-3 text-center">
                      <p className="text-[10px] text-slate-500">Loyalty darajasi</p>
                      <p className="text-sm font-bold text-amber-400 mt-1">{customer.totalSpent > 40000000 ? "Oltin" : customer.totalSpent > 20000000 ? "Kumush" : "Bronza"}</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ACTIVITY */}
              {activeTab === "activity" && (
                <motion.div key="activity" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
                  <div className="relative">
                    <div className="absolute left-[19px] top-2 bottom-2 w-px bg-slate-800" />
                    <div className="space-y-3">
                      {customer.activities.map((act, i) => {
                        const Icon = activityIcons[act.type] || Activity;
                        return (
                          <motion.div key={act.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex items-start gap-3 relative">
                            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0 z-10">
                              <Icon className="w-4 h-4 text-slate-400" />
                            </div>
                            <div className="flex-1 bg-slate-800/30 rounded-xl p-3">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium text-white capitalize">{act.type}</span>
                                <span className="text-xs text-slate-500">{act.date}</span>
                              </div>
                              <p className="text-sm text-slate-300">{act.description}</p>
                              {act.value && <p className="text-xs text-emerald-400 mt-1">{act.value.toLocaleString()}</p>}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
