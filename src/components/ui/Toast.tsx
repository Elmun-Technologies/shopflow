// Platforma uchun toast tizimi (dark, bottom-right).
// Foydalanish:
//   <AppToastProvider> ... </AppToastProvider>  // App.tsx ichida bir marta
//   const toast = useAppToast();
//   toast.success("Saqlandi");
//   toast.error("Xato yuz berdi");
//   toast.info("Diqqat...");

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: string;
  kind: ToastKind;
  text: string;
}

interface AppToastContextValue {
  show: (text: string, kind?: ToastKind) => void;
  success: (text: string) => void;
  error: (text: string) => void;
  info: (text: string) => void;
}

const Ctx = createContext<AppToastContextValue | null>(null);

export function AppToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const show = useCallback((text: string, kind: ToastKind = "info") => {
    const id = `t-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setItems((prev) => [...prev, { id, kind, text }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value: AppToastContextValue = {
    show,
    success: useCallback((text: string) => show(text, "success"), [show]),
    error: useCallback((text: string) => show(text, "error"), [show]),
    info: useCallback((text: string) => show(text, "info"), [show]),
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none w-full max-w-sm">
        {items.map((t) => (
          <ToastBubble key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useAppToast(): AppToastContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Provider mavjud bo'lmagan muhitda (test/jsdom) jim no-op
    return {
      show: () => undefined,
      success: () => undefined,
      error: () => undefined,
      info: () => undefined,
    };
  }
  return ctx;
}

function ToastBubble({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t1 = requestAnimationFrame(() => setVisible(true));
    const t2 = setTimeout(() => setLeaving(true), 3500);
    const t3 = setTimeout(onDismiss, 3800);
    return () => {
      cancelAnimationFrame(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onDismiss]);

  const palette = {
    success: {
      Icon: CheckCircle2,
      cls: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300",
      iconCls: "text-emerald-400",
    },
    error: {
      Icon: AlertCircle,
      cls: "bg-rose-500/15 border-rose-500/30 text-rose-300",
      iconCls: "text-rose-400",
    },
    info: {
      Icon: Info,
      cls: "bg-slate-800/90 border-slate-700 text-slate-200",
      iconCls: "text-blue-400",
    },
  }[toast.kind];

  const { Icon, cls, iconCls } = palette;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-auto flex items-start gap-2.5 px-4 py-3 rounded-xl border backdrop-blur shadow-lg ${cls} transition-all duration-300 ${
        visible && !leaving ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      }`}
    >
      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconCls}`} />
      <span className="text-sm flex-1 leading-snug">{toast.text}</span>
      <button
        onClick={() => {
          setLeaving(true);
          setTimeout(onDismiss, 200);
        }}
        aria-label="Yopish"
        className="p-0.5 -mr-1 opacity-60 hover:opacity-100 transition-opacity"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
