import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GitMerge, Plus, Pencil, Trash2, CheckCircle,
  Users, Send, ChevronDown, ChevronUp, X, Clock,
  ShoppingBag, Star, CalendarDays, Repeat, Heart,
} from "lucide-react";
import { api } from "../../api/client";
import { useAppToast } from "../ui/Toast";
import { useConfirm } from "../ui/ConfirmDialog";

// ─── Types ────────────────────────────────────────────────────────────────────

type BotSequenceTrigger = "NEW_CUSTOMER" | "FIRST_PURCHASE" | "INACTIVE_DAYS" | "VIP_STATUS" | "BIRTHDAY" | "WEEKLY";

interface BotSequenceStep {
  id?: string;
  stepOrder: number;
  delayHours: number;
  message: string;
}

interface BotSequence {
  id: string;
  name: string;
  trigger: BotSequenceTrigger;
  inactiveDays?: number | null;
  weekDay?: number | null;
  active: boolean;
  steps: BotSequenceStep[];
  _count?: { enrollments: number };
  completedCount?: number;
  createdAt: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const TRIGGER_CONFIG: Record<BotSequenceTrigger, { label: string; icon: React.ElementType; color: string; bg: string; desc: string }> = {
  NEW_CUSTOMER:   { label: "Yangi mijoz",       icon: Users,        color: "text-blue-600",   bg: "bg-blue-100",   desc: "Birinchi /start bosishi yoki ro'yxatdan o'tishi" },
  FIRST_PURCHASE: { label: "Birinchi xarid",    icon: ShoppingBag,  color: "text-leaf-600",   bg: "bg-leaf-100",   desc: "Birinchi buyurtma yakunlanganda" },
  INACTIVE_DAYS:  { label: "Nofaol mijozlar",   icon: Clock,        color: "text-amber-600",  bg: "bg-amber-100",  desc: "N kun xarid qilmagan mijozlar" },
  VIP_STATUS:     { label: "VIP maqomi",         icon: Star,         color: "text-violet-600", bg: "bg-violet-100", desc: "Mijoz VIP bo'lganda" },
  BIRTHDAY:       { label: "Tug'ilgan kun",      icon: Heart,        color: "text-pink-600",   bg: "bg-pink-100",   desc: "Tug'ilgan kunida tabriknoma" },
  WEEKLY:         { label: "Haftalik eslatma",   icon: CalendarDays, color: "text-cyan-600",   bg: "bg-cyan-100",   desc: "Har hafta belgilangan kunda yuboriladi" },
};

const WEEK_DAYS = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];

const TEMPLATES: Record<BotSequenceTrigger, string[]> = {
  NEW_CUSTOMER:   [
    "Xush kelibsiz! 🎉 Biz bilan xarid qilganingiz uchun rahmat. Birinchi buyurtmangizga 10% chegirma taqdim etamiz. Promo kod: WELCOME10",
    "Salom! Katalogimizni ko'rib chiqing va o'zingizga yoqqan mahsulotni tanlang 🛍️",
    "Savollaringiz bo'lsa, biz doimo yordamga tayyormiz! Operatorimiz bilan bog'laning.",
  ],
  FIRST_PURCHASE: [
    "Birinchi xaridingiz uchun katta rahmat! 🙏 Buyurtmangiz tez orada yetkazib beriladi.",
    "Bizdan xarid qilganingiz qanday bo'ldi? Izoh qoldirsangiz, bonuslar oling! ⭐",
    "Yana kelasizmi? Keyingi buyurtmangizga 5% chegirma tayyorlab qo'ydik 🎁",
  ],
  INACTIVE_DAYS:  [
    "Sog' bo'ling! 👋 Yangi mahsulotlarimiz sizi kutmoqda. Qaytib keling!",
    "Sizni sog'indik! 💚 Bugun maxsus chegirma mavjud — faqat bugun 15% off.",
  ],
  VIP_STATUS:     [
    "Tabriklaymiz! 🌟 Siz endi VIP mijozimiz. VIP afzalliklari bilan tanishing.",
    "VIP sifatida siz yangi mahsulotlarni birinchi bo'lib ko'rasiz 👑",
  ],
  BIRTHDAY:       [
    "Tug'ilgan kuningiz bilan! 🎂🎉 Siz uchun maxsus sovg'a — bugun 20% chegirma!",
  ],
  WEEKLY:         [
    "Xayrli juma! 🛍️ Hafta uchun eng yaxshi takliflarimiz bilan tanishing!",
    "Yangi mahsulotlar keldi! Katalogni ko'ring 👀",
  ],
};

// ─── Sequence Card ────────────────────────────────────────────────────────────

function SequenceCard({ seq, onEdit, onDelete, onToggle }: {
  seq: BotSequence;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = TRIGGER_CONFIG[seq.trigger];
  const TriggerIcon = cfg.icon;

  return (
    <div className="bg-white rounded-2xl border border-cream-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 p-4">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
          <TriggerIcon className={`w-4.5 h-4.5 ${cfg.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-forest-800 truncate">{seq.name}</span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
              {cfg.label}
            </span>
            {seq.trigger === "INACTIVE_DAYS" && seq.inactiveDays && (
              <span className="text-[10px] text-slate-400">{seq.inactiveDays} kun</span>
            )}
            {seq.trigger === "WEEKLY" && seq.weekDay != null && (
              <span className="text-[10px] text-slate-400">{WEEK_DAYS[seq.weekDay]}</span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{cfg.desc}</p>

          {/* Stats row */}
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <Users className="w-3.5 h-3.5" />
              <span>{seq._count?.enrollments ?? 0} ro'yxatda</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>{seq.completedCount ?? 0} yuborildi</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <Send className="w-3.5 h-3.5" />
              <span>{seq.steps.length} qadam</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={onToggle}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              seq.active
                ? "bg-leaf-100 text-leaf-700 hover:bg-leaf-200"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            {seq.active ? "Faol" : "Nofaol"}
          </button>
          <button onClick={onEdit} className="p-1.5 rounded-lg text-slate-400 hover:text-forest-700 hover:bg-cream-100 transition-all">
            <Pencil className="w-4 h-4" />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all">
            <Trash2 className="w-4 h-4" />
          </button>
          <button onClick={() => setExpanded((v) => !v)} className="p-1.5 rounded-lg text-slate-400 hover:bg-cream-100 transition-all">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Steps (expanded) */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-2 border-t border-cream-100 pt-3">
              {seq.steps.map((step, i) => (
                <div key={step.id ?? i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-6 h-6 rounded-full bg-leaf-100 text-leaf-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </div>
                    {i < seq.steps.length - 1 && <div className="w-px flex-1 bg-cream-200 mt-1" />}
                  </div>
                  <div className="flex-1 pb-2">
                    {step.delayHours > 0 && (
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-1">
                        <Clock className="w-3 h-3" />
                        <span>{step.delayHours >= 24 ? `${Math.floor(step.delayHours / 24)} kun` : `${step.delayHours} soat`} keyin</span>
                      </div>
                    )}
                    <div className="bg-cream-50 rounded-xl p-3 text-xs text-slate-700 border border-cream-200 whitespace-pre-wrap">
                      {step.message}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Step Editor ──────────────────────────────────────────────────────────────

function StepEditor({ step, index, total, onChange, onRemove, onMove }: {
  step: BotSequenceStep;
  index: number;
  total: number;
  onChange: (s: BotSequenceStep) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  return (
    <div className="border border-cream-200 rounded-xl p-3 bg-cream-50 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-forest-700">{index + 1}-qadam</span>
        <div className="flex items-center gap-1">
          {index > 0 && (
            <button onClick={() => onMove(-1)} className="p-1 text-slate-400 hover:text-forest-700">
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          )}
          {index < total - 1 && (
            <button onClick={() => onMove(1)} className="p-1 text-slate-400 hover:text-forest-700">
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={onRemove} className="p-1 text-slate-400 hover:text-red-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
        <span className="text-xs text-slate-500 flex-shrink-0">
          {index === 0 ? "Darhol" : "Kechikish:"}
        </span>
        {index > 0 && (
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              max={8760}
              value={step.delayHours}
              onChange={(e) => onChange({ ...step, delayHours: Math.max(0, parseInt(e.target.value) || 0) })}
              className="w-16 text-xs px-2 py-1 border border-cream-300 rounded-lg bg-white focus:outline-none focus:border-leaf-400"
            />
            <span className="text-xs text-slate-400">soat</span>
          </div>
        )}
      </div>
      <textarea
        rows={3}
        value={step.message}
        onChange={(e) => onChange({ ...step, message: e.target.value })}
        placeholder="Xabar matni... (HTML: <b>qalin</b>, <i>kursiv</i>)"
        className="w-full text-xs px-3 py-2 border border-cream-300 rounded-xl bg-white focus:outline-none focus:border-leaf-400 resize-none"
      />
    </div>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function SequenceModal({ seq, onClose, onSave }: {
  seq: Partial<BotSequence> | null;
  onClose: () => void;
  onSave: (data: Omit<BotSequence, "id" | "createdAt" | "_count" | "completedCount">) => Promise<void>;
}) {
  const [name, setName] = useState(seq?.name ?? "");
  const [trigger, setTrigger] = useState<BotSequenceTrigger>(seq?.trigger ?? "NEW_CUSTOMER");
  const [inactiveDays, setInactiveDays] = useState(seq?.inactiveDays ?? 30);
  const [weekDay, setWeekDay] = useState(seq?.weekDay ?? 5); // Juma
  const [active, setActive] = useState(seq?.active ?? true);
  const [steps, setSteps] = useState<BotSequenceStep[]>(
    seq?.steps?.length ? seq.steps : [{ stepOrder: 0, delayHours: 0, message: "" }]
  );
  const [saving, setSaving] = useState(false);

  const addStep = () => setSteps((s) => [...s, { stepOrder: s.length, delayHours: 24, message: "" }]);
  const removeStep = (i: number) => setSteps((s) => s.filter((_, idx) => idx !== i).map((st, idx) => ({ ...st, stepOrder: idx })));
  const updateStep = (i: number, s: BotSequenceStep) => setSteps((prev) => prev.map((st, idx) => idx === i ? s : st));
  const moveStep = (i: number, dir: -1 | 1) => {
    setSteps((prev) => {
      const arr = [...prev];
      const j = i + dir;
      if (j < 0 || j >= arr.length) return arr;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return arr.map((s, idx) => ({ ...s, stepOrder: idx }));
    });
  };

  const useTemplate = (tmpl: string) => {
    setSteps((prev) => [...prev.slice(0, -1), { ...prev[prev.length - 1], message: tmpl }]);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    if (steps.some((s) => !s.message.trim())) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        trigger,
        inactiveDays: trigger === "INACTIVE_DAYS" ? inactiveDays : null,
        weekDay: trigger === "WEEKLY" ? weekDay : null,
        active,
        steps,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const cfg = TRIGGER_CONFIG[trigger];
  const templates = TEMPLATES[trigger] ?? [];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-cream-200 w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-cream-100">
          <h2 className="font-bold text-forest-800">
            {seq?.id ? "Sekansni tahrirlash" : "Yangi sekans"}
          </h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-forest-700 hover:bg-cream-100 rounded-lg transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Name */}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Sekans nomi</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="masalan: Yangi mijozga xush kelibsiz"
              className="w-full text-sm px-3 py-2 border border-cream-300 rounded-xl focus:outline-none focus:border-leaf-400"
            />
          </div>

          {/* Trigger */}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-2 block">Trigger (qachon boshlanadi)</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.keys(TRIGGER_CONFIG) as BotSequenceTrigger[]).map((tr) => {
                const c = TRIGGER_CONFIG[tr];
                const Icon = c.icon;
                const selected = trigger === tr;
                return (
                  <button
                    key={tr}
                    onClick={() => setTrigger(tr)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all ${
                      selected ? `${c.bg} border-current ${c.color}` : "border-cream-200 bg-cream-50 text-slate-600 hover:bg-cream-100"
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="text-xs font-medium">{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Trigger-specific options */}
          {trigger === "INACTIVE_DAYS" && (
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-slate-600">Nofaollik muddati:</label>
              <input
                type="number"
                min={1}
                max={365}
                value={inactiveDays}
                onChange={(e) => setInactiveDays(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 text-sm px-3 py-1.5 border border-cream-300 rounded-xl focus:outline-none focus:border-leaf-400"
              />
              <span className="text-xs text-slate-400">kun</span>
            </div>
          )}
          {trigger === "WEEKLY" && (
            <div className="flex items-center gap-3 flex-wrap">
              <label className="text-xs font-semibold text-slate-600">Yuborish kuni:</label>
              {WEEK_DAYS.map((d, i) => (
                <button
                  key={i}
                  onClick={() => setWeekDay(i)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    weekDay === i ? "bg-leaf-400 text-forest-800" : "bg-cream-100 text-slate-600 hover:bg-cream-200"
                  }`}
                >
                  {d.slice(0, 3)}
                </button>
              ))}
            </div>
          )}

          {/* Active toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActive((v) => !v)}
              className={`w-9 h-5 rounded-full transition-all flex-shrink-0 ${active ? "bg-leaf-400" : "bg-slate-200"}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform mx-0.5 ${active ? "translate-x-4" : ""}`} />
            </button>
            <span className="text-xs text-slate-600">{active ? "Faol" : "Nofaol"}</span>
          </div>

          {/* Steps */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-600">Xabarlar ketma-ketligi</label>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
            </div>

            {/* Template hints */}
            {templates.length > 0 && (
              <div className="mb-3 p-2.5 bg-blue-50 border border-blue-100 rounded-xl">
                <p className="text-[10px] font-semibold text-blue-600 mb-1.5">Tayyor shablonlar (bosing):</p>
                <div className="space-y-1">
                  {templates.map((tmpl, i) => (
                    <button
                      key={i}
                      onClick={() => useTemplate(tmpl)}
                      className="w-full text-left text-[10px] text-blue-700 hover:text-blue-900 bg-white hover:bg-blue-50 border border-blue-100 rounded-lg px-2 py-1.5 truncate transition-all"
                    >
                      {tmpl.slice(0, 80)}…
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              {steps.map((step, i) => (
                <StepEditor
                  key={i}
                  step={step}
                  index={i}
                  total={steps.length}
                  onChange={(s) => updateStep(i, s)}
                  onRemove={() => removeStep(i)}
                  onMove={(dir) => moveStep(i, dir)}
                />
              ))}
            </div>
            <button
              onClick={addStep}
              className="mt-2 w-full py-2 border-2 border-dashed border-cream-300 rounded-xl text-xs text-slate-400 hover:border-leaf-400 hover:text-leaf-600 transition-all flex items-center justify-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Qadam qo'shish
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-cream-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-forest-800 transition-all">
            Bekor
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim() || steps.some((s) => !s.message.trim())}
            className="px-5 py-2 text-sm font-semibold rounded-xl bg-leaf-400 text-forest-800 hover:bg-leaf-500 disabled:opacity-50 transition-all"
          >
            {saving ? "Saqlanmoqda…" : "Saqlash"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Admin Chat ID Modal ───────────────────────────────────────────────────────

function AdminNotifyPanel() {
  const [chatId, setChatId] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const toast = useAppToast();

  useEffect(() => {
    api<{ adminTelegramChatId?: string | null }>("/settings/notifications")
      .then((s) => {
        setChatId(s.adminTelegramChatId ?? "");
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api("/settings/notifications", {
        method: "PATCH",
        body: JSON.stringify({ adminTelegramChatId: chatId.trim() || null }),
      });
      toast.success("Admin Telegram chat ID saqlandi");
    } catch {
      toast.error("Saqlab bo'lmadi");
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return null;

  return (
    <div className="bg-white rounded-2xl border border-cream-200 p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-leaf-100 flex items-center justify-center flex-shrink-0">
          <Send className="w-4.5 h-4.5 text-leaf-600" />
        </div>
        <div>
          <h3 className="font-semibold text-forest-800 text-sm">Admin Telegram xabarlari</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Yangi buyurtma yoki lid kelganda Telegramingizga xabar oling.
            Chat ID'ni olish uchun <span className="font-mono">@userinfobot</span>ga /start bosing.
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={chatId}
          onChange={(e) => setChatId(e.target.value)}
          placeholder="123456789 yoki -100123456789"
          className="flex-1 text-sm px-3 py-2 border border-cream-300 rounded-xl focus:outline-none focus:border-leaf-400 font-mono"
        />
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 text-sm font-semibold rounded-xl bg-leaf-400 text-forest-800 hover:bg-leaf-500 disabled:opacity-50 transition-all"
        >
          {saving ? "…" : "Saqlash"}
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VoronkaPage() {
  const toast = useAppToast();
  const confirmDialog = useConfirm();
  const [sequences, setSequences] = useState<BotSequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalSeq, setModalSeq] = useState<Partial<BotSequence> | null | false>(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api<BotSequence[]>("/bot-sequences");
      setSequences(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (data: Omit<BotSequence, "id" | "createdAt" | "_count" | "completedCount">) => {
    if (modalSeq && "id" in modalSeq && modalSeq.id) {
      await api(`/bot-sequences/${modalSeq.id}`, { method: "PATCH", body: JSON.stringify(data) });
      toast.success("Sekans yangilandi");
    } else {
      await api("/bot-sequences", { method: "POST", body: JSON.stringify(data) });
      toast.success("Sekans yaratildi");
    }
    await load();
  };

  const handleDelete = async (seq: BotSequence) => {
    const ok = await confirmDialog({
      title: "Sekansni o'chirish",
      description: `"${seq.name}" sekansini o'chirilsa, barcha yozuvlar ham o'chib ketadi.`,
      confirmText: "O'chirish",
      cancelText: "Bekor",
    });
    if (!ok) return;
    await api(`/bot-sequences/${seq.id}`, { method: "DELETE" });
    toast.success("Sekans o'chirildi");
    await load();
  };

  const handleToggle = async (seq: BotSequence) => {
    await api(`/bot-sequences/${seq.id}`, {
      method: "PATCH",
      body: JSON.stringify({ active: !seq.active }),
    });
    await load();
  };

  const totalEnrolled = sequences.reduce((s, q) => s + (q._count?.enrollments ?? 0), 0);
  const totalCompleted = sequences.reduce((s, q) => s + (q.completedCount ?? 0), 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <GitMerge className="w-5 h-5 text-leaf-500" />
            <h1 className="text-2xl font-bold text-forest-800">Bot Voronka</h1>
          </div>
          <p className="text-sm text-slate-400">
            Avtomatik xabar sekanslar — progrev, follow-up, eslatmalar
          </p>
        </div>
        <button
          onClick={() => setModalSeq({})}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-leaf-400 text-forest-800 font-semibold text-sm hover:bg-leaf-500 transition-all"
        >
          <Plus className="w-4 h-4" />
          Yangi sekans
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Jami sekanslar", value: sequences.length, icon: Repeat, color: "text-violet-600", bg: "bg-violet-50" },
          { label: "Ro'yxatdagi mijozlar", value: totalEnrolled, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Xabar yuborildi", value: totalCompleted, icon: CheckCircle, color: "text-leaf-600", bg: "bg-leaf-50" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-cream-200 p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${s.bg}`}>
              <s.icon className={`w-4.5 h-4.5 ${s.color}`} />
            </div>
            <div>
              <p className="text-lg font-bold text-forest-800">{s.value}</p>
              <p className="text-[11px] text-slate-400">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Admin notify panel */}
      <AdminNotifyPanel />

      {/* Sequences */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-cream-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : sequences.length === 0 ? (
        <div className="bg-white rounded-2xl border border-cream-200 p-12 text-center">
          <GitMerge className="w-12 h-12 text-cream-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-forest-800 mb-1">Hech qanday sekans yo'q</p>
          <p className="text-xs text-slate-400 mb-4">
            Yangi mijozlarga xush kelibsiz, tug'ilgan kun tabriknomasi yoki follow-up sekanslar yarating
          </p>
          <button
            onClick={() => setModalSeq({})}
            className="px-5 py-2 rounded-xl bg-leaf-400 text-forest-800 font-semibold text-sm hover:bg-leaf-500 transition-all"
          >
            Birinchi sekansni yarating
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sequences.map((seq) => (
            <SequenceCard
              key={seq.id}
              seq={seq}
              onEdit={() => setModalSeq(seq)}
              onDelete={() => handleDelete(seq)}
              onToggle={() => handleToggle(seq)}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {modalSeq !== false && (
        <SequenceModal
          seq={modalSeq}
          onClose={() => setModalSeq(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
