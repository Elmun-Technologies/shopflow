// 1C integratsiyasi — CommerceML 2 «Обмен с сайтом».
//
// MoySklad/Sales Doctor'dan farqli o'laroq bu yerda BIZ 1C'ga ulanmaymiz:
// 1C on-prem va NAT ortida turadi, shuning uchun u o'zi bizga murojaat qiladi.
// Kartochkaning asosiy vazifasi — buxgalterga 1C'ga kiritish uchun kerak
// bo'lgan uchta narsani berish: almashinuv URL'i, login va parol.

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle, Boxes, Check, CheckCircle2, ChevronDown, Copy, Eye,
  KeyRound, Loader2, RefreshCw,
} from "lucide-react";
import { onecApi, type OneCImportLog, type OneCSettings, type OneCStatus } from "../api/endpoints";
import { useAppToast } from "./ui/Toast";
import { useConfirm } from "./ui/ConfirmDialog";
import { getLang, useT } from "../i18n";

const STATUS_BADGE_CLS: Record<OneCStatus["status"], string> = {
  CONNECTED: "bg-leaf-100 text-forest-700",
  ERROR: "bg-red-100 text-red-600",
  DISCONNECTED: "bg-cream-200 text-slate-700",
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(getLang() === "ru" ? "ru-RU" : "uz-UZ", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

/** Nusxalash tugmasi bo'lgan faqat-o'qish maydon (URL / login / parol uchun). */
function CopyField({
  label,
  value,
  mono = true,
  masked = false,
  onReveal,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
  masked?: boolean;
  onReveal?: () => void;
}) {
  const { t } = useT();
  const toast = useAppToast();
  const [copied, setCopied] = useState(false);

  const copy = () => {
    if (!value) return;
    navigator.clipboard?.writeText(value).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => toast.error(t("onec.copyFailed")),
    );
  };

  return (
    <div>
      <div className="text-[11px] text-slate-500 mb-1">{label}</div>
      <div className="flex items-center gap-1.5">
        <div
          className={`flex-1 min-w-0 bg-white border border-cream-300 rounded-lg px-2.5 py-1.5 text-xs text-forest-800 truncate ${
            mono ? "font-mono" : ""
          }`}
        >
          {masked ? "••••••••••••" : (value ?? "—")}
        </div>
        {masked ? (
          <button
            onClick={onReveal}
            className="flex-shrink-0 p-1.5 rounded-lg bg-cream-200 text-slate-700 hover:bg-cream-300 transition-all"
            title={t("onec.reveal")}
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            onClick={copy}
            disabled={!value}
            className="flex-shrink-0 p-1.5 rounded-lg bg-cream-200 text-slate-700 hover:bg-cream-300 transition-all disabled:opacity-40"
            title={t("onec.copy")}
          >
            {copied ? <Check className="w-3.5 h-3.5 text-forest-700" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
}

function LogRow({ log }: { log: OneCImportLog }) {
  const { t } = useT();
  const s = log;
  return (
    <div className="border-b border-cream-300/70 last:border-0 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-mono text-forest-700 truncate">{s.filename}</span>
        <span className="text-[10px] text-slate-400 flex-shrink-0">{formatDate(s.createdAt)}</span>
      </div>
      {s.ok ? (
        <div className="text-[11px] text-slate-500 mt-0.5">
          {t("onec.logSummary", {
            products: s.productsCreated + s.productsUpdated,
            created: s.productsCreated,
            categories: s.categoriesCreated + s.categoriesUpdated,
            images: s.imagesImported,
          })}
          {(s.variantsCreated ?? 0) + (s.variantsUpdated ?? 0) > 0 &&
            ` · ${t("onec.logVariants", { count: (s.variantsCreated ?? 0) + (s.variantsUpdated ?? 0) })}`}
          {s.productsHidden > 0 && ` · ${t("onec.logHidden", { count: s.productsHidden })}`}
        </div>
      ) : (
        <div className="text-[11px] text-red-600 mt-0.5">{s.message ?? t("common.error")}</div>
      )}
      {s.ok && s.message && (
        <div className="text-[11px] text-amber-600 mt-0.5 line-clamp-2">{s.message}</div>
      )}
    </div>
  );
}

export function OneCIntegrationCard() {
  const { t } = useT();
  const toast = useAppToast();
  const confirmDialog = useConfirm();

  const [status, setStatus] = useState<OneCStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState<string | null>(null);
  const [logs, setLogs] = useState<OneCImportLog[] | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [settings, setSettings] = useState<OneCSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const s = await onecApi.status();
      setStatus(s);
      setSettings(s.settings ?? null);
    } catch {
      // sokin — kartochka bo'sh status bilan qoladi
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleConnect = async () => {
    setBusy(true);
    try {
      const res = await onecApi.connect();
      setPassword(res.password);
      await refresh();
      toast.success(t("onec.connected"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("onec.connectFailed"));
    } finally {
      setBusy(false);
    }
  };

  const handleRotate = async () => {
    const ok = await confirmDialog({
      title: t("onec.rotateConfirmTitle"),
      description: t("onec.rotateConfirmDesc"),
      confirmText: t("onec.rotate"),
      cancelText: t("common.cancel"),
      kind: "danger",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await onecApi.connect({ login: status?.login });
      setPassword(res.password);
      await refresh();
      toast.success(t("onec.rotated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  const handleReveal = async () => {
    try {
      const res = await onecApi.credentials();
      setPassword(res.password);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    }
  };

  const handleDisconnect = async () => {
    const ok = await confirmDialog({
      title: t("onec.disconnectConfirmTitle"),
      description: t("onec.disconnectConfirmDesc"),
      confirmText: t("onec.disconnect"),
      cancelText: t("common.cancel"),
      kind: "danger",
    });
    if (!ok) return;
    try {
      await onecApi.disconnect();
      setPassword(null);
      setLogs(null);
      await refresh();
      toast.success(t("onec.disconnected"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    }
  };

  const toggleSetting = async (key: keyof OneCSettings) => {
    if (!settings) return;
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    setSavingSettings(true);
    try {
      await onecApi.saveSettings(next);
    } catch (err) {
      setSettings(settings); // orqaga qaytaramiz
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSavingSettings(false);
    }
  };

  const handleToggleLogs = async () => {
    const next = !showLogs;
    setShowLogs(next);
    if (next && !logs) {
      try {
        const res = await onecApi.logs();
        setLogs(res.logs);
      } catch {
        setLogs([]);
      }
    }
  };

  if (loading) {
    return (
      <div className="bg-cream-100/50 border border-cream-300 rounded-xl p-5 flex items-center justify-center min-h-[120px]">
        <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
      </div>
    );
  }

  const s = status?.status ?? "DISCONNECTED";
  const connected = s === "CONNECTED" || s === "ERROR";

  return (
    <div className="bg-cream-100/50 border border-cream-300 rounded-xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-amber-400/20">
            <Boxes className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h4 className="text-sm text-forest-800 font-semibold flex items-center gap-2">
              {t("onec.title")}
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE_CLS[s]}`}>
                {t(`onec.status.${s}`)}
              </span>
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">{t("onec.subtitle")}</p>
          </div>
        </div>
      </div>

      {status?.lastError && (
        <div className="mb-3 flex items-start gap-2 text-xs text-red-600 bg-red-100 border border-red-200 rounded-lg p-2.5">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span className="min-w-0 break-words">{status.lastError}</span>
        </div>
      )}

      {/* Narx/qoldiq sinxroni hali yo'q — operator buni bilishi shart */}
      {connected && (
        <div className="mb-3 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{t("onec.priceNotice")}</span>
        </div>
      )}

      {!connected ? (
        <>
          <p className="text-xs text-slate-500 mb-3">{t("onec.intro")}</p>
          <button
            onClick={handleConnect}
            disabled={busy}
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-leaf-100 text-forest-700 hover:bg-leaf-500/25 transition-all disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
            {t("onec.connect")}
          </button>
        </>
      ) : (
        <>
          {/* 1C'ga kiritiladigan uchlik */}
          <div className="space-y-2.5 mb-4">
            <CopyField label={t("onec.exchangeUrl")} value={status?.exchangeUrl ?? null} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <CopyField label={t("onec.login")} value={status?.login ?? null} />
              <CopyField
                label={t("onec.password")}
                value={password}
                masked={password === null}
                onReveal={handleReveal}
              />
            </div>
          </div>

          {password && (
            <div className="mb-3 text-xs text-forest-700 bg-leaf-100 border border-leaf-300/60 rounded-lg p-2.5 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{t("onec.passwordNotice")}</span>
            </div>
          )}

          {/* Statistika */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-[11px]">
            <div className="bg-white/70 rounded-lg p-2">
              <div className="text-slate-500">{t("onec.importedProducts")}</div>
              <div className="text-forest-700 mt-0.5 font-semibold">{status?.importedProducts ?? 0}</div>
            </div>
            <div className="bg-white/70 rounded-lg p-2">
              <div className="text-slate-500">{t("onec.importedCategories")}</div>
              <div className="text-forest-700 mt-0.5 font-semibold">{status?.importedCategories ?? 0}</div>
            </div>
            <div className="bg-white/70 rounded-lg p-2">
              <div className="text-slate-500">{t("onec.lastExchange")}</div>
              <div className="text-forest-700 mt-0.5">{formatDate(status?.lastExchangeAt)}</div>
            </div>
            <div className="bg-white/70 rounded-lg p-2">
              <div className="text-slate-500">{t("onec.lastImport")}</div>
              <div className="text-forest-700 mt-0.5">{formatDate(status?.lastImportAt)}</div>
            </div>
          </div>

          {/* Import sozlamalari */}
          {settings && (
            <div className="mb-3 space-y-1.5">
              {(
                [
                  ["createInactive", t("onec.setting.createInactive")],
                  ["importImages", t("onec.setting.importImages")],
                  ["overwriteNames", t("onec.setting.overwriteNames")],
                ] as Array<[keyof OneCSettings, string]>
              ).map(([key, label]) => (
                <label key={key} className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings[key]}
                    disabled={savingSettings}
                    onChange={() => toggleSetting(key)}
                    className="mt-0.5 accent-leaf-500"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          )}

          {/* Importlar tarixi */}
          <button
            onClick={handleToggleLogs}
            className="w-full flex items-center justify-between text-xs text-slate-500 hover:text-forest-800 py-1.5 transition-all"
          >
            <span>{t("onec.history")}</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showLogs ? "rotate-180" : ""}`} />
          </button>
          {showLogs && (
            <div className="mb-3 bg-white/70 rounded-lg px-3 py-1 max-h-56 overflow-y-auto">
              {logs === null ? (
                <div className="py-3 text-center text-slate-400 text-xs">{t("common.loading")}</div>
              ) : logs.length === 0 ? (
                <div className="py-3 text-center text-slate-400 text-xs">{t("onec.noHistory")}</div>
              ) : (
                logs.map((log) => <LogRow key={log.id} log={log} />)
              )}
            </div>
          )}

          {/* 1C tomonidagi sozlash yo'riqnomasi */}
          <button
            onClick={() => setShowGuide((v) => !v)}
            className="w-full flex items-center justify-between text-xs text-slate-500 hover:text-forest-800 py-1.5 transition-all"
          >
            <span>{t("onec.guide")}</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showGuide ? "rotate-180" : ""}`} />
          </button>
          {showGuide && (
            <ol className="mb-3 text-[11px] text-slate-500 space-y-1 list-decimal list-inside bg-white/70 rounded-lg p-3">
              <li>{t("onec.guide1")}</li>
              <li>{t("onec.guide2")}</li>
              <li>{t("onec.guide3")}</li>
              <li>{t("onec.guide4")}</li>
              <li>{t("onec.guide5")}</li>
            </ol>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={handleRotate}
              disabled={busy}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-cream-200 text-slate-700 hover:bg-cream-300 transition-all disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${busy ? "animate-spin" : ""}`} />
              {t("onec.rotate")}
            </button>
            <button
              onClick={handleDisconnect}
              className="text-xs font-medium px-3 py-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-100 transition-all ml-auto"
            >
              {t("onec.disconnect")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
