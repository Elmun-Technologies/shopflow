import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Settings, Eye, EyeOff, CheckCircle2, XCircle, Clock,
  Banknote, MousePointerClick, CreditCard, CalendarClock, Wallet,
  TrendingUp, ChevronLeft, ChevronRight,
  Copy, ExternalLink, BookOpen, Save, X,
  AlertTriangle, Check, DollarSign,
  Activity, ShieldCheck, Download, Loader2, Plus,
} from "lucide-react";
import {
  dailyPaymentStats, methodColors,
} from "../data/paymentsData";
import type { PaymentMethod, PaymentConfig } from "../data/paymentsData";
import { api } from "../api/client";
import { exportToCsv } from "../utils/exportCsv";

// Backend'dan keladigan format (frontend'da redacted config bilan)
interface ApiMethod {
  id: string;
  code: string;
  name: string;
  status: "ACTIVE" | "INACTIVE" | "PENDING" | "ERROR";
  type: string;
  configured: boolean;
  configPreview: Record<string, unknown>;
  minAmount: number | null;
  maxAmount: number | null;
  commissionPercent: number | null;
  testMode: boolean;
  autoConfirm: boolean;
  position: number;
  transactionsCount: number;
  webhookUrl?: string;
}

interface ApiTransaction {
  id: string;
  methodId: string;
  method: { id: string; code: string; name: string };
  orderId: string | null;
  externalId: string | null;
  amount: number;
  currency: string;
  status: "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED" | "CANCELLED";
  commission: number | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

// Backend status'ini eski demo formatga moslashtirish (UI changini kamaytirish uchun)
function backendToUiStatus(s: ApiMethod["status"]): "active" | "inactive" | "pending" | "error" {
  switch (s) {
    case "ACTIVE": return "active";
    case "INACTIVE": return "inactive";
    case "PENDING": return "pending";
    case "ERROR": return "error";
  }
}

// UI eski PaymentMethod shape'iga moslashtirish (transactions'dan stats'ni hisoblaymiz)
function adapt(m: ApiMethod, txns: ApiTransaction[]): PaymentMethod {
  const own = txns.filter((t) => t.methodId === m.id);
  const success = own.filter((t) => t.status === "SUCCESS");
  const today = own.filter((t) => Date.now() - new Date(t.createdAt).getTime() < 24 * 60 * 60 * 1000);
  return {
    id: m.id,
    code: m.code,
    name: m.name,
    nameUz: m.name,
    description: "",
    icon: "Wallet",
    status: backendToUiStatus(m.status),
    type: (m.type as "instant" | "installment" | "cash") ?? "instant",
    config: {
      ...(m.configPreview as PaymentConfig),
      ...(m.webhookUrl ? { webhookUrl: m.webhookUrl } : {}),
    },
    stats: {
      totalTransactions: own.length,
      totalAmount: success.reduce((s, t) => s + t.amount, 0),
      successRate: own.length > 0 ? Math.round((success.length / own.length) * 100) : 0,
      avgAmount: success.length > 0 ? Math.round(success.reduce((s, t) => s + t.amount, 0) / success.length) : 0,
      todayTransactions: today.length,
      todayAmount: today.filter((t) => t.status === "SUCCESS").reduce((s, t) => s + t.amount, 0),
      failedTransactions: own.filter((t) => t.status === "FAILED").length,
      refundedAmount: own.filter((t) => t.status === "REFUNDED").reduce((s, t) => s + t.amount, 0),
    },
    lastUpdated: new Date().toISOString(),
  };
}
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import type { ChartTooltipProps } from "../utils/chart";
import { useT } from "../i18n";

type PaymentMethodStatus = "active" | "inactive" | "pending" | "error";

const statusConfig: Record<PaymentMethodStatus, { color: string; bg: string; label: string; icon: React.ElementType }> = {
  active: { color: "text-forest-700", bg: "bg-leaf-100 border-leaf-300/60", label: "Faol", icon: CheckCircle2 },
  inactive: { color: "text-slate-500", bg: "bg-slate-100 border-slate-300", label: "Nofaol", icon: XCircle },
  pending: { color: "text-amber-500", bg: "bg-amber-100 border-amber-300", label: "Kutilmoqda", icon: Clock },
  error: { color: "text-red-600", bg: "bg-red-100 border-red-300", label: "Xatolik", icon: AlertTriangle },
};

const txnStatusConfig: Record<string, { color: string; label: string }> = {
  success: { color: "text-forest-700", label: "Muvaffaqiyatli" },
  pending: { color: "text-amber-500", label: "Kutilmoqda" },
  failed: { color: "text-red-600", label: "Bekor" },
  refunded: { color: "text-slate-500", label: "Qaytarildi" },
};

const iconMap: Record<string, React.ElementType> = {
  Banknote, MousePointerClick, CreditCard, CalendarClock, Wallet,
};

function CustomTooltip({ active, payload }: ChartTooltipProps) {
  if (active && payload && payload.length) {
    const date = (payload[0].payload as { date?: string } | undefined)?.date ?? "";
    return (
      <div className="bg-cream-100 border border-cream-300 rounded-lg px-3 py-2 shadow-xl">
        <p className="text-xs text-forest-800 font-medium">{date}</p>
        {payload.map((p) => (
          <p key={p.dataKey ?? p.name} className="text-xs" style={{ color: p.color }}>{p.name}: {p.value} ta</p>
        ))}
      </div>
    );
  }
  return null;
}

export default function PaymentsPage() {
  const { t } = useT();
  const [apiMethods, setApiMethods] = useState<ApiMethod[]>([]);
  const [txns, setTxns] = useState<ApiTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [txnFilter, setTxnFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [savedMessage, setSavedMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  // Config modal — tahrirlanadigan nusxa (oldin input'lar uncontrolled edi, Save tahrirni yo'qotardi)
  const [configDraft, setConfigDraft] = useState<PaymentConfig>({});
  const [showSecret, setShowSecret] = useState<{ apiKey?: boolean; secretKey?: boolean; password?: boolean }>({});
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Modal ochilganda configDraft'ni tanlangan metod konfiguratsiyasi bilan to'ldiramiz
  useEffect(() => {
    if (selectedMethod) {
      setConfigDraft({ ...selectedMethod.config });
      setShowSecret({});
    }
  }, [selectedMethod]);

  const setCfg = (patch: Partial<PaymentConfig>) => setConfigDraft((d) => ({ ...d, ...patch }));
  const copyField = (text: string, field: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    }).catch(() => null);
  };

  // Backend'dan methods + transactions yuklash
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api<{ items: ApiMethod[] }>("/payments/methods"),
      api<{ items: ApiTransaction[] }>("/payments/transactions?pageSize=100"),
    ])
      .then(([m, t]) => {
        if (cancelled) return;
        setApiMethods(m.items);
        setTxns(t.items);
        setError(null);
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  // Backend ma'lumotlarini UI'ning eski shape'iga moslashtirish
  const methods = useMemo(() => apiMethods.map((m) => adapt(m, txns)), [apiMethods, txns]);

  const filteredMethods = useMemo(() => {
    let result = [...methods];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((m) => m.name.toLowerCase().includes(q) || m.code.includes(q));
    }
    return result;
  }, [searchQuery, methods]);

  // Transactions endi backend'dan keladi
  const filteredTxns = useMemo(() => {
    let result = [...txns];
    if (txnFilter !== "all") {
      const wanted = txnFilter.toUpperCase();
      result = result.filter((t) => t.status === wanted);
    }
    return result;
  }, [txnFilter, txns]);

  const totalPages = Math.ceil(filteredTxns.length / itemsPerPage);
  const paginatedTxns = filteredTxns.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleExportTxns = () => {
    if (filteredTxns.length === 0) return;
    exportToCsv({
      filename: `transactions-${new Date().toISOString().slice(0, 10)}`,
      columns: [
        { key: "id", label: "ID" },
        { key: "order", label: t("payments.th.order") },
        { key: "method", label: t("payments.th.method") },
        { key: "amount", label: t("payments.th.amount") },
        { key: "currency", label: t("orders.col.currency") },
        { key: "status", label: t("payments.th.status") },
        { key: "date", label: t("payments.th.date") },
      ],
      rows: filteredTxns.map((tx) => ({
        id: tx.id,
        order: tx.orderId ?? "",
        method: tx.method?.name ?? "",
        amount: tx.amount,
        currency: tx.currency,
        status: tx.status,
        date: tx.createdAt,
      })),
    });
  };

  const reload = async () => {
    const [m, t] = await Promise.all([
      api<{ items: ApiMethod[] }>("/payments/methods"),
      api<{ items: ApiTransaction[] }>("/payments/transactions?pageSize=100"),
    ]);
    setApiMethods(m.items);
    setTxns(t.items);
  };

  const flashSaved = (msg = t("payments.saved")) => {
    setSavedMessage(msg);
    setTimeout(() => setSavedMessage(""), 2000);
  };

  const toggleMethod = async (id: string) => {
    const m = apiMethods.find((x) => x.id === id);
    if (!m) return;
    setBusyId(id);
    try {
      const next = m.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      await api(`/payments/methods/${id}`, { method: "PATCH", body: { status: next } });
      await reload();
      flashSaved(next === "ACTIVE" ? t("payments.enabled") : t("payments.disabled"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusyId(null);
    }
  };

  const saveConfig = async (id: string, config: PaymentConfig) => {
    setBusyId(id);
    try {
      // Bo'sh stringlarni jo'natmaymiz — ular yashirin maydonlarning ko'rinishi (•••••)
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(config)) {
        if (typeof v === "string" && v.startsWith("•")) continue;
        clean[k] = v;
      }
      await api(`/payments/methods/${id}`, {
        method: "PATCH",
        body: { config: clean },
      });
      await reload();
      flashSaved(t("payments.configSaved"));
      setShowConfig(false);
      setSelectedMethod(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusyId(null);
    }
  };

  const addMethod = async (code: string, name: string) => {
    try {
      await api("/payments/methods", { method: "POST", body: { code, name } });
      await reload();
      flashSaved(t("payments.methodAdded", { name }));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
    }
  };

  const totalRevenue = methods.reduce((s, m) => s + m.stats.totalAmount, 0);
  const totalTxns = methods.reduce((s, m) => s + m.stats.totalTransactions, 0);
  const avgSuccess = methods.length > 0 ? (methods.reduce((s, m) => s + m.stats.successRate, 0) / methods.length).toFixed(1) : "0";
  const todayRevenue = methods.reduce((s, m) => s + m.stats.todayAmount, 0);

  const pieData = methods.map((m) => ({ name: m.nameUz, value: m.stats.totalTransactions, color: methodColors[m.nameUz] || "#64748b" }));

  // Yangi method qo'shish — dropdown'dan tanlash uchun standart ro'yxat
  const KNOWN_METHODS: Array<{ code: string; name: string }> = [
    { code: "click", name: "Click" },
    { code: "payme", name: "Payme" },
    { code: "uzum", name: "Uzum Bank" },
    { code: "alif", name: "Alif" },
    { code: "cash", name: "Naqd to'lov" },
  ];
  const availableToAdd = KNOWN_METHODS.filter((k) => !apiMethods.some((m) => m.code === k.code));
  const [showAddMenu, setShowAddMenu] = useState(false);

  return (
    <div>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-forest-800">{t("payments.title")}</h1>
          <p className="text-sm text-slate-500 mt-1">{t("payments.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          {loading && (
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {t("payments.loading")}
            </span>
          )}
          {error && (
            <span className="flex items-center gap-1.5 text-xs text-red-600">
              <AlertTriangle className="w-3.5 h-3.5" />
              {error}
            </span>
          )}
          {savedMessage && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 px-3 py-2 bg-leaf-100 border border-leaf-300/60 rounded-lg">
              <Check className="w-4 h-4 text-forest-700" />
              <span className="text-sm text-forest-700">{savedMessage}</span>
            </motion.div>
          )}
          {availableToAdd.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowAddMenu(!showAddMenu)}
                className="flex items-center gap-1.5 px-3 py-2 bg-leaf-400 hover:bg-leaf-500 rounded-lg text-sm font-medium text-forest-800"
              >
                <Plus className="w-4 h-4" />
                {t("payments.addMethod")}
              </button>
              {showAddMenu && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setShowAddMenu(false)} />
                  <div className="absolute top-full right-0 mt-1 z-30 bg-cream-100 border border-cream-300 rounded-lg shadow-xl py-1 min-w-[180px]">
                    {availableToAdd.map((k) => (
                      <button
                        key={k.code}
                        onClick={() => { addMethod(k.code, k.name); setShowAddMenu(false); }}
                        className="w-full text-left px-3 py-2 text-sm text-forest-800 hover:bg-cream-200"
                      >
                        {k.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: t("payments.stats.revenue"), value: (totalRevenue / 1000000).toFixed(1) + "M so'm", icon: DollarSign, color: "text-forest-700" },
          { label: t("payments.stats.transactions"), value: totalTxns.toLocaleString(), icon: Activity, color: "text-forest-700" },
          { label: t("payments.stats.successRate"), value: avgSuccess + "%", icon: ShieldCheck, color: "text-leaf-600" },
          { label: t("payments.stats.today"), value: (todayRevenue / 1000000).toFixed(1) + "M so'm", icon: TrendingUp, color: "text-amber-500" },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="bg-white border border-cream-300 rounded-xl p-5">
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
        <div className="lg:col-span-2 bg-white border border-cream-300 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-forest-800 mb-4">{t("payments.chart.daily")}</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyPaymentStats} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5DA" vertical={false} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "#94A3B8", fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94A3B8", fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="click" name="Click" fill="#0EA5E9" radius={[12, 12, 12, 12]} maxBarSize={20} />
                <Bar dataKey="payme" name="Payme" fill="#5FA340" radius={[12, 12, 12, 12]} maxBarSize={20} />
                <Bar dataKey="uzum" name="Uzum" fill="#f59e0b" radius={[12, 12, 12, 12]} maxBarSize={20} />
                <Bar dataKey="alif" name="Alif" fill="#8b5cf6" radius={[12, 12, 12, 12]} maxBarSize={20} />
                <Bar dataKey="cash" name="Naqd" fill="#64748b" radius={[12, 12, 12, 12]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white border border-cream-300 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-forest-800 mb-4">{t("payments.chart.byMethod")}</h3>
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
                      <div className="bg-cream-100 border border-cream-300 rounded-lg px-3 py-2 shadow-xl">
                        <p className="text-xs text-forest-800 font-medium">{payload[0].name}</p>
                        <p className="text-xs text-slate-500">{t("payments.chart.txnsCount", { n: String(payload[0].value ?? 0) })}</p>
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
                  <span className="text-xs text-slate-500">{d.name}</span>
                </div>
                <span className="text-xs text-forest-800 font-medium">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Payment Methods */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-forest-800">{t("payments.methods")}</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                placeholder={t("payments.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-cream-100 border border-cream-300 rounded-lg pl-8 pr-3 py-1.5 text-xs text-forest-800 placeholder-slate-400 focus:outline-none focus:border-leaf-500/60"
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
                className="bg-white border border-cream-300 rounded-xl p-5 hover:border-cream-300 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${method.status === "active" ? "bg-leaf-100" : "bg-cream-100"}`}>
                      <MethodIcon className={`w-6 h-6 ${method.status === "active" ? "text-forest-700" : "text-slate-500"}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-forest-800">{method.name}</h3>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${st.bg} ${st.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {t(`payments.status.${method.status}`)}
                        </span>
                        {method.type === "installment" && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-500 text-[10px] font-medium">{t("payments.installment")}</span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 mt-1">{method.description}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-xs text-slate-500">{t("payments.lastUpdated")}: {new Date(method.lastUpdated).toLocaleString("uz-UZ", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short", year: "numeric" })}</span>
                        {method.config.commissionPercent !== undefined && (
                          <span className="text-xs text-slate-500">{t("payments.commission")}: {method.config.commissionPercent}%</span>
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
                      className="flex items-center gap-1.5 px-3 py-2 bg-cream-100 hover:bg-cream-200 border border-cream-300 rounded-lg text-xs text-forest-800 transition-all"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      {t("payments.configure")}
                    </button>
                    <button
                      onClick={() => toggleMethod(method.id)}
                      disabled={busyId === method.id}
                      className={`relative w-11 h-6 rounded-full transition-all disabled:opacity-50 ${method.status === "active" ? "bg-leaf-400" : "bg-cream-200"}`}
                    >
                      {busyId === method.id ? (
                        <Loader2 className="absolute top-1 left-1/2 -translate-x-1/2 w-4 h-4 text-forest-800 animate-spin" />
                      ) : (
                        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${method.status === "active" ? "left-5" : "left-0.5"}`} />
                      )}
                    </button>
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-5 gap-3 mt-4 pt-4 border-t border-cream-300">
                  <div>
                    <p className="text-[10px] text-slate-500">{t("payments.col.transactions")}</p>
                    <p className="text-sm font-bold text-forest-800">{method.stats.totalTransactions.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500">{t("payments.col.revenue")}</p>
                    <p className="text-sm font-bold text-forest-700">{(method.stats.totalAmount / 1000000).toFixed(1)}M</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500">{t("payments.col.success")}</p>
                    <p className="text-sm font-bold text-forest-800">{method.stats.successRate}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500">{t("payments.col.avg")}</p>
                    <p className="text-sm font-bold text-forest-800">{(method.stats.avgAmount / 1000).toFixed(0)}k</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500">{t("payments.col.today")}</p>
                    <p className="text-sm font-bold text-amber-500">{method.stats.todayTransactions}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white border border-cream-300 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-cream-300 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-forest-800">{t("payments.recentTxns")}</h3>
          <div className="flex items-center gap-2">
            <select value={txnFilter} onChange={(e) => setTxnFilter(e.target.value)} className="bg-cream-100 border border-cream-300 rounded-lg px-2 py-1 text-xs text-forest-800 focus:outline-none">
              <option value="all">{t("payments.filter.all")}</option>
              <option value="success">{t("payments.txn.success")}</option>
              <option value="pending">{t("payments.txn.pending")}</option>
              <option value="failed">{t("payments.txn.failed")}</option>
              <option value="refunded">{t("payments.txn.refunded")}</option>
            </select>
            <button onClick={handleExportTxns} disabled={filteredTxns.length === 0} className="flex items-center gap-1 px-2 py-1 bg-cream-100 border border-cream-300 rounded-lg text-xs text-slate-500 hover:text-forest-900 transition-all disabled:opacity-50">
              <Download className="w-3 h-3" />
              {t("payments.export")}
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-cream-300 bg-cream-100/30">
                <th className="py-3 px-5 text-left text-xs text-slate-500 uppercase">ID</th>
                <th className="py-3 px-5 text-left text-xs text-slate-500 uppercase">{t("payments.th.order")}</th>
                <th className="py-3 px-5 text-left text-xs text-slate-500 uppercase">{t("payments.th.customer")}</th>
                <th className="py-3 px-5 text-left text-xs text-slate-500 uppercase">{t("payments.th.method")}</th>
                <th className="py-3 px-5 text-right text-xs text-slate-500 uppercase">{t("payments.th.amount")}</th>
                <th className="py-3 px-5 text-left text-xs text-slate-500 uppercase">{t("payments.th.status")}</th>
                <th className="py-3 px-5 text-left text-xs text-slate-500 uppercase">{t("payments.th.date")}</th>
              </tr>
            </thead>
            <tbody>
              {paginatedTxns.map((txn, i) => {
                const tsKey = txn.status.toLowerCase();
                const ts = txnStatusConfig[tsKey] ?? { color: "text-slate-500", label: txn.status };
                const tsLabel = txnStatusConfig[tsKey] ? t(`payments.txn.${tsKey}`) : ts.label;
                const methodName = txn.method?.name ?? "—";
                return (
                  <motion.tr key={txn.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="border-b border-cream-300/50 hover:bg-cream-100/30 transition-colors">
                    <td className="py-3 px-5 text-sm text-slate-500 font-mono">{txn.id.slice(0, 8)}</td>
                    <td className="py-3 px-5 text-sm text-forest-800">{txn.orderId ?? "—"}</td>
                    <td className="py-3 px-5">
                      <p className="text-sm text-forest-800">{txn.externalId ?? "—"}</p>
                      <p className="text-xs text-slate-500">{txn.currency}</p>
                    </td>
                    <td className="py-3 px-5">
                      <span className="text-xs font-medium" style={{ color: methodColors[methodName] || "#94a3b8" }}>{methodName}</span>
                    </td>
                    <td className="py-3 px-5 text-sm font-semibold text-forest-800 text-right">{txn.amount.toLocaleString()}</td>
                    <td className="py-3 px-5">
                      <span className={`text-xs font-medium ${ts.color}`}>{tsLabel}</span>
                      {txn.errorMessage && <p className="text-[10px] text-red-600 mt-0.5">{txn.errorMessage}</p>}
                    </td>
                    <td className="py-3 px-5 text-sm text-slate-500">{new Date(txn.createdAt).toLocaleString("uz-UZ", { dateStyle: "short", timeStyle: "short" })}</td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredTxns.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-cream-300">
            <p className="text-xs text-slate-500">
              {t("payments.pageRange", {
                from: String((currentPage - 1) * itemsPerPage + 1),
                to: String(Math.min(currentPage * itemsPerPage, filteredTxns.length)),
                total: String(filteredTxns.length),
              })}
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="p-1.5 rounded-lg text-slate-500 hover:text-forest-900 hover:bg-cream-100 disabled:opacity-30 transition-all">
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) pageNum = i + 1;
                else if (currentPage <= 3) pageNum = i + 1;
                else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                else pageNum = currentPage - 2 + i;
                return (
                  <button key={pageNum} onClick={() => setCurrentPage(pageNum)} className={`w-7 h-7 rounded-lg text-xs font-medium transition-all ${currentPage === pageNum ? "bg-leaf-400 text-forest-800" : "text-slate-500 hover:text-forest-900 hover:bg-cream-100"}`}>
                    {pageNum}
                  </button>
                );
              })}
              <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className="p-1.5 rounded-lg text-slate-500 hover:text-forest-900 hover:bg-cream-100 disabled:opacity-30 transition-all">
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
              className="bg-white border border-cream-300 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 border-b border-cream-300">
                <div>
                  <h2 className="text-lg font-bold text-forest-800">{t("payments.cfg.title", { name: selectedMethod.name })}</h2>
                  <p className="text-sm text-slate-500 mt-0.5">{t("payments.cfg.subtitle")}</p>
                </div>
                <button onClick={() => { setShowConfig(false); setSelectedMethod(null); }} className="p-2 rounded-lg text-slate-500 hover:text-forest-900 hover:bg-cream-100">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Test mode */}
                <div className="flex items-center justify-between bg-cream-100/50 rounded-xl p-3">
                  <div>
                    <p className="text-sm text-forest-800">{t("payments.cfg.testMode")}</p>
                    <p className="text-xs text-slate-500">{t("payments.cfg.testModeHint")}</p>
                  </div>
                  <button
                    onClick={() => setCfg({ testMode: !configDraft.testMode })}
                    className={`relative w-11 h-6 rounded-full transition-all ${configDraft.testMode ? "bg-amber-500" : "bg-cream-200"}`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${configDraft.testMode ? "left-5" : "left-0.5"}`} />
                  </button>
                </div>

                {/* Config fields — controlled (configDraft) */}
                {selectedMethod.config.merchantId !== undefined && (
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">Merchant ID</label>
                    <div className="flex items-center gap-2">
                      <input value={configDraft.merchantId ?? ""} onChange={(e) => setCfg({ merchantId: e.target.value })} className="flex-1 bg-cream-100 border border-cream-300 rounded-lg px-3 py-2 text-sm text-forest-800 focus:outline-none focus:border-leaf-500/60" />
                      <button onClick={() => copyField(configDraft.merchantId ?? "", "merchantId")} className="p-2 rounded-lg bg-cream-100 text-slate-500 hover:text-forest-900 transition-colors" title={t("payments.cfg.copy")}>
                        {copiedField === "merchantId" ? <CheckCircle2 className="w-4 h-4 text-leaf-600" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}
                {selectedMethod.config.serviceId !== undefined && (
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">Service ID</label>
                    <input value={configDraft.serviceId ?? ""} onChange={(e) => setCfg({ serviceId: e.target.value })} className="w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2 text-sm text-forest-800 focus:outline-none focus:border-leaf-500/60" />
                  </div>
                )}
                {selectedMethod.config.apiKey !== undefined && (
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">API Key</label>
                    <div className="flex items-center gap-2">
                      <input type={showSecret.apiKey ? "text" : "password"} value={configDraft.apiKey ?? ""} onChange={(e) => setCfg({ apiKey: e.target.value })} className="flex-1 bg-cream-100 border border-cream-300 rounded-lg px-3 py-2 text-sm text-forest-800 focus:outline-none focus:border-leaf-500/60" />
                      <button onClick={() => setShowSecret((s) => ({ ...s, apiKey: !s.apiKey }))} className="p-2 rounded-lg bg-cream-100 text-slate-500 hover:text-forest-900 transition-colors">
                        {showSecret.apiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}
                {selectedMethod.config.secretKey !== undefined && (
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">Secret Key</label>
                    <div className="flex items-center gap-2">
                      <input type={showSecret.secretKey ? "text" : "password"} value={configDraft.secretKey ?? ""} onChange={(e) => setCfg({ secretKey: e.target.value })} className="flex-1 bg-cream-100 border border-cream-300 rounded-lg px-3 py-2 text-sm text-forest-800 focus:outline-none focus:border-leaf-500/60" />
                      <button onClick={() => setShowSecret((s) => ({ ...s, secretKey: !s.secretKey }))} className="p-2 rounded-lg bg-cream-100 text-slate-500 hover:text-forest-900 transition-colors">
                        {showSecret.secretKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}
                {selectedMethod.config.terminalId !== undefined && (
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">Terminal ID</label>
                    <input value={configDraft.terminalId ?? ""} onChange={(e) => setCfg({ terminalId: e.target.value })} className="w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2 text-sm text-forest-800 focus:outline-none focus:border-leaf-500/60" />
                  </div>
                )}
                {selectedMethod.config.login !== undefined && (
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">Login</label>
                    <input value={configDraft.login ?? ""} onChange={(e) => setCfg({ login: e.target.value })} className="w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2 text-sm text-forest-800 focus:outline-none focus:border-leaf-500/60" />
                  </div>
                )}
                {selectedMethod.config.password !== undefined && (
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">{t("payments.cfg.password")}</label>
                    <div className="flex items-center gap-2">
                      <input type={showSecret.password ? "text" : "password"} value={configDraft.password ?? ""} onChange={(e) => setCfg({ password: e.target.value })} className="flex-1 bg-cream-100 border border-cream-300 rounded-lg px-3 py-2 text-sm text-forest-800 focus:outline-none focus:border-leaf-500/60" />
                      <button onClick={() => setShowSecret((s) => ({ ...s, password: !s.password }))} className="p-2 rounded-lg bg-cream-100 text-slate-500 hover:text-forest-900 transition-colors">
                        {showSecret.password ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}
                {selectedMethod.config.webhookUrl && (
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">Webhook URL</label>
                    <div className="flex items-center gap-2">
                      <input value={configDraft.webhookUrl ?? ""} className="flex-1 bg-cream-100 border border-cream-300 rounded-lg px-3 py-2 text-sm text-slate-500" readOnly />
                      <button onClick={() => copyField(configDraft.webhookUrl ?? "", "webhookUrl")} className="p-2 rounded-lg bg-cream-100 text-slate-500 hover:text-forest-900 transition-colors" title={t("payments.cfg.copy")}>
                        {copiedField === "webhookUrl" ? <CheckCircle2 className="w-4 h-4 text-leaf-600" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}
                {selectedMethod.config.redirectUrl !== undefined && (
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">Redirect URL</label>
                    <input value={configDraft.redirectUrl ?? ""} onChange={(e) => setCfg({ redirectUrl: e.target.value })} className="w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2 text-sm text-forest-800 focus:outline-none focus:border-leaf-500/60" />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">{t("payments.cfg.minAmount")}</label>
                    <input type="number" value={configDraft.minAmount ?? ""} onChange={(e) => setCfg({ minAmount: e.target.value === "" ? undefined : Number(e.target.value) })} className="w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2 text-sm text-forest-800 focus:outline-none focus:border-leaf-500/60" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">{t("payments.cfg.maxAmount")}</label>
                    <input type="number" value={configDraft.maxAmount ?? ""} onChange={(e) => setCfg({ maxAmount: e.target.value === "" ? undefined : Number(e.target.value) })} className="w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2 text-sm text-forest-800 focus:outline-none focus:border-leaf-500/60" />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">{t("payments.cfg.commission")}</label>
                  <input type="number" step="0.1" value={configDraft.commissionPercent ?? ""} onChange={(e) => setCfg({ commissionPercent: e.target.value === "" ? undefined : Number(e.target.value) })} className="w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2 text-sm text-forest-800 focus:outline-none focus:border-leaf-500/60" />
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-xs text-slate-500">{t("payments.cfg.autoConfirm")}</label>
                  <button
                    onClick={() => setCfg({ autoConfirm: !configDraft.autoConfirm })}
                    className={`relative w-8 h-4 rounded-full transition-all ${configDraft.autoConfirm ? "bg-leaf-400" : "bg-cream-200"}`}
                  >
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${configDraft.autoConfirm ? "left-4" : "left-0.5"}`} />
                  </button>
                </div>

                {/* Links */}
                <div className="flex items-center gap-2 pt-2 border-t border-cream-300">
                  {selectedMethod.docsUrl && (
                    <a href={selectedMethod.docsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-forest-700 hover:text-forest-700 transition-colors">
                      <BookOpen className="w-3.5 h-3.5" />
                      {t("payments.cfg.docs")}
                    </a>
                  )}
                  {selectedMethod.integrationUrl && (
                    <a href={selectedMethod.integrationUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-forest-700 hover:text-forest-700 transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" />
                      API docs
                    </a>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 p-6 pt-0">
                <button onClick={() => { setShowConfig(false); setSelectedMethod(null); }} className="px-4 py-2 bg-cream-100 hover:bg-cream-200 border border-cream-300 rounded-lg text-sm text-forest-800 transition-all">{t("common.cancel")}</button>
                <button onClick={() => saveConfig(selectedMethod.id, configDraft)} disabled={busyId === selectedMethod.id} className="flex items-center gap-1.5 px-4 py-2 bg-leaf-400 hover:bg-leaf-500 text-forest-800 text-sm font-medium rounded-lg transition-all disabled:opacity-50">
                  <Save className="w-4 h-4" />
                  {t("common.save")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
