// SMS Marketing sahifasi — real /api/sms integratsiyasi
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Send, MessageSquare, Users, CheckCircle2, Loader2,
  AlertCircle, Phone, Zap,
} from "lucide-react";
import { api } from "../../api/client";
import { useAsync } from "../../hooks/useAsync";
import { useT } from "../../i18n";

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
  { labelKey: "sms.tpl.promo.label", textKey: "sms.tpl.promo.text" },
  { labelKey: "sms.tpl.ready.label", textKey: "sms.tpl.ready.text" },
  { labelKey: "sms.tpl.birthday.label", textKey: "sms.tpl.birthday.text" },
];

export default function SmsPage() {
  const { t } = useT();
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
    if (!message.trim()) { setResult({ type: "error", text: t("sms.err.messageRequired") }); return; }
    if (targetType === "segment" && !segmentId) { setResult({ type: "error", text: t("sms.err.segmentRequired") }); return; }
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
      setResult({ type: "success", text: t("sms.toast.queued") });
      setMessage("");
    } catch (e) {
      setResult({ type: "error", text: e instanceof Error ? e.message : t("sms.err.sendFailed") });
    } finally {
      setSending(false);
    }
  };

  const sendTest = async () => {
    if (!message.trim()) { setResult({ type: "error", text: t("sms.err.messageRequired") }); return; }
    if (!testPhone.trim()) { setResult({ type: "error", text: t("sms.err.testPhoneRequired") }); return; }
    setTestSending(true);
    setResult(null);
    try {
      await api("/sms/send-test", {
        method: "POST",
        body: { phone: testPhone, message: message.trim() },
      });
      setResult({ type: "success", text: t("sms.toast.testSent", { phone: testPhone }) });
    } catch (e) {
      setResult({ type: "error", text: e instanceof Error ? e.message : t("sms.err.testFailed") });
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
        <h1 className="text-2xl font-bold text-forest-900">{t("sms.title")}</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {t("sms.subtitle")}
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
              <p className="text-sm font-semibold text-forest-800">{t("sms.status.connected")}</p>
              <p className="text-xs text-forest-700/70">{t("sms.status.ready")}</p>
            </div>
          </>
        ) : (
          <>
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">{t("sms.status.notConfigured")}</p>
              <p className="text-xs text-amber-700">
                {t("sms.status.envBefore")} <code className="bg-amber-100 px-1 rounded">ESKIZ_LOGIN</code> {t("common.and")}{" "}
                <code className="bg-amber-100 px-1 rounded">ESKIZ_PASSWORD</code> {t("sms.status.envAfter")}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Compose */}
      <div className="bg-white border border-cream-300/80 rounded-2xl p-5 space-y-4">
        <h2 className="font-semibold text-forest-800">{t("sms.compose.title")}</h2>

        {/* Templates */}
        <div>
          <p className="text-xs font-medium text-slate-500 mb-2">{t("sms.compose.templates")}</p>
          <div className="flex flex-wrap gap-2">
            {SMS_TEMPLATES.map((tpl) => (
              <button
                key={tpl.labelKey}
                onClick={() => setMessage(t(tpl.textKey))}
                className="px-3 py-1.5 bg-cream-100 hover:bg-cream-200 border border-cream-300 rounded-lg text-xs font-medium text-slate-600 transition-colors"
              >
                {t(tpl.labelKey)}
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
            placeholder={t("sms.compose.placeholder")}
            className="w-full bg-cream-100 border border-cream-300 rounded-xl px-3 py-2.5 text-sm text-forest-800 placeholder-slate-400 focus:outline-none focus:border-leaf-500/60 resize-none"
          />
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-slate-400">{t("sms.compose.charCount", { count: charCount })}</p>
            {charCount > 0 && (
              <p className="text-xs text-slate-400">
                ≈ {smsCount} SMS ({smsCount > 1 ? t("sms.compose.multipart") : t("sms.compose.single")})
              </p>
            )}
          </div>
        </div>

        {/* Recipient selector */}
        <div>
          <p className="text-xs font-medium text-slate-500 mb-2">{t("sms.recipient.label")}</p>
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
              {t("sms.recipient.all")}
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
              {t("sms.recipient.segment")}
            </button>
          </div>

          {targetType === "segment" && (
            <select
              value={segmentId}
              onChange={(e) => setSegmentId(e.target.value)}
              className={cls}
            >
              <option value="">{t("sms.recipient.selectSegment")}</option>
              {segments?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({t("sms.recipient.customerCount", { count: s.cachedCount })})
                </option>
              ))}
            </select>
          )}

          {estimatedCount !== null && estimatedCount > 0 && (
            <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              {t("sms.recipient.estimate", { count: estimatedCount })}
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
            {sending ? t("sms.sending") : t("sms.send")}
          </button>
        </div>
      </div>

      {/* Test SMS */}
      <div className="bg-white border border-cream-300/80 rounded-2xl p-5 space-y-3">
        <h2 className="font-semibold text-forest-800">{t("sms.test.title")}</h2>
        <p className="text-xs text-slate-500">
          {t("sms.test.hint")}
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
            {t("sms.test.btn")}
          </button>
        </div>
      </div>
    </div>
  );
}
