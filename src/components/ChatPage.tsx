import { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Filter,
  Send,
  Paperclip,
  Smile,
  MoreHorizontal,
  Phone,
  Mail,
  Clock,
  CheckCheck,
  Check,
  MessageSquare,
  Target,
  Zap,
  Star,
  Ban,
  Archive,
  Tag,
  BarChart3,
  CornerDownLeft,
  Headphones,
} from "lucide-react";
import {
  agents,
  quickReplies,
  funnelStats,
  hourlyChatVolume,
  channelLabels,
  funnelStageConfig,
} from "../data/chatData";
import type { ChatConversation, FunnelStage, ChatMessage } from "../data/chatData";
import { api } from "../api/client";
import { useT } from "../i18n";

// Backend'dan keladigan format
interface ApiConvListItem {
  id: string;
  status: "ACTIVE" | "WAITING" | "RESOLVED" | "ARCHIVED" | "SPAM";
  customerId: string | null;
  customerName: string;
  customerAvatar: string | null;
  customerPhone: string | null;
  externalUserId: string | null;
  channel: { id: string; name: string; type: string } | null;
  assignee: { id: string; name: string } | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  createdAt: string;
}

interface ApiConvDetail extends ApiConvListItem {
  messages: Array<{
    id: string;
    direction: "INBOUND" | "OUTBOUND";
    content: string;
    authorId: string | null;
    authorName: string | null;
    sentAt: string;
    read: boolean;
  }>;
}

// Backend status -> demo ChatStatus
function adaptStatus(s: ApiConvListItem["status"]): "active" | "waiting" | "resolved" | "archived" | "spam" {
  return s.toLowerCase() as "active" | "waiting" | "resolved" | "archived" | "spam";
}

function adaptListItem(c: ApiConvListItem): ChatConversation {
  return {
    id: c.id,
    customerId: c.customerId ?? c.externalUserId ?? c.id,
    customerName: c.customerName,
    customerAvatar: c.customerAvatar ?? c.customerName.slice(0, 2).toUpperCase(),
    customerPhone: c.customerPhone ?? "",
    channel: (c.channel?.type?.toLowerCase() as ChatConversation["channel"]) ?? "telegram",
    status: adaptStatus(c.status),
    funnelStage: "new",
    assignedAgent: c.assignee?.name ?? "—",
    agentAvatar: c.assignee?.name?.slice(0, 2).toUpperCase() ?? "—",
    lastMessage: c.lastMessagePreview ?? "",
    lastMessageTime: c.lastMessageAt
      ? new Date(c.lastMessageAt).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })
      : "",
    unreadCount: c.unreadCount,
    messages: [],
    tags: [],
    priority: "medium",
    estimatedValue: 0,
    createdAt: c.createdAt,
  };
}

function adaptDetail(c: ApiConvDetail): ChatConversation {
  return {
    ...adaptListItem(c),
    messages: c.messages.map<ChatMessage>((m) => ({
      id: m.id,
      sender: m.direction === "INBOUND" ? "customer" : "agent",
      text: m.content,
      timestamp: new Date(m.sentAt).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" }),
      read: m.read,
    })),
  };
}
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import type { ChartTooltipProps } from "../utils/chart";

function CustomTooltip({ active, payload, label }: ChartTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-xl">
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-emerald-400">Kiruvchi: {payload[0].value}</p>
        <p className="text-xs text-blue-400">Yakunlangan: {payload[1]?.value}</p>
      </div>
    );
  }
  return null;
}

export default function ChatPage() {
  const { t } = useT();
  const [searchQuery, setSearchQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [activeChat, setActiveChat] = useState<ChatConversation | null>(null);
  const [messageText, setMessageText] = useState("");
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [chatList, setChatList] = useState<ChatConversation[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sendBusy, setSendBusy] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Konversatsiyalar ro'yxatini yuklash + har 10s yangilash
  useEffect(() => {
    let stopped = false;
    const load = async () => {
      try {
        const res = await api<{ items: ApiConvListItem[] }>("/chats");
        if (stopped) return;
        setChatList(res.items.map(adaptListItem));
      } catch { /* offline / hatolik */ } finally {
        if (!stopped) setLoading(false);
      }
    };
    load();
    const id = setInterval(load, 10000);
    return () => { stopped = true; clearInterval(id); };
  }, []);

  // Active chat tanlanganda — to'liq detalini yuklash + read deb belgilash
  useEffect(() => {
    if (!activeChat || activeChat.messages.length > 0) return;
    const id = activeChat.id;
    api<ApiConvDetail>(`/chats/${id}`)
      .then((c) => {
        setActiveChat((prev) => (prev?.id === id ? adaptDetail(c) : prev));
        // Mark as read
        api(`/chats/${id}/mark-read`, { method: "POST" }).catch(() => null);
        setChatList((prev) => prev.map((cv) => (cv.id === id ? { ...cv, unreadCount: 0 } : cv)));
      })
      .catch(() => null);
  }, [activeChat]);

  const filteredChats = useMemo(() => {
    let result = [...chatList];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c) =>
        c.customerName.toLowerCase().includes(q) ||
        c.customerPhone.includes(q) ||
        c.lastMessage.toLowerCase().includes(q)
      );
    }
    if (channelFilter !== "all") result = result.filter((c) => c.channel === channelFilter);
    if (statusFilter !== "all") result = result.filter((c) => c.status === statusFilter);
    if (agentFilter !== "all") result = result.filter((c) => c.assignedAgent === agentFilter);
    if (priorityFilter !== "all") result = result.filter((c) => c.priority === priorityFilter);
    return result.sort((a, b) => {
      if (a.unreadCount !== b.unreadCount) return b.unreadCount - a.unreadCount;
      return b.lastMessageTime.localeCompare(a.lastMessageTime);
    });
  }, [searchQuery, channelFilter, statusFilter, agentFilter, priorityFilter, chatList]);

  const activeCount = chatList.filter((c) => c.status === "active").length;
  const waitingCount = chatList.filter((c) => c.status === "waiting").length;
  const resolvedToday = chatList.filter((c) => c.status === "resolved").length;
  const totalPotentialValue = chatList
    .filter((c) => c.status === "active" || c.status === "waiting")
    .reduce((s, c) => s + c.estimatedValue, 0);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChat?.messages]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || !activeChat || sendBusy) return;
    const content = messageText.trim();
    setMessageText("");
    setSendBusy(true);
    // Optimistic — darhol ko'rinadi
    const tempId = `M-${Date.now()}`;
    const optimistic: ChatMessage = {
      id: tempId,
      sender: "agent",
      text: content,
      timestamp: new Date().toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" }),
      read: true,
    };
    setActiveChat((prev) =>
      prev ? { ...prev, messages: [...prev.messages, optimistic], lastMessage: content } : null,
    );
    try {
      const res = await api<{
        message: { id: string; direction: string; content: string; authorName: string | null; sentAt: string; read: boolean };
        deliveryReason: string | null;
      }>(`/chats/${activeChat.id}/messages`, { method: "POST", body: { content } });
      const real: ChatMessage = {
        id: res.message.id,
        sender: "agent",
        text: res.message.content,
        timestamp: new Date(res.message.sentAt).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" }),
        read: res.message.read,
      };
      setActiveChat((prev) =>
        prev
          ? { ...prev, messages: prev.messages.map((m) => (m.id === tempId ? real : m)), lastMessage: content }
          : null,
      );
      setChatList((prev) =>
        prev.map((c) =>
          c.id === activeChat.id
            ? { ...c, lastMessage: content, lastMessageTime: real.timestamp }
            : c,
        ),
      );
      if (res.deliveryReason) {
        // Yuborildi (DB'da), lekin mijozga yetib bormadi — diagnostika xabari
        alert(`Saqlandi, lekin mijozga yetib bormadi: ${res.deliveryReason}`);
      }
    } catch (err) {
      // Optimistic xabarni qaytarish
      setActiveChat((prev) =>
        prev ? { ...prev, messages: prev.messages.filter((m) => m.id !== tempId) } : null,
      );
      setMessageText(content);
      alert(err instanceof Error ? err.message : t("chat.sendFailed"));
    } finally {
      setSendBusy(false);
    }
  };

  const handleStageChange = (chatId: string, stage: FunnelStage) => {
    setChatList((prev) => prev.map((c) => (c.id === chatId ? { ...c, funnelStage: stage } : c)));
    if (activeChat?.id === chatId) {
      setActiveChat((prev) => (prev ? { ...prev, funnelStage: stage } : null));
    }
  };

  const handleQuickReply = (text: string) => {
    setMessageText(text);
    setShowQuickReplies(false);
  };

  const funnelStages: FunnelStage[] = [
    "new", "greeting", "needs_clarification", "offer_sent",
    "objection_handling", "closing", "won", "lost", "follow_up",
  ];

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">{t("chat.title")}</h1>
          <p className="text-sm text-slate-500 mt-1">{t("chat.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAnalytics(!showAnalytics)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm transition-all ${
              showAnalytics ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-slate-800 border-slate-700 text-white hover:bg-slate-700"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            {t("chat.analytics")}
          </button>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4 flex-shrink-0">
        {[
          { label: t("chat.stats.active"), value: activeCount, icon: MessageSquare, color: "text-emerald-400", alert: false },
          { label: t("chat.stats.waiting"), value: waitingCount, icon: Clock, color: "text-amber-400", alert: waitingCount > 0 },
          { label: t("chat.stats.resolvedToday"), value: resolvedToday, icon: CheckCheck, color: "text-blue-400", alert: false },
          { label: t("chat.stats.potential"), value: (totalPotentialValue / 1000000).toFixed(1) + "M", icon: Target, color: "text-violet-400", alert: false },
          { label: t("chat.stats.avgResponse"), value: "42s", icon: Zap, color: "text-cyan-400", alert: false },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06 }}
            className={`bg-slate-900 border rounded-xl p-4 ${stat.alert ? "border-amber-500/20" : "border-slate-800"}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <p className="text-xs text-slate-500">{stat.label}</p>
            </div>
            <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Analytics Panel */}
      <AnimatePresence>
        {showAnalytics && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-4 flex-shrink-0">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Funnel */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <Target className="w-4 h-4 text-emerald-400" />
                  {t("chat.funnelTitle")}
                </h3>
                <div className="space-y-1.5">
                  {funnelStats.map((fs, i) => {
                    const cfg = funnelStageConfig[fs.stage];
                    const maxCount = Math.max(...funnelStats.map((f) => f.count));
                    return (
                      <div key={fs.stage}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[11px] text-slate-400">{t(`funnel.${fs.stage}`)}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-white font-medium">{fs.count}</span>
                            {fs.value > 0 && <span className="text-[10px] text-emerald-400">{(fs.value / 1000000).toFixed(1)}M</span>}
                          </div>
                        </div>
                        <div className="h-5 bg-slate-800 rounded-md overflow-hidden relative">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(fs.count / maxCount) * 100}%` }}
                            transition={{ duration: 0.5, delay: i * 0.06 }}
                            className="h-full rounded-md flex items-center px-2"
                            style={{ backgroundColor: cfg.color.replace("text-", "").replace("400", "500").replace("slate", "64748b").replace("blue", "3b82f6").replace("cyan", "06b6d4").replace("violet", "8b5cf6").replace("amber", "f59e0b").replace("orange", "f97316").replace("emerald", "10b981").replace("red", "ef4444").replace("pink", "ec4899") }}
                          >
                            <span className="text-[10px] text-white font-medium">{Math.round((fs.count / maxCount) * 100)}%</span>
                          </motion.div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Hourly Volume */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-emerald-400" />
                  Soatlik hajm
                </h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={hourlyChatVolume} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                      <defs>
                        <linearGradient id="incomingGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 10 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 10 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="incoming" stroke="#10b981" strokeWidth={2} fill="url(#incomingGrad)" dot={false} />
                      <Area type="monotone" dataKey="resolved" stroke="#3b82f6" strokeWidth={2} fill="none" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-center gap-4 mt-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                    <span className="text-[10px] text-slate-500">Kiruvchi</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
                    <span className="text-[10px] text-slate-500">Yakunlangan</span>
                  </div>
                </div>
              </div>

              {/* Agent Performance */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <Headphones className="w-4 h-4 text-emerald-400" />
                  Agentlar samaradorligi
                </h3>
                <div className="space-y-3">
                  {agents.map((agent) => (
                    <div key={agent.id} className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-9 h-9 bg-slate-800 rounded-full flex items-center justify-center text-xs font-bold text-white">
                          {agent.avatar}
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900 ${
                          agent.status === "online" ? "bg-emerald-500" : agent.status === "away" ? "bg-amber-500" : "bg-slate-500"
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{agent.name}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-[10px] text-slate-500">{agent.activeChats} faol</span>
                          <span className="text-[10px] text-slate-500">{agent.resolvedToday} yakun</span>
                          <span className="text-[10px] text-slate-500">{agent.avgResponseTime}s</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                        <span className="text-xs text-white font-medium">{agent.csat}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Chat Area — mobile single-pane (list ↔ active), desktop split */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Chat List Sidebar — hidden on mobile when a chat is active */}
        <div className={`${activeChat ? "hidden md:flex" : "flex"} w-full md:w-80 md:flex-shrink-0 bg-slate-900 border border-slate-800 rounded-xl flex-col overflow-hidden`}>
          {/* Search & Filters */}
          <div className="p-3 border-b border-slate-800">
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                placeholder={t("chat.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {[
                { key: "all", label: t("chat.filter.all") },
                { key: "active", label: t("chat.filter.active") },
                { key: "waiting", label: t("chat.filter.waiting") },
                { key: "resolved", label: t("chat.filter.resolved") },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key === "all" ? "all" : f.key)}
                  className={`px-2 py-1 rounded-md text-[10px] font-medium whitespace-nowrap transition-all ${
                    (f.key === "all" && statusFilter === "all") || statusFilter === f.key
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-slate-800 text-slate-400 border border-slate-700"
                  }`}
                >
                  {f.label}
                </button>
              ))}
              <button onClick={() => setShowFilters(!showFilters)} className="p-1 rounded-md bg-slate-800 text-slate-400 hover:text-white transition-all">
                <Filter className="w-3 h-3" />
              </button>
            </div>
            <AnimatePresence>
              {showFilters && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="grid grid-cols-2 gap-1.5 pt-2 mt-2 border-t border-slate-800">
                    <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-[10px] text-white focus:outline-none">
                      <option value="all">Barcha kanallar</option>
                      {Object.entries(channelLabels).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
                    </select>
                    <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-[10px] text-white focus:outline-none">
                      <option value="all">Barcha agentlar</option>
                      {agents.map((a) => (<option key={a.id} value={a.name}>{a.name}</option>))}
                    </select>
                    <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-[10px] text-white focus:outline-none">
                      <option value="all">Barcha prioritetlar</option>
                      <option value="high">Yuqori</option>
                      <option value="medium">O'rta</option>
                      <option value="low">Past</option>
                    </select>
                    <button onClick={() => { setSearchQuery(""); setChannelFilter("all"); setStatusFilter("all"); setAgentFilter("all"); setPriorityFilter("all"); }} className="text-[10px] text-slate-400 hover:text-white transition-colors">Tozalash</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Chat Items */}
          <div className="flex-1 overflow-y-auto">
            {filteredChats.map((chat) => {
              const isActive = activeChat?.id === chat.id;
              const cfg = funnelStageConfig[chat.funnelStage];
              return (
                <button
                  key={chat.id}
                  onClick={() => setActiveChat(chat)}
                  className={`w-full text-left p-3 border-b border-slate-800/50 transition-all ${
                    isActive ? "bg-emerald-500/5 border-l-2 border-l-emerald-500" : "hover:bg-slate-800/30 border-l-2 border-l-transparent"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="relative flex-shrink-0">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        chat.priority === "high" ? "bg-red-500/20 text-red-400" :
                        chat.priority === "medium" ? "bg-amber-500/20 text-amber-400" :
                        "bg-emerald-500/20 text-emerald-400"
                      }`}>
                        {chat.customerAvatar}
                      </div>
                      {chat.unreadCount > 0 && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[9px] text-white font-bold">
                          {chat.unreadCount}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className={`text-xs font-medium truncate ${isActive ? "text-emerald-400" : "text-white"}`}>{chat.customerName}</p>
                        <span className="text-[10px] text-slate-500 flex-shrink-0">{chat.lastMessageTime}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">{chat.lastMessage}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`text-[9px] px-1 py-0.5 rounded border ${cfg.bg} ${cfg.color}`}>
                          {t(`funnel.${chat.funnelStage}`)}
                        </span>
                        <span className="text-[9px] text-slate-500">{channelLabels[chat.channel]}</span>
                        {chat.estimatedValue > 0 && (
                          <span className="text-[9px] text-emerald-400">{(chat.estimatedValue / 1000000).toFixed(1)}M</span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
            {filteredChats.length === 0 && (
              <div className="py-8 text-center">
                <MessageSquare className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                <p className="text-xs text-slate-500">
                  {loading ? t("common.loading") : t("chat.empty")}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Chat Content */}
        {activeChat ? (
          <div className="flex-1 flex gap-4 min-h-0">
            {/* Messages Area */}
            <div className="flex-1 flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              {/* Chat Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 flex-shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Mobile back — chat list'ga qaytish */}
                  <button
                    onClick={() => setActiveChat(null)}
                    className="md:hidden p-1.5 -ml-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                    aria-label="Orqaga"
                  >
                    <CornerDownLeft className="w-4 h-4" />
                  </button>
                  <div className="w-9 h-9 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 text-xs font-bold flex-shrink-0">
                    {activeChat.customerAvatar}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{activeChat.customerName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-slate-500">{activeChat.customerPhone}</span>
                      <span className="text-[10px] text-slate-500">{channelLabels[activeChat.channel]}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-all">
                    <Phone className="w-4 h-4" />
                  </button>
                  <button className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-all">
                    <Mail className="w-4 h-4" />
                  </button>
                  <button className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-all">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Funnel Stage Bar */}
              <div className="px-4 py-2 border-b border-slate-800 flex-shrink-0">
                <div className="flex items-center gap-1 overflow-x-auto">
                  {funnelStages.map((stage) => {
                    const cfg = funnelStageConfig[stage];
                    const isCurrent = activeChat.funnelStage === stage;
                    const isPast = funnelStageConfig[stage].order < funnelStageConfig[activeChat.funnelStage].order;
                    return (
                      <button
                        key={stage}
                        onClick={() => handleStageChange(activeChat.id, stage)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium whitespace-nowrap transition-all ${
                          isCurrent
                            ? `${cfg.bg} ${cfg.color}`
                            : isPast
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-slate-800 text-slate-500"
                        }`}
                      >
                        {isPast && !isCurrent ? <CheckCheck className="w-3 h-3" /> : null}
                        {t(`funnel.${stage}`)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {activeChat.messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.sender === "agent" || msg.sender === "bot" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[70%] rounded-xl px-3 py-2 ${
                      msg.sender === "agent"
                        ? "bg-emerald-500/20 text-emerald-100"
                        : msg.sender === "bot"
                        ? "bg-blue-500/20 text-blue-100"
                        : msg.sender === "system"
                        ? "bg-slate-700/50 text-slate-400 text-center mx-auto text-[10px]"
                        : "bg-slate-800 text-white"
                    }`}>
                      {msg.sender === "system" ? (
                        <span>{msg.text}</span>
                      ) : (
                        <>
                          <p className="text-xs leading-relaxed">{msg.text}</p>
                          <div className={`flex items-center gap-1 mt-1 ${msg.sender === "customer" ? "justify-end" : "justify-end"}`}>
                            <span className="text-[10px] text-slate-500">{msg.timestamp}</span>
                            {msg.sender === "agent" && (
                              msg.read ? <CheckCheck className="w-3 h-3 text-emerald-400" /> : <Check className="w-3 h-3 text-slate-500" />
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="px-3 py-2 border-t border-slate-800 flex-shrink-0">
                <AnimatePresence>
                  {showQuickReplies && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-2">
                      <div className="flex flex-wrap gap-1.5">
                        {quickReplies.map((qr) => (
                          <button
                            key={qr.id}
                            onClick={() => handleQuickReply(qr.text)}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md text-[10px] text-slate-300 hover:text-white transition-all"
                            title={qr.text}
                          >
                            {qr.title}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowQuickReplies(!showQuickReplies)} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-all">
                    <CornerDownLeft className="w-4 h-4" />
                  </button>
                  <button className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-all">
                    <Paperclip className="w-4 h-4" />
                  </button>
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                    placeholder={t("chat.messagePlaceholder")}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                  />
                  <button className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-all">
                    <Smile className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleSendMessage}
                    disabled={!messageText.trim()}
                    className="p-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Customer Info Sidebar */}
            <div className="w-64 flex-shrink-0 bg-slate-900 border border-slate-800 rounded-xl p-4 overflow-y-auto">
              <div className="text-center mb-4">
                <div className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center text-lg font-bold ${
                  activeChat.priority === "high" ? "bg-red-500/20 text-red-400" :
                  activeChat.priority === "medium" ? "bg-amber-500/20 text-amber-400" :
                  "bg-emerald-500/20 text-emerald-400"
                }`}>
                  {activeChat.customerAvatar}
                </div>
                <p className="text-sm font-semibold text-white mt-2">{activeChat.customerName}</p>
                <p className="text-[10px] text-slate-500">{activeChat.customerPhone}</p>
              </div>

              <div className="space-y-3">
                <div className="bg-slate-800/50 rounded-lg p-2.5">
                  <p className="text-[10px] text-slate-500">Potensial qiymat</p>
                  <p className="text-sm font-bold text-emerald-400">{activeChat.estimatedValue.toLocaleString()} so'm</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-2.5">
                  <p className="text-[10px] text-slate-500">Birinchi javob vaqti</p>
                  <p className="text-sm font-bold text-white">{activeChat.firstResponseTime ? activeChat.firstResponseTime + "s" : "—"}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-2.5">
                  <p className="text-[10px] text-slate-500">O'rtacha javob</p>
                  <p className="text-sm font-bold text-white">{activeChat.avgResponseTime ? activeChat.avgResponseTime + "s" : "—"}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-2.5">
                  <p className="text-[10px] text-slate-500">CSAT</p>
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    <p className="text-sm font-bold text-white">{activeChat.csat || "—"}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-800">
                <p className="text-[10px] text-slate-500 mb-2">Teglar</p>
                <div className="flex flex-wrap gap-1">
                  {activeChat.tags.map((tag) => (
                    <span key={tag} className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400">{tag}</span>
                  ))}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
                <p className="text-[10px] text-slate-500 mb-2">Amallar</p>
                <button className="w-full flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs text-white transition-all">
                  <Archive className="w-3.5 h-3.5" />
                  Arxivlash
                </button>
                <button className="w-full flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs text-white transition-all">
                  <Tag className="w-3.5 h-3.5" />
                  Teg qo'shish
                </button>
                <button className="w-full flex items-center gap-2 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-xs text-red-400 transition-all">
                  <Ban className="w-3.5 h-3.5" />
                  Spam deb belgilash
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-slate-900 border border-slate-800 rounded-xl">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 text-slate-700 mx-auto mb-3" />
              <p className="text-sm text-slate-500">Chat tanlang</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
