import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Plus, Settings, Eye, Trash2, Copy, Save, X,
  MapPin, Truck, Store, Package, Clock, CheckCircle2, XCircle,
  ChevronLeft, ChevronRight, Download,
  DollarSign, Edit3,
} from "lucide-react";
import {
  pharmacies, deliveryMethods, deliveryOrders, deliveryRegions,
  dailyDeliveryStats, methodDeliveryColors,
} from "../data/deliveryData";
import type { Pharmacy, DeliveryMethod, DeliveryOrder, DeliveryRegion } from "../data/deliveryData";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import type { ChartTooltipProps } from "../utils/chart";
import { useT } from "../i18n";

type Tab = "methods" | "pharmacies" | "regions" | "orders";
type DeliveryStatus = "active" | "inactive" | "pending" | "closed";

const statusConfig: Record<DeliveryStatus, { color: string; bg: string; label: string; icon: React.ElementType }> = {
  active: { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", label: "Faol", icon: CheckCircle2 },
  inactive: { color: "text-slate-400", bg: "bg-slate-500/10 border-slate-500/20", label: "Nofaol", icon: XCircle },
  pending: { color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", label: "Kutilmoqda", icon: Clock },
  closed: { color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", label: "Yopiq", icon: XCircle },
};

const orderStatusConfig: Record<string, { color: string; label: string }> = {
  pending: { color: "text-amber-400", label: "Kutilmoqda" },
  processing: { color: "text-blue-400", label: "Tayyorlanmoqda" },
  shipped: { color: "text-violet-400", label: "Yuborildi" },
  delivered: { color: "text-emerald-400", label: "Yetkazildi" },
  cancelled: { color: "text-red-400", label: "Bekor" },
  returned: { color: "text-slate-400", label: "Qaytarildi" },
};

function CustomTooltip({ active, payload }: ChartTooltipProps) {
  if (active && payload && payload.length) {
    const date = (payload[0].payload as { date?: string } | undefined)?.date ?? "";
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-xl">
        <p className="text-xs text-white font-medium">{date}</p>
        {payload.map((p) => (
          <p key={p.dataKey ?? p.name} className="text-xs" style={{ color: p.color }}>{p.name}: {p.value}</p>
        ))}
      </div>
    );
  }
  return null;
}

interface PharmacyFormProps {
  initial?: Pharmacy;
  onSubmit: (data: Omit<Pharmacy, "id" | "createdAt">) => void;
  onClose: () => void;
  title: string;
}

function PharmacyForm({ initial, onSubmit, onClose, title }: PharmacyFormProps) {
  const [form, setForm] = useState<Omit<Pharmacy, "id" | "createdAt">>(
    initial
      ? {
          name: initial.name,
          address: initial.address,
          city: initial.city,
          region: initial.region,
          phone: initial.phone,
          workingHours: initial.workingHours,
          lat: initial.lat,
          lng: initial.lng,
          status: initial.status,
          productsCount: initial.productsCount,
          manager: initial.manager,
          hasPickup: initial.hasPickup,
          hasDelivery: initial.hasDelivery,
          deliveryRadius: initial.deliveryRadius,
        }
      : {
          name: "", address: "", city: "Toshkent", region: "Toshkent shahri",
          phone: "", workingHours: "09:00 - 21:00", lat: 41.2995, lng: 69.2401,
          status: "active", productsCount: 0, manager: "", hasPickup: true, hasDelivery: false, deliveryRadius: 0,
        }
  );
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-3">
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Nomi</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50" placeholder="Apteka nomi" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1.5 block">Viloyat</label>
              <select value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
                <option>Toshkent shahri</option>
                <option>Samarqand viloyati</option>
                <option>Farg'ona viloyati</option>
                <option>Andijon viloyati</option>
                <option>Buxoro viloyati</option>
                <option>Namangan viloyati</option>
                <option>Qashqadaryo viloyati</option>
                <option>Xorazm viloyati</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1.5 block">Shahar</label>
              <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50" />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Manzil</label>
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50" placeholder="To'liq manzil" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1.5 block">Telefon</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50" placeholder="+998 90 123 45 67" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1.5 block">Ish vaqti</label>
              <input value={form.workingHours} onChange={(e) => setForm({ ...form, workingHours: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50" placeholder="09:00 - 21:00" />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Menejer</label>
            <input value={form.manager} onChange={(e) => setForm({ ...form, manager: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50" placeholder="Ism familiya" />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={form.hasPickup} onChange={(e) => setForm({ ...form, hasPickup: e.target.checked })} className="w-4 h-4 rounded border-slate-600" />
              Olib ketish
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={form.hasDelivery} onChange={(e) => setForm({ ...form, hasDelivery: e.target.checked })} className="w-4 h-4 rounded border-slate-600" />
              Yetkazib berish
            </label>
          </div>
          {form.hasDelivery && (
            <div>
              <label className="text-xs text-slate-500 mb-1.5 block">Yetkazib berish radiusi (km)</label>
              <input type="number" value={form.deliveryRadius} onChange={(e) => setForm({ ...form, deliveryRadius: parseInt(e.target.value) || 0 })} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50" />
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 p-6 pt-0">
          <button onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-white transition-all">Bekor</button>
          <button onClick={() => onSubmit(form)} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-all">
            <Save className="w-4 h-4" />
            Saqlash
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function DeliveryPage() {
  const { t } = useT();
  const [activeTab, setActiveTab] = useState<Tab>("methods");
  const [pharmacyList, setPharmacyList] = useState<Pharmacy[]>(pharmacies);
  const [methodList, setMethodList] = useState<DeliveryMethod[]>(deliveryMethods);
  const [orderList] = useState<DeliveryOrder[]>(deliveryOrders);
  const [regionList, setRegionList] = useState<DeliveryRegion[]>(deliveryRegions);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddPharmacy, setShowAddPharmacy] = useState(false);
  const [showEditPharmacy, setShowEditPharmacy] = useState<Pharmacy | null>(null);
  const [showMethodConfig, setShowMethodConfig] = useState<DeliveryMethod | null>(null);
  const [savedMessage, setSavedMessage] = useState("");
  const [orderFilter, setOrderFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const filteredOrders = useMemo(() => {
    let result = [...orderList];
    if (orderFilter !== "all") result = result.filter((o) => o.status === orderFilter);
    return result;
  }, [orderFilter, orderList]);

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const toggleMethod = (id: string) => {
    setMethodList((prev) => prev.map((m) => m.id === id ? { ...m, status: (m.status === "active" ? "inactive" : "active") as DeliveryMethod["status"] } : m));
  };

  const addPharmacy = (pharmacy: Omit<Pharmacy, "id" | "createdAt">) => {
    const newPharmacy: Pharmacy = {
      ...pharmacy,
      id: `PH-${Date.now()}`,
      createdAt: new Date().toISOString().split("T")[0],
    };
    setPharmacyList((prev) => [...prev, newPharmacy]);
    setShowAddPharmacy(false);
    setSavedMessage("Apteka qo'shildi!");
    setTimeout(() => setSavedMessage(""), 2000);
  };

  const updatePharmacy = (id: string, data: Partial<Pharmacy>) => {
    setPharmacyList((prev) => prev.map((p) => p.id === id ? { ...p, ...data } : p));
    setShowEditPharmacy(null);
    setSavedMessage("Saqlandi!");
    setTimeout(() => setSavedMessage(""), 2000);
  };

  const deletePharmacy = (id: string) => {
    setPharmacyList((prev) => prev.filter((p) => p.id !== id));
  };

  const toggleRegion = (index: number) => {
    setRegionList((prev) => prev.map((r, i) => i === index ? { ...r, active: !r.active } : r));
  };

  // Stats — bo'sh massiv yoki stats yo'q usulda crash bo'lmasligi uchun ?. va ?? 0
  const pickupMethod = methodList.find((m) => m.code === "pickup");
  const totalPickupOrders = pickupMethod?.stats?.totalOrders ?? 0;
  const totalCourierOrders = methodList
    .filter((m) => m.type === "courier" && m.status === "active")
    .reduce((s, m) => s + (m.stats?.totalOrders ?? 0), 0);
  const totalDeliveryCost = methodList.reduce((s, m) => s + (m.stats?.totalCost ?? 0), 0);
  const activePharmacies = pharmacyList.filter((p) => p.status === "active").length;

  const pieData = methodList
    .filter((m) => (m.stats?.totalOrders ?? 0) > 0)
    .map((m) => ({ name: m.nameUz, value: m.stats?.totalOrders ?? 0, color: methodDeliveryColors[m.nameUz] || "#64748b" }));

  return (
    <div>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">{t("delivery.title")}</h1>
          <p className="text-sm text-slate-500 mt-1">{t("delivery.subtitle")}</p>
        </div>
        {savedMessage && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-emerald-400">{savedMessage}</span>
          </motion.div>
        )}
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: t("delivery.stats.pickup"), value: totalPickupOrders.toLocaleString(), icon: Store, color: "text-emerald-400" },
          { label: t("delivery.stats.courier"), value: totalCourierOrders.toLocaleString(), icon: Truck, color: "text-blue-400" },
          { label: t("delivery.stats.cost"), value: (totalDeliveryCost / 1000000).toFixed(1) + "M", icon: DollarSign, color: "text-amber-400" },
          { label: t("delivery.stats.activePharmacies"), value: activePharmacies.toString(), icon: MapPin, color: "text-violet-400" },
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
          <h3 className="text-sm font-semibold text-white mb-4">{t("delivery.chart.daily")}</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyDeliveryStats} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="pickup" name={t("delivery.legend.pickup")} fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={20} />
                <Bar dataKey="courier" name={t("delivery.legend.courier")} fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={20} />
                <Bar dataKey="post" name={t("delivery.legend.post")} fill="#f59e0b" radius={[3, 3, 0, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">{t("delivery.chart.byMethod")}</h3>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value" stroke="none">
                  {pieData.map((entry) => (<Cell key={entry.name} fill={entry.color} />))}
                </Pie>
                <Tooltip content={(props) => {
                  const { active, payload } = props as ChartTooltipProps;
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-xl">
                        <p className="text-xs text-white font-medium">{payload[0].name}</p>
                        <p className="text-xs text-slate-400">{payload[0].value} ta</p>
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

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-800 mb-6">
        {[
          { key: "methods" as Tab, label: t("delivery.tab.methods"), icon: Truck },
          { key: "pharmacies" as Tab, label: t("delivery.tab.pharmacies"), icon: Store },
          { key: "regions" as Tab, label: t("delivery.tab.regions"), icon: MapPin },
          { key: "orders" as Tab, label: t("delivery.tab.orders"), icon: Package },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-all ${activeTab === tab.key ? "text-emerald-400 border-b-2 border-emerald-400" : "text-slate-500 hover:text-white"}`}>
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {/* METHODS */}
        {activeTab === "methods" && (
          <motion.div key="methods" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
            {/* Pickup */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Store className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-white">Yaqin aptekadan olish</h3>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" />
                        Faol
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 mt-1">Eng yaqin aptekani tanlang va buyurtmani olib keting. QR skanerlash — Sodiqlik.</p>
                    <p className="text-xs text-emerald-400 mt-2">Yaqin aptekadan olish — bepul</p>
                    <p className="text-xs text-slate-500 mt-1">Mahsulot bor aptekalar ({pharmacyList.filter((p) => p.status === "active" && p.productsCount > 0).length})</p>
                  </div>
                </div>
                <button className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs text-white transition-all">
                  <Settings className="w-3.5 h-3.5" />
                  Sozlash
                </button>
              </div>
              <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800">
                <div><p className="text-[10px] text-slate-500">Buyurtmalar</p><p className="text-sm font-bold text-white">{(pickupMethod?.stats?.totalOrders ?? 0).toLocaleString()}</p></div>
                <div><p className="text-[10px] text-slate-500">Muvaffaqiyat</p><p className="text-sm font-bold text-emerald-400">{pickupMethod?.stats?.onTimeRate ?? 0}%</p></div>
                <div><p className="text-[10px] text-slate-500">O'rtacha vaqt</p><p className="text-sm font-bold text-white">{pickupMethod?.stats?.avgTime ?? 0} soat</p></div>
                <div><p className="text-[10px] text-slate-500">Xarajat</p><p className="text-sm font-bold text-white">Bepul</p></div>
              </div>
            </div>

            {/* External services */}
            <h3 className="text-sm font-semibold text-white mt-6 mb-3">Tashqi yetkazib berish xizmatlari</h3>
            <div className="space-y-3">
              {methodList.slice(1).map((method, index) => {
                const st = statusConfig[method.status];
                const StatusIcon = st.icon;
                return (
                  <motion.div key={method.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${method.status === "active" ? "bg-blue-500/10" : "bg-slate-800"}`}>
                          <Truck className={`w-6 h-6 ${method.status === "active" ? "text-blue-400" : "text-slate-500"}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-semibold text-white">{method.name}</h3>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${st.bg} ${st.color}`}>
                              <StatusIcon className="w-3 h-3" />
                              {st.label}
                            </span>
                            {method.type === "integration" && <span className="px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 text-[10px]">API</span>}
                          </div>
                          <p className="text-sm text-slate-400 mt-1">{method.description}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-xs text-slate-500">Narxi: {method.cost.toLocaleString()} so'm</span>
                            {method.freeFrom > 0 && <span className="text-xs text-emerald-400">Bepul: {method.freeFrom.toLocaleString()} so'mdan</span>}
                            {method.minDays && <span className="text-xs text-slate-500">Muddat: {method.minDays}-{method.maxDays} kun</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => setShowMethodConfig(method)} className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs text-white transition-all">
                          <Settings className="w-3.5 h-3.5" />
                          {method.status === "inactive" ? "Qo'shish" : "Sozlash"}
                        </button>
                        <button onClick={() => toggleMethod(method.id)} className={`relative w-11 h-6 rounded-full transition-all ${method.status === "active" ? "bg-emerald-500" : "bg-slate-700"}`}>
                          <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${method.status === "active" ? "left-5" : "left-0.5"}`} />
                        </button>
                      </div>
                    </div>
                    {(method.stats?.totalOrders ?? 0) > 0 && (
                      <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800">
                        <div><p className="text-[10px] text-slate-500">Buyurtmalar</p><p className="text-sm font-bold text-white">{(method.stats?.totalOrders ?? 0).toLocaleString()}</p></div>
                        <div><p className="text-[10px] text-slate-500">Xarajat</p><p className="text-sm font-bold text-emerald-400">{((method.stats?.totalCost ?? 0) / 1000000).toFixed(1)}M</p></div>
                        <div><p className="text-[10px] text-slate-500">O'rtacha vaqt</p><p className="text-sm font-bold text-white">{method.stats?.avgTime ?? 0} soat</p></div>
                        <div><p className="text-[10px] text-slate-500">Vaqtida</p><p className="text-sm font-bold text-blue-400">{method.stats?.onTimeRate ?? 0}%</p></div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* PHARMACIES */}
        {activeTab === "pharmacies" && (
          <motion.div key="pharmacies" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="flex items-center justify-between mb-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input type="text" placeholder="Aptekalarni qidirish..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50" />
              </div>
              <button onClick={() => setShowAddPharmacy(true)} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium rounded-lg transition-all">
                <Plus className="w-3.5 h-3.5" />
                Apteka qo'shish
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-800/30">
                      <th className="py-3 px-4 text-left text-xs text-slate-500 uppercase">ID</th>
                      <th className="py-3 px-4 text-left text-xs text-slate-500 uppercase">Nomi</th>
                      <th className="py-3 px-4 text-left text-xs text-slate-500 uppercase">Manzil</th>
                      <th className="py-3 px-4 text-left text-xs text-slate-500 uppercase">Menejer</th>
                      <th className="py-3 px-4 text-right text-xs text-slate-500 uppercase">Mahsulotlar</th>
                      <th className="py-3 px-4 text-center text-xs text-slate-500 uppercase">Olib ketish</th>
                      <th className="py-3 px-4 text-center text-xs text-slate-500 uppercase">Yetkazish</th>
                      <th className="py-3 px-4 text-left text-xs text-slate-500 uppercase">Status</th>
                      <th className="py-3 px-4 text-right text-xs text-slate-500 uppercase">Amallar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pharmacyList.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.city.toLowerCase().includes(searchQuery.toLowerCase())).map((pharmacy, i) => {
                      const st = statusConfig[pharmacy.status];
                      return (
                        <motion.tr key={pharmacy.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-4 text-sm text-slate-400">{pharmacy.id}</td>
                          <td className="py-3 px-4">
                            <p className="text-sm font-medium text-white">{pharmacy.name}</p>
                            <p className="text-xs text-slate-500">{pharmacy.phone}</p>
                          </td>
                          <td className="py-3 px-4">
                            <p className="text-sm text-slate-300">{pharmacy.city}</p>
                            <p className="text-xs text-slate-500">{pharmacy.address}</p>
                          </td>
                          <td className="py-3 px-4 text-sm text-white">{pharmacy.manager}</td>
                          <td className="py-3 px-4 text-sm font-semibold text-white text-right">{pharmacy.productsCount.toLocaleString()}</td>
                          <td className="py-3 px-4 text-center">{pharmacy.hasPickup ? <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /> : <XCircle className="w-4 h-4 text-slate-600 mx-auto" />}</td>
                          <td className="py-3 px-4 text-center">{pharmacy.hasDelivery ? <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /> : <XCircle className="w-4 h-4 text-slate-600 mx-auto" />}</td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${st.bg} ${st.color}`}>{st.label}</span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => setShowEditPharmacy(pharmacy)} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-all" title="Tahrirlash">
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => deletePharmacy(pharmacy.id)} className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all" title="O'chirish">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* REGIONS */}
        {activeTab === "regions" && (
          <motion.div key="regions" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Yetkazib berish hududlari</h3>
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium rounded-lg transition-all">
                  <Plus className="w-3.5 h-3.5" />
                  Hudud qo'shish
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-800/30">
                      <th className="py-3 px-5 text-left text-xs text-slate-500 uppercase">Viloyat</th>
                      <th className="py-3 px-5 text-left text-xs text-slate-500 uppercase">Shahar</th>
                      <th className="py-3 px-5 text-right text-xs text-slate-500 uppercase">Narxi</th>
                      <th className="py-3 px-5 text-right text-xs text-slate-500 uppercase">Bepul dan</th>
                      <th className="py-3 px-5 text-center text-xs text-slate-500 uppercase">Muddat</th>
                      <th className="py-3 px-5 text-center text-xs text-slate-500 uppercase">Status</th>
                      <th className="py-3 px-5 text-right text-xs text-slate-500 uppercase">Amallar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {regionList.map((region, index) => (
                      <motion.tr key={`${region.region}-${region.city}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * 0.03 }} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-5 text-sm text-white">{region.region}</td>
                        <td className="py-3 px-5 text-sm text-slate-300">{region.city}</td>
                        <td className="py-3 px-5 text-sm text-white text-right">{region.cost.toLocaleString()}</td>
                        <td className="py-3 px-5 text-sm text-emerald-400 text-right">{region.freeFrom.toLocaleString()}</td>
                        <td className="py-3 px-5 text-sm text-slate-400 text-center">{region.minDays}-{region.maxDays} kun</td>
                        <td className="py-3 px-5 text-center">
                          <button onClick={() => toggleRegion(index)} className={`relative w-8 h-4 rounded-full transition-all ${region.active ? "bg-emerald-500" : "bg-slate-700"}`}>
                            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${region.active ? "left-4" : "left-0.5"}`} />
                          </button>
                        </td>
                        <td className="py-3 px-5 text-right">
                          <button className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-all">
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* ORDERS */}
        {activeTab === "orders" && (
          <motion.div key="orders" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Yetkazib berish buyurtmalari</h3>
                <div className="flex items-center gap-2">
                  <select value={orderFilter} onChange={(e) => setOrderFilter(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none">
                    <option value="all">Barcha</option>
                    <option value="pending">Kutilmoqda</option>
                    <option value="processing">Tayyorlanmoqda</option>
                    <option value="shipped">Yuborildi</option>
                    <option value="delivered">Yetkazildi</option>
                    <option value="cancelled">Bekor</option>
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
                      <th className="py-3 px-5 text-left text-xs text-slate-500 uppercase">Manzil</th>
                      <th className="py-3 px-5 text-left text-xs text-slate-500 uppercase">Usul</th>
                      <th className="py-3 px-5 text-left text-xs text-slate-500 uppercase">Apteka</th>
                      <th className="py-3 px-5 text-right text-xs text-slate-500 uppercase">Narxi</th>
                      <th className="py-3 px-5 text-left text-xs text-slate-500 uppercase">Status</th>
                      <th className="py-3 px-5 text-left text-xs text-slate-500 uppercase">Sana</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedOrders.map((order, i) => {
                      const os = orderStatusConfig[order.status];
                      return (
                        <motion.tr key={order.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-5 text-sm text-slate-400">{order.id}</td>
                          <td className="py-3 px-5 text-sm text-white">{order.orderId}</td>
                          <td className="py-3 px-5">
                            <p className="text-sm text-white">{order.customer}</p>
                            <p className="text-xs text-slate-500">{order.phone}</p>
                          </td>
                          <td className="py-3 px-5">
                            <p className="text-sm text-slate-300">{order.city}</p>
                            <p className="text-xs text-slate-500">{order.address}</p>
                          </td>
                          <td className="py-3 px-5">
                            <span className="text-xs font-medium" style={{ color: methodDeliveryColors[order.method] || "#94a3b8" }}>{order.method}</span>
                          </td>
                          <td className="py-3 px-5 text-sm text-slate-400">{order.pharmacyName || "—"}</td>
                          <td className="py-3 px-5 text-sm font-semibold text-white text-right">{order.cost === 0 ? "Bepul" : order.cost.toLocaleString()}</td>
                          <td className="py-3 px-5">
                            <span className={`text-xs font-medium ${os.color}`}>{os.label}</span>
                            {order.courier && <p className="text-[10px] text-slate-500">{order.courier}</p>}
                            {order.trackingNumber && <p className="text-[10px] text-blue-400">{order.trackingNumber}</p>}
                          </td>
                          <td className="py-3 px-5 text-sm text-slate-400">{order.createdAt}</td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {filteredOrders.length > 0 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800">
                  <p className="text-xs text-slate-500">{(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredOrders.length)} / {filteredOrders.length} ta</p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition-all"><ChevronLeft className="w-4 h-4" /></button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) pageNum = i + 1;
                      else if (currentPage <= 3) pageNum = i + 1;
                      else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                      else pageNum = currentPage - 2 + i;
                      return (
                        <button key={pageNum} onClick={() => setCurrentPage(pageNum)} className={`w-7 h-7 rounded-lg text-xs font-medium transition-all ${currentPage === pageNum ? "bg-emerald-500 text-white" : "text-slate-500 hover:text-white hover:bg-slate-800"}`}>{pageNum}</button>
                      );
                    })}
                    <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition-all"><ChevronRight className="w-4 h-4" /></button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Pharmacy Modal */}
      <AnimatePresence>
        {showAddPharmacy && (
          <PharmacyForm title="Yangi apteka qo'shish" onSubmit={addPharmacy} onClose={() => setShowAddPharmacy(false)} />
        )}
        {showEditPharmacy && (
          <PharmacyForm title="Aptekani tahrirlash" initial={showEditPharmacy} onSubmit={(data) => updatePharmacy(showEditPharmacy.id, data)} onClose={() => setShowEditPharmacy(null)} />
        )}
      </AnimatePresence>

      {/* Method Config Modal */}
      <AnimatePresence>
        {showMethodConfig && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowMethodConfig(null)}>
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-6 border-b border-slate-800">
                <h2 className="text-lg font-bold text-white">{showMethodConfig.name} sozlamalari</h2>
                <button onClick={() => setShowMethodConfig(null)} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">Narxi (so'm)</label>
                    <input type="number" defaultValue={showMethodConfig.cost} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">Bepul dan (so'm)</label>
                    <input type="number" defaultValue={showMethodConfig.freeFrom} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50" />
                  </div>
                </div>
                {showMethodConfig.config?.apiUrl && (
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">API URL</label>
                    <input defaultValue={showMethodConfig.config.apiUrl} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-400" readOnly />
                  </div>
                )}
                {showMethodConfig.config?.apiKey !== undefined && (
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">API Key</label>
                    <div className="flex items-center gap-2">
                      <input type="password" defaultValue={showMethodConfig.config.apiKey} placeholder="API kalitni kiriting" className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50" />
                      <button className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white"><Eye className="w-4 h-4" /></button>
                    </div>
                  </div>
                )}
                {showMethodConfig.config?.webhookUrl && (
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">Webhook URL</label>
                    <div className="flex items-center gap-2">
                      <input defaultValue={showMethodConfig.config.webhookUrl} className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-400" readOnly />
                      <button className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white"><Copy className="w-4 h-4" /></button>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 p-6 pt-0">
                <button onClick={() => setShowMethodConfig(null)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-white transition-all">Bekor</button>
                <button onClick={() => setShowMethodConfig(null)} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-all">
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
