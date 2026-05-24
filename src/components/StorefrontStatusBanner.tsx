// Admin barcha sahifalari yuqorisida ko'rinadigan ogohlantirish.
// Vitrina nashr qilinmagan bo'lsa — bir click bilan publish qilish imkoniyati.
// Operator Vitrina'ga kirmasdan ham muammoni darhol ko'radi va hal qiladi.

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, X, Loader2 } from "lucide-react";
import { vitrinaApi } from "../api/endpoints";

const DISMISSED_KEY = "shopflow.storefrontBannerDismissed";

interface Props {
  onOpenVitrina?: () => void;
}

export function StorefrontStatusBanner({ onOpenVitrina }: Props) {
  const [published, setPublished] = useState<boolean | null>(null);
  const [layout, setLayout] = useState<{ blocks: unknown[]; brand?: Record<string, unknown> } | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Session ichida bir marta yopib qo'yish mumkin — qayta yuklasa ko'rinadi
    try {
      if (sessionStorage.getItem(DISMISSED_KEY) === "1") setDismissed(true);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await vitrinaApi.getLayout();
        if (cancelled) return;
        setPublished(data.published);
        setLayout({ blocks: data.blocks ?? [], brand: data.brand as Record<string, unknown> ?? {} });
      } catch {
        // Sokin ignore — banner umuman ko'rinmaydi
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handlePublish = useCallback(async () => {
    if (!layout) return;
    setPublishing(true);
    try {
      await vitrinaApi.saveLayout({
        blocks: layout.blocks as never,
        brand: layout.brand,
        published: true,
      });
      setPublished(true);
    } catch {
      alert("Nashr qilishda xato. Qayta urinib ko'ring.");
    } finally {
      setPublishing(false);
    }
  }, [layout]);

  const handleDismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem(DISMISSED_KEY, "1"); } catch { /* ignore */ }
  };

  // Faqat published=false bo'lganda va dismiss qilinmagan bo'lsa ko'rsatamiz
  if (published === null || published === true || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="bg-amber-50 border-b border-amber-200 px-4 md:px-6 py-3"
      >
        <div className="flex items-center gap-3 max-w-7xl">
          <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Globe className="w-4 h-4 text-amber-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-900">Do'koningiz yashirin holatda</p>
            <p className="text-xs text-amber-700 leading-tight mt-0.5">
              Mijozlar Telegram Mini App'ni ochsa <strong>"Do'kon yopiq"</strong> xabarini ko'radi.
              Sotuvni boshlash uchun do'konni nashr qiling.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-leaf-400 hover:bg-leaf-500 disabled:opacity-50 text-forest-800 text-xs font-semibold rounded-lg transition-colors"
            >
              {publishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
              {publishing ? "Nashr qilinmoqda…" : "Nashr qilish"}
            </button>
            {onOpenVitrina && (
              <button
                onClick={onOpenVitrina}
                className="hidden sm:inline-block px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 rounded-lg transition-colors"
              >
                Vitrinaga o'tish
              </button>
            )}
            <button
              onClick={handleDismiss}
              className="p-1.5 text-amber-700 hover:bg-amber-100 rounded-lg transition-colors"
              aria-label="Yopish"
              title="Ushbu sessiyada yopish"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
