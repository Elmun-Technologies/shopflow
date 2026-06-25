// Platforma uchun confirm dialogi — window.confirm() o'rniga.
// Foydalanish:
//   const confirm = useConfirm();
//   const ok = await confirm({ title: "O'chirilsinmi?", description: "..." });
//   if (ok) await deleteIt();

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useT } from "../../i18n";

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  kind?: "danger" | "default";
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const Ctx = createContext<ConfirmFn | null>(null);

interface ResolverEntry {
  opts: ConfirmOptions;
  resolve: (result: boolean) => void;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useT();
  const [active, setActive] = useState<ResolverEntry | null>(null);
  const activeRef = useRef<ResolverEntry | null>(null);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const confirm: ConfirmFn = useCallback((opts) => {
    return new Promise<boolean>((resolve) => {
      setActive({ opts, resolve });
    });
  }, []);

  const closeWith = useCallback((result: boolean) => {
    const a = activeRef.current;
    if (a) a.resolve(result);
    setActive(null);
  }, []);

  // Escape klavishi — bekor qiladi
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeWith(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, closeWith]);

  const isDanger = active?.opts.kind === "danger";

  return (
    <Ctx.Provider value={confirm}>
      {children}
      {active && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[300] p-4"
          onClick={() => closeWith(false)}
        >
          <div
            className="bg-white border border-cream-300 rounded-2xl p-5 max-w-sm w-full shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-labelledby="confirm-title"
          >
            <div className="flex items-start gap-3 mb-4">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  isDanger ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 id="confirm-title" className="text-base font-semibold text-forest-800">
                  {active.opts.title}
                </h3>
                {active.opts.description && (
                  <p className="text-sm text-slate-500 mt-1">{active.opts.description}</p>
                )}
              </div>
              <button
                onClick={() => closeWith(false)}
                aria-label={t("common.close")}
                className="p-1 -mr-1 text-slate-500 hover:text-forest-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => closeWith(false)}
                className="flex-1 px-4 py-2.5 text-sm text-slate-700 bg-cream-100 hover:bg-cream-200 rounded-lg font-medium transition-colors"
              >
                {active.opts.cancelText ?? t("common.cancel")}
              </button>
              <button
                onClick={() => closeWith(true)}
                autoFocus
                className={`flex-1 px-4 py-2.5 text-sm rounded-lg font-semibold transition-colors ${
                  isDanger
                    ? "bg-red-500 hover:bg-red-600 text-white"
                    : "bg-leaf-400 hover:bg-leaf-500 text-forest-800"
                }`}
              >
                {active.opts.confirmText ?? t("common.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const fn = useContext(Ctx);
  if (!fn) {
    // Provider yo'q muhitda native confirm fallback
    return async (opts) => window.confirm(opts.title + (opts.description ? `\n\n${opts.description}` : ""));
  }
  return fn;
}
