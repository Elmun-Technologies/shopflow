import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: string;
  kind: ToastKind;
  text: string;
}

interface ToastContextValue {
  show: (text: string, kind?: ToastKind) => void;
}

const Ctx = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const show = useCallback((text: string, kind: ToastKind = "info") => {
    const id = `t-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setItems((prev) => [...prev, { id, kind, text }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div className="fixed top-3 left-3 right-3 z-[200] flex flex-col gap-2 pointer-events-none" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        {items.map((t) => (
          <ToastBubble key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Fallback — no provider mounted
    return { show: () => undefined };
  }
  return ctx;
}

function ToastBubble({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t1 = requestAnimationFrame(() => setVisible(true));
    const t2 = setTimeout(() => setLeaving(true), 3000);
    const t3 = setTimeout(onDismiss, 3300);
    return () => {
      cancelAnimationFrame(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onDismiss]);

  const palette = {
    success: { Icon: CheckCircle2, cls: "bg-emerald-500/95 text-white" },
    error: { Icon: AlertCircle, cls: "bg-rose-500/95 text-white" },
    info: { Icon: Info, cls: "bg-slate-800/95 text-white" },
  }[toast.kind];

  const { Icon, cls } = palette;

  return (
    <div
      className={`pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-lg backdrop-blur ${cls} transition-all duration-300 ${
        visible && !leaving ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
      }`}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      <span className="text-sm flex-1">{toast.text}</span>
      <button
        onClick={() => {
          setLeaving(true);
          setTimeout(onDismiss, 200);
        }}
        className="p-0.5 -mr-1 opacity-70 hover:opacity-100"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
