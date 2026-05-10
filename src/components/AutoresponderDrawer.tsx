import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Save, Bell, RotateCcw } from "lucide-react";
import { useShopSetting } from "../lib/useShopSetting";
import { useNotifications } from "../lib/notifications";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface Templates {
  pending: string;
  confirmed: string;
  preparing: string;
  shipping: string;
  delivered: string;
  cancelled: string;
}

const defaults: Templates = {
  pending: "📦 Buyurtma <b>{order_id}</b> qabul qilindi va ko'rib chiqilmoqda.",
  confirmed: "✅ Buyurtma <b>{order_id}</b> tasdiqlandi va tayyorlash boshlandi.",
  preparing: "🛠 Buyurtma <b>{order_id}</b> tayyorlanmoqda.",
  shipping: "🚚 Buyurtma <b>{order_id}</b> kuryer bilan jo'natildi.",
  delivered: "🎉 Buyurtma <b>{order_id}</b> muvaffaqiyatli yetkazildi! Xaridingiz uchun rahmat.",
  cancelled: "❌ Buyurtma <b>{order_id}</b> bekor qilindi.",
};

const fields: Array<{ key: keyof Templates; label: string; description: string }> = [
  { key: "pending", label: "Buyurtma qabul qilindi", description: "Yangi buyurtma kelganda" },
  { key: "confirmed", label: "Buyurtma tasdiqlandi", description: "Admin tasdiqlaganda" },
  { key: "preparing", label: "Tayyorlanmoqda", description: "Tayyorlash boshlandida" },
  { key: "shipping", label: "Yetkazilmoqda", description: "Kuryer bilan jo'natilganda" },
  { key: "delivered", label: "Yetkazildi", description: "Mijozga yetkazib berilganda" },
  { key: "cancelled", label: "Bekor qilindi", description: "Buyurtma bekor qilinganda" },
];

export default function AutoresponderDrawer({ open, onClose }: Props) {
  const { toast } = useNotifications();
  const [templates, setTemplates] = useShopSetting<Templates>("autoresponder", defaults);
  const [draft, setDraft] = useState<Templates>(defaults);
  const [activeKey, setActiveKey] = useState<keyof Templates | null>(null);

  useEffect(() => {
    if (open) setDraft(templates);
  }, [open, templates]);

  function save() {
    setTemplates(draft);
    toast({ kind: "success", title: "Saqlandi", description: "Avtoresponder shablonlari yangilandi" });
    onClose();
  }

  function resetDefaults() {
    if (!confirm("Barcha shablonlarni standart holatga qaytarish?")) return;
    setDraft(defaults);
    toast({ kind: "info", title: "Standart shablonlar tiklandi" });
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[85] bg-black/70 flex items-stretch justify-end" onClick={onClose}>
          <motion.div initial={{ x: 500 }} animate={{ x: 0 }} exit={{ x: 500 }} transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-slate-900 border-l border-slate-800 overflow-y-auto"
          >
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900 z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center">
                  <Bell className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <h2 className="text-white font-semibold">Avtoresponder</h2>
                  <p className="text-xs text-slate-500">Buyurtma holati o'zgarganda yuboriladigan xabarlar</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-violet-500/10 border border-violet-500/30 rounded-xl p-3 text-xs text-slate-300">
                <p className="font-medium text-violet-300 mb-1">📝 Yo'riqnoma</p>
                <p>Quyidagi shablonlar Telegram bot orqali mijozga avtomatik yuboriladi.</p>
                <p className="mt-1">O'zgaruvchilar:</p>
                <ul className="mt-1 space-y-0.5 ml-3">
                  <li>• <code className="text-violet-400">{"{order_id}"}</code> — buyurtma raqami</li>
                  <li>• <code className="text-violet-400">{"{status}"}</code> — holat nomi</li>
                </ul>
                <p className="mt-1">HTML belgilar: <code className="text-violet-400">&lt;b&gt;qalin&lt;/b&gt;</code>, <code className="text-violet-400">&lt;i&gt;qiyshiq&lt;/i&gt;</code></p>
              </div>

              {fields.map((f) => (
                <div key={f.key} className="bg-slate-800/40 rounded-xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-white">{f.label}</p>
                      <p className="text-[10px] text-slate-500">{f.description}</p>
                    </div>
                  </div>
                  <textarea
                    value={draft[f.key]}
                    onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                    onFocus={() => setActiveKey(f.key)}
                    onBlur={() => setActiveKey(null)}
                    rows={2}
                    className={`w-full bg-slate-900 border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors ${activeKey === f.key ? "border-violet-500/60" : "border-slate-700"}`}
                    placeholder="Xabar matni..."
                  />
                </div>
              ))}
            </div>

            <div className="sticky bottom-0 bg-slate-900 border-t border-slate-800 p-4 flex gap-2">
              <button onClick={resetDefaults} className="px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg flex items-center gap-1.5" title="Standart shablonlar">
                <RotateCcw className="w-4 h-4" />
              </button>
              <button onClick={onClose} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium py-2.5 rounded-lg">Bekor</button>
              <button onClick={save} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium py-2.5 rounded-lg flex items-center justify-center gap-2">
                <Save className="w-4 h-4" />
                Saqlash
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
