// Header'dagi bell ikonkasi ostida ochiluvchi panel.
// Yangi buyurtmalar va lidlarni ko'rsatadi + yangi buyurtma kelganda
// ovozli "ding" eshittiriladi (mute toggle bilan).

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, BellOff, ShoppingBag, Radio, ShoppingCart, ExternalLink, Loader2, Volume2, VolumeX } from "lucide-react";
import { ordersApi, leadsApi } from "../api/endpoints";
import { formatRelative } from "../utils/format";
import { useT } from "../i18n";
import { playSound, isNotifMuted, setNotifMuted, showBrowserNotification } from "../utils/notifSound";
import { loadNotifPrefs } from "../utils/notifPrefs";

const LS_KEY = "shopflow.lastSeenNotifications";
// Polling chastotasi — yangi buyurtma uchun real-timega yaqinroq bo'lishi uchun
// 60s → 15s ga kamaytirildi
const POLL_INTERVAL_MS = 15_000;

type NotifKind = "order" | "lead";

interface NotifItem {
  id: string;
  kind: NotifKind;
  title: string;
  subtitle: string;
  createdAt: string;
  page: "orders" | "leads";
  refId: string;
}

function loadLastSeen(): string {
  try {
    return localStorage.getItem(LS_KEY) ?? "1970-01-01T00:00:00Z";
  } catch {
    return "1970-01-01T00:00:00Z";
  }
}

function saveLastSeen(iso: string) {
  try { localStorage.setItem(LS_KEY, iso); } catch { /* ignore */ }
}

export function NotificationsPanel({ onNavigate }: { onNavigate?: (page: "orders" | "leads") => void }) {
  const { t, lang } = useT();
  const locale = lang === "ru" ? "ru-RU" : "uz-UZ";
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastSeen, setLastSeen] = useState<string>(() => loadLastSeen());
  const [muted, setMuted] = useState<boolean>(() => isNotifMuted());
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Eng so'nggi ko'rilgan ID'lar — yangi buyurtma/lidni aniqlash uchun.
  // Birinchi yuklov "yangi" hisoblanmasligi uchun ref'ni state'dan ajratdik.
  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const knownLeadIdsRef = useRef<Set<string>>(new Set());
  const firstLoadDoneRef = useRef<boolean>(false);

  // Tashqari bossang yopish + Esc
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  // Polling
  useEffect(() => {
    let cancelled = false;
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [ordersRes, leadsRes] = await Promise.all([
          ordersApi.list({ pageSize: 5 }),
          leadsApi.list({ pageSize: 5 }),
        ]);
        if (cancelled) return;

        // Yangi buyurtmalarni aniqlash — preferences asosida sound + browser notification
        const orderIds = new Set(ordersRes.items.map((o) => o.id));
        const leadIds = new Set(leadsRes.items.map((l) => l.id));
        if (firstLoadDoneRef.current) {
          const prefs = loadNotifPrefs();
          const newOrders = ordersRes.items.filter((o) => !knownOrderIdsRef.current.has(o.id));
          const newLeads = leadsRes.items.filter((l) => !knownLeadIdsRef.current.has(l.id));

          if (newOrders.length > 0 && prefs.orders.sound) {
            playSound(prefs.soundType);
          }
          if (newOrders.length > 0 && prefs.orders.browser) {
            const first = newOrders[0];
            void showBrowserNotification(
              t("notif.newOrder", { code: first.code }),
              `${first.customer?.name ?? "—"} · ${Number(first.total).toLocaleString(locale)} ${first.currency === "UZS" ? t("common.sum") : first.currency}`,
            );
          }
          if (newLeads.length > 0 && prefs.leads.sound) {
            playSound(prefs.soundType);
          }
          if (newLeads.length > 0 && prefs.leads.browser) {
            const first = newLeads[0];
            void showBrowserNotification(
              t("notif.newLead", { name: first.name }),
              first.channel?.name ?? `#${first.code}`,
            );
          }
        }
        knownOrderIdsRef.current = orderIds;
        knownLeadIdsRef.current = leadIds;
        firstLoadDoneRef.current = true;

        const orderItems: NotifItem[] = ordersRes.items.map((o) => ({
          id: `o-${o.id}`,
          kind: "order",
          title: `#${o.code} · ${o.customer?.name ?? "—"}`,
          subtitle: `${Number(o.total).toLocaleString(locale)} ${o.currency === "UZS" ? t("common.sum") : o.currency}`,
          createdAt: o.createdAt,
          page: "orders",
          refId: o.id,
        }));
        const leadItems: NotifItem[] = leadsRes.items.map((l) => ({
          id: `l-${l.id}`,
          kind: "lead",
          title: `${l.name} · #${l.code}`,
          subtitle: l.channel?.name ?? "—",
          createdAt: l.createdAt,
          page: "leads",
          refId: l.id,
        }));
        const merged = [...orderItems, ...leadItems]
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, 10);
        setItems(merged);
      } catch {
        // sokin ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchAll();
    // Real-time SSE — yangi event kelganda darhol fetchAll, polling sekinroq fallback
    const token = localStorage.getItem("shopflow.token");
    const apiBase = (import.meta as { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL ?? "/api";
    let es: EventSource | null = null;
    if (token) {
      try {
        // EventSource Bearer header'ni qo'llamaydi — query param ishlatamiz
        es = new EventSource(`${apiBase}/events/stream?token=${encodeURIComponent(token)}`);
        es.addEventListener("order.created", () => void fetchAll());
        es.addEventListener("order.status_changed", () => void fetchAll());
        es.addEventListener("lead.created", () => void fetchAll());
        es.onerror = () => { /* keep-alive yo'qolsa polling fallback uchun ulanish qaytadi */ };
      } catch { /* SSE qo'llab-quvvatlanmasa polling'da qoladi */ }
    }
    // Fallback polling — SSE'siz brauzerlar/proxy uchun (60s — chastota kamaytirildi)
    const id = setInterval(() => { void fetchAll(); }, POLL_INTERVAL_MS * 4);
    return () => {
      cancelled = true;
      clearInterval(id);
      if (es) es.close();
    };
  }, []);

  const unseenCount = useMemo(
    () => items.filter((it) => it.createdAt > lastSeen).length,
    [items, lastSeen],
  );

  const handleOpen = () => {
    setOpen(true);
    if (items[0]) {
      const next = items[0].createdAt;
      setLastSeen(next);
      saveLastSeen(next);
    }
  };

  const handleItemClick = (it: NotifItem) => {
    setOpen(false);
    onNavigate?.(it.page);
  };

  const toggleMuted = () => {
    const next = !muted;
    setMuted(next);
    setNotifMuted(next);
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => (open ? setOpen(false) : handleOpen())}
        aria-label={t("header.notifications")}
        className="relative p-2 rounded-lg text-slate-500 hover:text-forest-900 hover:bg-cream-100 transition-all"
      >
        {muted ? <BellOff className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
        {unseenCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1">
            {unseenCount > 9 ? "9+" : unseenCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            role="menu"
            className="absolute right-0 top-full mt-2 w-80 max-h-[70vh] bg-white border border-cream-300 rounded-xl shadow-2xl overflow-hidden flex flex-col z-50"
          >
            <div className="px-4 py-3 border-b border-cream-300 flex items-center justify-between flex-shrink-0">
              <p className="text-sm font-semibold text-forest-800">{t("notif.title")}</p>
              <div className="flex items-center gap-2">
                {loading && <Loader2 className="w-3.5 h-3.5 text-slate-500 animate-spin" />}
                <button
                  onClick={toggleMuted}
                  className="p-1 rounded text-slate-500 hover:text-forest-900 hover:bg-cream-100"
                  title={muted ? t("notif.unmute") : t("notif.mute")}
                  aria-label={muted ? t("notif.unmute") : t("notif.mute")}
                >
                  {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {items.length === 0 && !loading ? (
                <div className="px-4 py-10 text-center">
                  <Bell className="w-10 h-10 mx-auto text-cream-300 mb-2" />
                  <p className="text-sm text-slate-500">{t("notif.empty")}</p>
                </div>
              ) : (
                <div className="divide-y divide-cream-300/60">
                  {items.map((it) => {
                    const Icon = it.kind === "order" ? ShoppingBag : it.kind === "lead" ? Radio : ShoppingCart;
                    const colorCls = it.kind === "order" ? "text-forest-700" : it.kind === "lead" ? "text-leaf-600" : "text-amber-500";
                    const isNew = it.createdAt > lastSeen;
                    return (
                      <button
                        key={it.id}
                        onClick={() => handleItemClick(it)}
                        className="w-full text-left px-4 py-3 hover:bg-cream-100/50 active:bg-cream-100 transition-colors flex items-start gap-3"
                      >
                        <div className={`w-8 h-8 rounded-lg bg-cream-100 flex items-center justify-center flex-shrink-0 ${colorCls}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-medium text-forest-800 truncate flex-1">{it.title}</p>
                            {isNew && <span className="w-1.5 h-1.5 rounded-full bg-leaf-400 flex-shrink-0" />}
                          </div>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">{it.subtitle}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">{formatRelative(it.createdAt)}</p>
                        </div>
                        <ExternalLink className="w-3 h-3 text-slate-400 flex-shrink-0 mt-1" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-cream-300 px-4 py-2 text-center flex-shrink-0">
              <p className="text-[10px] text-slate-500">{t("notif.refreshing")}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
