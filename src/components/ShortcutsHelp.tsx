// `?` bossangiz chiqadigan klaviatura yorliqlari ro'yxati.

import { motion, AnimatePresence } from "framer-motion";
import { Keyboard, X } from "lucide-react";
import { SHORTCUTS_LIST } from "../hooks/useGlobalShortcuts";
import { useT } from "../i18n";
import { useFocusTrap } from "../hooks/useFocusTrap";

export function ShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useT();
  // Focus-trap + Escape + fokus tiklash (modal a11y)
  const panelRef = useFocusTrap<HTMLDivElement>(open, onClose);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.95, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 10 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={t("shortcuts.title")}
            className="bg-white border border-cream-300 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 border-b border-cream-300">
              <div className="flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-forest-700" />
                <h2 className="text-sm font-semibold text-forest-800">{t("shortcuts.title")}</h2>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-500 hover:text-forest-900 hover:bg-cream-100"
                aria-label={t("common.close")}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto">
              <ul className="space-y-1">
                {SHORTCUTS_LIST.map((s) => (
                  <li key={s.labelKey} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-cream-100/50">
                    <span className="text-sm text-slate-700">{t(s.labelKey)}</span>
                    <span className="flex items-center gap-1">
                      {s.keys.map((k, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 bg-cream-100 border border-cream-300 rounded text-[11px] font-mono text-forest-700"
                        >
                          {k}
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="px-4 py-3 border-t border-cream-300 bg-white/50">
              <p className="text-[11px] text-slate-500 text-center">{t("shortcuts.tip")}</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
