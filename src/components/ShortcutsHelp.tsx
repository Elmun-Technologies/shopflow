// `?` bossangiz chiqadigan klaviatura yorliqlari ro'yxati.

import { motion, AnimatePresence } from "framer-motion";
import { Keyboard, X } from "lucide-react";
import { SHORTCUTS_LIST } from "../hooks/useGlobalShortcuts";
import { useT } from "../i18n";

export function ShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useT();
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
            className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-semibold text-white">{t("shortcuts.title")}</h2>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                aria-label={t("common.close")}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto">
              <ul className="space-y-1">
                {SHORTCUTS_LIST.map((s) => (
                  <li key={s.labelKey} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-slate-800/50">
                    <span className="text-sm text-slate-300">{t(s.labelKey)}</span>
                    <span className="flex items-center gap-1">
                      {s.keys.map((k, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 bg-slate-800 border border-slate-700 rounded text-[11px] font-mono text-slate-200"
                        >
                          {k}
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="px-4 py-3 border-t border-slate-800 bg-slate-900/50">
              <p className="text-[11px] text-slate-500 text-center">{t("shortcuts.tip")}</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
