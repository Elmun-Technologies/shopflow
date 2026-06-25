// Email hisobotlar — admin SMTP holatini ko'radi, frekansni tanlaydi,
// hozir yuborib ko'radi. Backend SMTP yo'q bo'lsa diqqat xabari.

import { useEffect, useState } from "react";
import { Mail, Loader2, Send, CheckCircle2, AlertCircle } from "lucide-react";
import { api } from "../api/client";
import { useAppToast } from "./ui/Toast";
import { useT } from "../i18n";

type Frequency = "daily" | "weekly" | "monthly" | null;

interface NotifSettings {
  emailNotificationsEnabled: boolean;
  emailRecipients: string[];
  reportFrequency: Frequency;
  lastReportSentAt: string | null;
}

const FREQ_KEY: Record<Exclude<Frequency, null>, string> = {
  daily: "emailReports.freq.daily",
  weekly: "emailReports.freq.weekly",
  monthly: "emailReports.freq.monthly",
};

export function EmailReportsSection() {
  const { t } = useT();
  const toast = useAppToast();
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [settings, setSettings] = useState<NotifSettings | null>(null);
  const [recipientsDraft, setRecipientsDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [status, notif] = await Promise.all([
        api<{ configured: boolean }>("/reports/status"),
        api<NotifSettings>("/settings/notifications"),
      ]);
      setSmtpConfigured(status.configured);
      setSettings(notif);
      setRecipientsDraft((notif.emailRecipients ?? []).join(", "));
    } catch {
      /* sokin */
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const save = async (patch: Partial<NotifSettings>) => {
    setBusy(true);
    try {
      const recipients = recipientsDraft
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter((s) => s.includes("@"));
      const updated = await api<NotifSettings>("/settings/notifications", {
        method: "PATCH",
        body: { ...patch, emailRecipients: recipients },
      });
      setSettings(updated);
      toast.success(t("emailReports.toast.saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("emailReports.toast.error"));
    } finally {
      setBusy(false);
    }
  };

  const sendNow = async () => {
    setBusy(true);
    try {
      const res = await api<{ ok: boolean; sent: number }>("/reports/send-now", {
        method: "POST",
        body: { frequency: settings?.reportFrequency ?? "daily" },
      });
      if (res.ok) toast.success(t("emailReports.toast.sent", { count: res.sent }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("emailReports.toast.notSent"));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    try {
      const res = await api<{ ok: boolean; reason?: string }>("/reports/verify", { method: "POST" });
      if (res.ok) toast.success(t("emailReports.toast.smtpOk"));
      else toast.error(t("emailReports.toast.smtpError", { reason: res.reason ?? t("emailReports.unknown") }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("emailReports.toast.error"));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-cream-300 p-5">
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" /> {t("common.loading")}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-cream-300 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-forest-800 mb-1 flex items-center gap-2">
            <Mail className="w-4 h-4 text-leaf-500" />
            {t("emailReports.title")}
          </h3>
          <p className="text-xs text-slate-500">
            {smtpConfigured ? (
              <span className="inline-flex items-center gap-1 text-forest-700">
                <CheckCircle2 className="w-3 h-3" /> {t("emailReports.smtpConfigured")}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-600">
                <AlertCircle className="w-3 h-3" /> {t("emailReports.smtpNotConfigured")}
              </span>
            )}
          </p>
        </div>
        {smtpConfigured && (
          <button
            type="button"
            onClick={verify}
            disabled={busy}
            className="text-xs text-slate-500 hover:text-forest-800 underline"
          >
            {t("emailReports.verifyConnection")}
          </button>
        )}
      </div>

      <div>
        <label className="text-xs text-slate-500 mb-1.5 block">{t("emailReports.recipients")}</label>
        <input
          type="text"
          value={recipientsDraft}
          onChange={(e) => setRecipientsDraft(e.target.value)}
          placeholder="admin@example.com, owner@example.com"
          className="w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2.5 text-sm text-forest-800 focus:outline-none focus:border-leaf-500/60"
        />
        <p className="text-[10px] text-slate-400 mt-1">{t("emailReports.maxEmails")}</p>
      </div>

      <div>
        <label className="text-xs text-slate-500 mb-1.5 block">{t("emailReports.autoReports")}</label>
        <div className="grid grid-cols-4 gap-2">
          {(["daily", "weekly", "monthly"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => save({ reportFrequency: f, emailNotificationsEnabled: true })}
              disabled={busy}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                settings?.reportFrequency === f && settings?.emailNotificationsEnabled
                  ? "bg-leaf-400 text-forest-800"
                  : "bg-cream-100 hover:bg-cream-200 text-slate-700"
              }`}
            >
              {t(FREQ_KEY[f])}
            </button>
          ))}
          <button
            type="button"
            onClick={() => save({ reportFrequency: null, emailNotificationsEnabled: false })}
            disabled={busy}
            className={`px-3 py-2 rounded-lg text-xs font-medium ${
              !settings?.emailNotificationsEnabled ? "bg-cream-200 text-slate-700" : "bg-cream-100 hover:bg-cream-200 text-slate-500"
            }`}
          >
            {t("emailReports.off")}
          </button>
        </div>
        {settings?.lastReportSentAt && (
          <p className="text-[10px] text-slate-400 mt-2">
            {t("emailReports.lastSent")} {new Date(settings.lastReportSentAt).toLocaleString("uz-UZ")}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => save({})}
          disabled={busy}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-cream-100 hover:bg-cream-200 rounded-lg text-sm font-medium text-slate-700"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          {t("emailReports.saveAddresses")}
        </button>
        <button
          onClick={sendNow}
          disabled={busy || !smtpConfigured}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-leaf-400 hover:bg-leaf-500 disabled:opacity-50 rounded-lg text-sm font-medium text-forest-800"
        >
          <Send className="w-4 h-4" />
          {t("emailReports.sendNow")}
        </button>
      </div>
    </div>
  );
}
