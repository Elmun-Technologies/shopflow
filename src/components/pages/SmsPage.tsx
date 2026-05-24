// SMS Marketing sahifasi — real /api/sms integratsiyasi
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Send, MessageSquare, Users, CheckCircle2, Loader2,
  AlertCircle, Phone, Zap,
} from "lucide-react";
import { api } from "../../api/client";
import { useAsync } from "../../hooks/useAsync";

interface SmsStatus {
  configured: boolean;
  provider: string | null;
}

interface Segment {
  id: string;
  name: string;
  type: string;
  cachedCount: number;
}

const cls = "w-full bg-cream-100 border border-cream-300 rounded-xl px-3 py-2.5 text-sm text-forest-800 placeholder-slate-400 focus:outline-none focus:border-leaf-500/60 transition-colors";

const SMS_TEMPLATES = [
  { label: "Yangi aksiya", text: "Salom! Bizda yangi aksiya boshlanadi. Batafsil ma'lumot uchun do'konimizga tashrif buyuring." },
  { label: "Buyurtma tayyorlandi", text: "Buyurtmangiz tayyor. Kurer tez orada yetkazib beradi. Rahmat!" },
  { label: "Tug'ilgan kun", text: "Tug'ilgan kuningiz bilan! Do'konimizdan maxsus chegirma sifatida 10% beramiz." },
];

export default function SmsPage() {
  const { data: smsStatus } = useAsync<SmsStatus>(() => api("/sms/status"), []);
  const { data: segments } = useAsync<Segment[]>(() => api("/segments"), []);

  const [message, setMessage] = useState("");
  const [targetType, setTargetType] = useState<"all" | "segment">("all");
  const [segmentId, setSegmentId] = useState("");
  const [testPhone, setTestPhone] = useState("");

  const [sending, setSending] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const charCount = message.length;
  const smsCount = Math.ceil(charCount / 160) || 0;

  // SMS sonini hisoblash
  const estimatedCount =
    targetType === "segment"
      ? segments?.find((s) => s.id === segmentId)?.cachedCount ?? 0
      : null;

  const sendBulk = async () => {
    if (!message.trim()) { setResult({ type: "error", text: "Xabar matni kiritish shart" }); return; }
    if (targetType === "segment" && !segmentId) { setResult({ type: "error", text: "Segment tanlash shart" }); return; }
    setSending(true);
    setResult(null);
    try {
      await api("/sms/send-bulk", {
        method: "POST",
        body: {
          message: message.trim(),
          ...(targetType === "segment" ? { segmentId } : {}),
        },
      });
      setResult({ type: "success", text: "SMS jo'natish navbatga qo'yildi. Natija biroz vaqtdan so'ng ko'rinadi." });
      setMessage("");
    } catch (e) {
      setResult({ type: "error", text: e instanceof Error ? e.message : "SMS jo'natishda xato" });
    } finally {
      setSending(false);
    }
  };

  const sendTest = async () => {
    if (!message.trim()) { setResult({ type: "error", text: "Xabar matni kiritish shart" }); return; }
    if (!testPhone.trim()) { setResult({ type: "error", text: "Test uchun telefon kiritish shart" }); return; }
    setTestSending(true);
    setResult(null);
    try {
      await api("/sms/send-test", {
        method: "POST",
        body: { phone: testPhone, message: message.trim() },
      });
      setResult({ type: "success", text: `Test SMS ${testPhone} raqamiga jo'natildi` });
    } catch (e) {
      setResult({ type: "error", text: e instanceof Error ? e.message : "Test SMS xato" });
    } finally {
      setTestSending(false);
    }
  };

  useEffect(() => {
    if (result) {
      const timer = setTimeout(() => setResult(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [result]);

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold text-forest-900">SMS Marketing</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Mijozlarga ommaviy SMS xabarlar yuborish (Eskiz.uz)
        </p>
      </motion.div>

      {/* Provider status */}
      <div
        className={`flex items-center gap-3 p-4 rounded-2xl border ${
          smsStatus?.configured
            ? "bg-leaf-50 border-leaf-200"
            : "bg-amber-50 border-amber-200"
        }`}
      >
        {smsStatus?.configured ? (
          <>
            <CheckCircle2 className="w-5 h-5 text-forest-700 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-forest-800">Eskiz.uz ulanган</p>
              <p className="text-xs text-forest-700/70">SMS jo'natishga tayyor</p>
            </div>
          </>
        ) : (
          <>
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">SMS provayder sozlanmagan</p>
              <p className="text-xs text-amber-700">
                Server'da <code className="bg-amber-100 px-1 rounded">ESKIZ_LOGIN</code> va{" "}
                <code className="bg-amber-100 px-1 rounded">ESKIZ_PASSWORD</code> env o'zgaruvchilarini o'rnating
              </p>
            </div>
          </>
        )}
      </div>

      {/* Compose */}
      <div className="bg-white border border-cream-300/80 rounded-2xl p-5 space-y-4">
        <h2 className="font-semibold text-forest-800">Xabar yozish</h2>

        {/* Templates */}
        <div>
          <p className="text-xs font-medium text-slate-500 mb-2">Shablonlar:</p>
          <div className="flex flex-wrap gap-2">
            {SMS_TEMPLATES.map((t) => (
              <button
                key={t.label}
                onClick={() => setMessage(t.text)}
                className="px-3 py-1.5 bg-cream-100 hover:bg-cream-200 border border-cream-300 rounded-lg text-xs font-medium text-slate-600 transition-colors"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Textarea */}
        <div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            maxLength={480}
            placeholder="Xabar matni (maks. 480 belgi)..."
            className="w-full bg-cream-100 border border-cream-300 rounded-xl px-3 py-2.5 text-sm text-forest-800 placeholder-slate-400 focus:outline-none focus:border-leaf-500/60 resize-none"
          />
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-slate-400">{charCount}/480 belgi</p>
            {charCount > 0 && (
              <p className="text-xs text-slate-400">
                ≈ {smsCount} SMS ({smsCount > 1 ? "ko'p qismli" : "oddiy"})
              </p>
            )}
          </div>
        </div>

        {/* Recipient selector */}
        <div>
          <p className="text-xs font-medium text-slate-500 mb-2">Kimga yuborish:</p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              onClick={() => setTargetType("all")}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${
                targetType === "all"
                  ? "bg-leaf-100 border-leaf-400/40 text-forest-800"
                  : "bg-cream-100 border-cream-300 text-slate-600 hover:bg-cream-200"
              }`}
            >
              <Users className="w-4 h-4" />
              Barcha mijozlar
            </button>
            <button
              onClick={() => setTargetType("segment")}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${
                targetType === "segment"
                  ? "bg-leaf-100 border-leaf-400/40 text-forest-800"
                  : "bg-cream-100 border-cream-300 text-slate-600 hover:bg-cream-200"
              }`}
            >
              <Zap className="w-4 h-4" />
              Segment
            </button>
          </div>

          {targetType === "segment" && (
            <select
              value={segmentId}
              onChange={(e) => setSegmentId(e.target.value)}
              className={cls}
            >
              <option value="">Segmentni tanlang...</option>
              {segments?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.cachedCount} ta mijoz)
                </option>
              ))}
            </select>
          )}

          {estimatedCount !== null && estimatedCount > 0 && (
            <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              ~{estimatedCount} ta SMS jo'natiladi
            </p>
          )}
        </div>

        {/* Result */}
        {result && (
          <div
            className={`flex items-center gap-2 p-3 rounded-xl text-sm ${
              result.type === "success"
                ? "bg-leaf-50 border border-leaf-200 text-forest-700"
                : "bg-red-50 border border-red-200 text-red-600"
            }`}
          >
            {result.type === "success"
              ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              : <AlertCircle className="w-4 h-4 flex-shrink-0" />
            }
            {result.text}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={sendBulk}
            disabled={sending || !smsStatus?.configured || !message.trim()}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-forest-700 hover:bg-forest-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sending ? "Jo'natilmoqda..." : "Yuborish"}
          </button>
        </div>
      </div>

      {/* Test SMS */}
      <div className="bg-white border border-cream-300/80 rounded-2xl p-5 space-y-3">
        <h2 className="font-semibold text-forest-800">Test SMS yuborish</h2>
        <p className="text-xs text-slate-500">
          Katta guruhga yuborishdan oldin bitta raqamga test qiling
        </p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="tel"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="+998 90 123 45 67"
              className="w-full bg-cream-100 border border-cream-300 rounded-xl pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:border-leaf-500/60"
            />
          </div>
          <button
            onClick={sendTest}
            disabled={testSending || !smsStatus?.configured || !message.trim() || !testPhone.trim()}
            className="px-5 py-2.5 bg-sky-100 hover:bg-sky-200 border border-sky-200 text-sky-700 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {testSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Test
          </button>
        </div>
      </div>
    </div>
  );
}
