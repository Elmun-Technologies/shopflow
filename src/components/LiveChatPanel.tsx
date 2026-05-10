import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Search, Send, MessageCircle, Phone, RefreshCw, ArrowLeft } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { useNotifications } from "../lib/notifications";

interface Conversation {
  tgUserId: string;
  externalTgUserId: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  phone: string | null;
  lastMessageAt: number | null;
  lastMessagePreview: string;
  lastMessageDirection: string | null;
  messageCount: number;
}

interface ChatMessage {
  id: number;
  direction: string;
  text: string | null;
  type: string | null;
  createdAt: number;
}

export default function LiveChatPanel() {
  const { onShopEvent, toast } = useNotifications();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState(false);
  const [search, setSearch] = useState("");
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  async function loadConvos() {
    try {
      const data = await api.chat.conversations();
      setConversations(data);
    } catch (err) {
      if (err instanceof ApiError) console.warn(err.message);
    } finally {
      setLoadingList(false);
    }
  }

  async function loadMessages(tgUserId: string) {
    setLoadingMsg(true);
    try {
      const data = await api.chat.messages(tgUserId);
      setMessages(data.messages);
    } catch (err) {
      if (err instanceof ApiError) toast({ kind: "error", title: err.message });
    } finally {
      setLoadingMsg(false);
    }
  }

  useEffect(() => {
    void loadConvos();
    return onShopEvent((ev) => {
      if (ev.type === "order.created" || ev.type === "order.updated") {
        void loadConvos();
        if (activeUserId) void loadMessages(activeUserId);
      }
    });
  }, [onShopEvent, activeUserId]);

  useEffect(() => {
    if (activeUserId) void loadMessages(activeUserId);
  }, [activeUserId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    if (!activeUserId || !reply.trim() || sending) return;
    setSending(true);
    try {
      await api.chat.send(activeUserId, reply.trim());
      setReply("");
      await loadMessages(activeUserId);
      await loadConvos();
      toast({ kind: "success", title: "Yuborildi" });
    } catch (err) {
      toast({ kind: "error", title: "Xato", description: err instanceof ApiError ? err.message : "" });
    } finally {
      setSending(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || c.username || "";
      return name.toLowerCase().includes(q) || (c.phone ?? "").includes(q);
    });
  }, [conversations, search]);

  const active = conversations.find((c) => c.tgUserId === activeUserId);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <div>
            <h3 className="text-white font-semibold">💬 Operator chat (Telegram)</h3>
            <p className="text-xs text-slate-500">Mijozlar bilan to'g'ridan-to'g'ri muloqot</p>
          </div>
        </div>
        <button onClick={loadConvos} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400">
          <RefreshCw className={`w-4 h-4 ${loadingList ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 h-[600px]">
        {/* Sidebar — conversations list */}
        <div className={`border-r border-slate-800 flex flex-col ${activeUserId ? "hidden md:flex" : "flex"}`}>
          <div className="p-3 border-b border-slate-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Qidiruv..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingList && conversations.length === 0 ? (
              <div className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-600" /></div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 text-slate-700" />
                Hali suhbat yo'q
              </div>
            ) : (
              filtered.map((c) => {
                const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || c.username || "Mehmon";
                const initial = name[0]?.toUpperCase() ?? "?";
                return (
                  <button
                    key={c.tgUserId}
                    onClick={() => setActiveUserId(c.tgUserId)}
                    className={`w-full px-4 py-3 border-b border-slate-800 hover:bg-slate-800/50 flex items-center gap-3 text-left ${activeUserId === c.tgUserId ? "bg-slate-800/70" : ""}`}
                  >
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-semibold shrink-0">
                      {initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-sm text-white truncate">{name}</p>
                        {c.lastMessageAt && (
                          <span className="text-[10px] text-slate-500 shrink-0 ml-2">
                            {new Date(c.lastMessageAt).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        {c.lastMessageDirection === "out" && <span className="text-blue-400">Siz: </span>}
                        {c.lastMessagePreview}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Chat panel */}
        <div className={`md:col-span-2 flex flex-col ${activeUserId ? "flex" : "hidden md:flex"}`}>
          {!active ? (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
              <div className="text-center">
                <MessageCircle className="w-16 h-16 mx-auto text-slate-700 mb-3" />
                <p>Suhbatni tanlang</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-3">
                <button onClick={() => setActiveUserId(null)} className="md:hidden p-1 rounded text-slate-400">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-semibold text-sm shrink-0">
                  {([active.firstName, active.lastName].filter(Boolean).join(" ") || active.username || "?")[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{[active.firstName, active.lastName].filter(Boolean).join(" ") || "Mehmon"}</p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {active.username && <a href={`https://t.me/${active.username}`} target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400">@{active.username}</a>}
                    {active.username && active.phone && " · "}
                    {active.phone && <a href={`tel:${active.phone}`} className="hover:text-emerald-400 inline-flex items-center gap-1"><Phone className="w-3 h-3" />{active.phone}</a>}
                  </p>
                </div>
                <button onClick={() => loadMessages(active.tgUserId)} className="p-1.5 rounded text-slate-400 hover:bg-slate-800">
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingMsg ? "animate-spin" : ""}`} />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-950/50">
                {loadingMsg && messages.length === 0 ? (
                  <div className="flex justify-center pt-8"><Loader2 className="w-5 h-5 animate-spin text-slate-600" /></div>
                ) : messages.length === 0 ? (
                  <p className="text-center text-slate-600 text-xs py-8">Hali xabar yo'q</p>
                ) : (
                  messages.map((m) => {
                    const isOut = m.direction === "out";
                    return (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${isOut ? "justify-end" : "justify-start"}`}
                      >
                        <div className={`max-w-[80%] px-3 py-2 rounded-2xl ${
                          isOut ? "bg-emerald-600 text-white rounded-br-sm" : "bg-slate-800 text-slate-100 rounded-bl-sm"
                        }`}>
                          <p className="text-sm whitespace-pre-wrap break-words">{m.text ?? <span className="italic opacity-50">[{m.type ?? "boshqa"}]</span>}</p>
                          <p className={`text-[10px] mt-1 ${isOut ? "text-emerald-100" : "text-slate-500"}`}>
                            {new Date(m.createdAt).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-3 border-t border-slate-800 flex gap-2">
                <input
                  type="text"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
                  placeholder="Xabar yozing..."
                  disabled={sending}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 disabled:opacity-50"
                />
                <button
                  onClick={send}
                  disabled={!reply.trim() || sending}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white px-4 rounded-lg flex items-center gap-2 text-sm font-medium"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
