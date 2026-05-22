// Header'dagi bell ikonkasi ostida ochiluvchi panel.
// Yangi buyurtmalar, lidlar va tashlab ketilgan savatlarni ko'rsatadi.
// "Ko'rilgan" holatini localStorage'da saqlaymiz — lastSeenAt ISO timestamp.

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, ShoppingBag, Radio, ShoppingCart, ExternalLink, Loader2 } from "lucide-react";
import { ordersApi, leadsApi } from "../api/endpoints";
import { formatRelative } from "../utils/format";
import { useT } from "../i18n";

const LS_KEY = "shopflow.lastSeenNotifications";

type NotifKind = "order" | "lead";

interface NotifItem {
  id: string;
  kind: NotifKind;
  title: string;
  subtitle: string;
  createdAt: string;
  page: "orders" | "leads";
  refId: string; // order/lead id — keyinchalik to'g'ridan-to'g'ri detailga ochish uchun
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
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastSeen, setLastSeen] = useState<string>(() => loadLastSeen());
  const panelRef = useRef<HTMLDivElement | null>(null);

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

  // Ma'lumotlarni yuklash — har 60s da auto-refresh
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
        const orderItems: NotifItem[] = ordersRes.items.map((o) => ({
          id: `o-${o.id}`,
          kind: "order",
          title: `#${o.code} · ${o.customer?.name ?? "—"}`,
          subtitle: `${Number(o.total).toLocaleString("uz-UZ")} ${o.currency === "UZS" ? "so'm" : o.currency}`,
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
        // sokin ignore — bell pulsatsiyasi yo'q bo'lsa ham UI'ni buzmaymiz
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchAll();
    const id = setInterval(() => { void fetchAll(); }, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const unseenCount = useMemo(
    () => items.filter((it) => it.createdAt > lastSeen).length,
    [items, lastSeen],
  );

  const handleOpen = () => {
    setOpen(true);
    // Ochilganda eng yangi item'ni "ko'rilgan" deb belgilash
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

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => (open ? setOpen(false) : handleOpen())}
        aria-label={t("header.notifications")}
        className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
      >
        <Bell className="w-5 h-5" />
        {unseenCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-rose-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1">
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
            className="absolute right-0 top-full mt-2 w-80 max-h-[70vh] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col z-50"
          >
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
              <p className="text-sm font-semibold text-white">{t("notif.title")}</p>
              {loading && <Loader2 className="w-3.5 h-3.5 text-slate-500 animate-spin" />}
            </div>

            <div className="flex-1 overflow-y-auto">
              {items.length === 0 && !loading ? (
                <div className="px-4 py-10 text-center">
                  <Bell className="w-10 h-10 mx-auto text-slate-700 mb-2" />
                  <p className="text-sm text-slate-500">{t("notif.empty")}</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-800/60">
                  {items.map((it) => {
                    const Icon = it.kind === "order" ? ShoppingBag : it.kind === "lead" ? Radio : ShoppingCart;
                    const colorCls = it.kind === "order" ? "text-emerald-400" : it.kind === "lead" ? "text-blue-400" : "text-amber-400";
                    const isNew = it.createdAt > lastSeen;
                    return (
                      <button
                        key={it.id}
                        onClick={() => handleItemClick(it)}
                        className="w-full text-left px-4 py-3 hover:bg-slate-800/50 active:bg-slate-800 transition-colors flex items-start gap-3"
                      >
                        <div className={`w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0 ${colorCls}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-medium text-white truncate flex-1">{it.title}</p>
                            {isNew && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />}
                          </div>
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">{it.subtitle}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">{formatRelative(it.createdAt)}</p>
                        </div>
                        <ExternalLink className="w-3 h-3 text-slate-600 flex-shrink-0 mt-1" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-slate-800 px-4 py-2 text-center flex-shrink-0">
              <p className="text-[10px] text-slate-500">{t("notif.refreshing")}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
