import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertCircle, Info, X, ShoppingCart } from "lucide-react";
import { connectShopEvents, ensureDemoAuth, type ShopEvent } from "./api";

type ToastKind = "success" | "error" | "info" | "order";
interface Toast { id: string; kind: ToastKind; title: string; description?: string; duration?: number }

interface Ctx {
  toast: (t: Omit<Toast, "id">) => void;
  onShopEvent: (cb: (e: ShopEvent) => void) => () => void;
}
const C = createContext<Ctx | null>(null);

export function useNotifications() {
  const c = useContext(C);
  if (!c) throw new Error("useNotifications must be inside <NotificationsProvider>");
  return c;
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const eventListeners = useRef<Set<(e: ShopEvent) => void>>(new Set());

  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const item: Toast = { ...t, id };
    setToasts((prev) => [...prev, item]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), t.duration ?? 6000);
  }, []);

  const onShopEvent = useCallback((cb: (e: ShopEvent) => void) => {
    eventListeners.current.add(cb);
    return () => { eventListeners.current.delete(cb); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let disconnect: (() => void) | null = null;
    (async () => {
      try {
        await ensureDemoAuth();
      } catch {
        return;
      }
      if (cancelled) return;
      disconnect = connectShopEvents((event) => {
        eventListeners.current.forEach((cb) => cb(event));
        if (event.type === "order.created") {
          toast({
            kind: "order",
            title: "Yangi buyurtma!",
            description: `${event.order.orderNumber} — ${event.order.total.toLocaleString()} so'm`,
            duration: 8000,
          });
          if (typeof window !== "undefined" && "Audio" in window) {
            try { new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAAA").play().catch(() => {}); } catch { /* */ }
          }
        }
      });
    })();
    return () => { cancelled = true; disconnect?.(); };
  }, [toast]);

  return (
    <C.Provider value={{ toast, onShopEvent }}>
      {children}
      <ToastContainer toasts={toasts} onClose={(id) => setToasts((prev) => prev.filter((x) => x.id !== id))} />
    </C.Provider>
  );
}

function ToastContainer({ toasts, onClose }: { toasts: Toast[]; onClose: (id: string) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            className={`pointer-events-auto rounded-xl border shadow-2xl p-4 backdrop-blur min-w-[320px] ${
              t.kind === "success" ? "bg-emerald-950/90 border-emerald-500/40" :
              t.kind === "error" ? "bg-red-950/90 border-red-500/40" :
              t.kind === "order" ? "bg-blue-950/90 border-blue-500/40" :
              "bg-slate-900/90 border-slate-800"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5">
                {t.kind === "success" && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                {t.kind === "error" && <AlertCircle className="w-5 h-5 text-red-400" />}
                {t.kind === "info" && <Info className="w-5 h-5 text-blue-400" />}
                {t.kind === "order" && <ShoppingCart className="w-5 h-5 text-blue-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{t.title}</p>
                {t.description && <p className="text-xs text-slate-400 mt-0.5">{t.description}</p>}
              </div>
              <button onClick={() => onClose(t.id)} className="shrink-0 p-0.5 rounded text-slate-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
