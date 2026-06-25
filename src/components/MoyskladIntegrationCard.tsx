import { useCallback, useEffect, useState } from "react";
import { Boxes, CheckCircle2, AlertTriangle, RefreshCw, Loader2, ExternalLink, X } from "lucide-react";
import { moyskladApi, type MoyskladStatus, type SyncJob } from "../api/endpoints";
import { useAppToast } from "./ui/Toast";
import { useConfirm } from "./ui/ConfirmDialog";
import { useT } from "../i18n";

const STATUS_BADGE_CLS: Record<MoyskladStatus["status"], string> = {
  CONNECTED: "bg-leaf-100 text-forest-700",
  CONNECTING: "bg-blue-100 text-blue-600",
  ERROR: "bg-red-100 text-red-600",
  DISCONNECTED: "bg-cream-200 text-slate-700",
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("uz-UZ", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function MoyskladIntegrationCard() {
  const { t } = useT();
  const [status, setStatus] = useState<MoyskladStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConnect, setShowConnect] = useState(false);
  const [token, setToken] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const [activeJob, setActiveJob] = useState<SyncJob | null>(null);
  const [syncing, setSyncing] = useState(false);
  const toast = useAppToast();
  const confirmDialog = useConfirm();

  const refreshStatus = useCallback(async () => {
    try {
      const s = await moyskladApi.status();
      setStatus(s);
    } catch {
      // sokin — kartochka bo'sh status bilan qoladi
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // Active job polling
  useEffect(() => {
    if (!activeJob || activeJob.status === "COMPLETED" || activeJob.status === "FAILED") return;
    const t = setInterval(async () => {
      try {
        const job = await moyskladApi.getJob(activeJob.id);
        setActiveJob(job);
        if (job.status === "COMPLETED" || job.status === "FAILED") {
          setSyncing(false);
          refreshStatus();
        }
      } catch {
        // poll xatosi — sokin, keyingi interval'da qayta urinamiz
      }
    }, 2000);
    return () => clearInterval(t);
  }, [activeJob, refreshStatus]);

  const handleConnect = async () => {
    setConnectError(null);
    setConnecting(true);
    try {
      const res = await moyskladApi.connect(token.trim());
      setShowConnect(false);
      setToken("");
      await refreshStatus();
      toast.success(`MoySklad ulandi: ${res.accountName ?? "hisob"}`);
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : "Ulanish muvaffaqiyatsiz");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    const ok = await confirmDialog({
      title: "MoySklad ulanishini uzasizmi?",
      description: "Sinxronlangan ma'lumotlar saqlanib qoladi, faqat token o'chiriladi.",
      confirmText: "Uzish",
      cancelText: "Bekor",
      kind: "danger",
    });
    if (!ok) return;
    try {
      await moyskladApi.disconnect();
      await refreshStatus();
      toast.success("MoySklad ulanishi uzildi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Uzilishda xato");
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { jobId } = await moyskladApi.startSync();
      const job = await moyskladApi.getJob(jobId);
      setActiveJob(job);
      toast.info("Sinxronizatsiya boshlandi");
    } catch (err) {
      setSyncing(false);
      toast.error(err instanceof Error ? err.message : "Sinxronizatsiyani boshlashda xato");
    }
  };

  const handleSubscribeWebhooks = async () => {
    try {
      const res = await moyskladApi.subscribeWebhooks();
      if (res.errors.length) {
        toast.error(`${res.registered} ta webhook ro'yxatdan o'tdi, ${res.errors.length} ta xato`);
      } else {
        toast.success(`${res.registered} ta webhook ro'yxatdan o'tkazildi`);
      }
      refreshStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Webhook'larni ro'yxatdan o'tkazishda xato");
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
  const badgeCls = STATUS_BADGE_CLS[s];

  return (
    <div className="bg-cream-100/50 border border-cream-300 rounded-xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-orange-400/15">
            <Boxes className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h4 className="text-sm text-forest-800 font-semibold flex items-center gap-2">
              MoySklad
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badgeCls}`}>{t(`moysklad.status.${s}`)}</span>
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {t("moysklad.subtitle")}
            </p>
            {status?.accountName && (
              <p className="text-[11px] text-slate-500 mt-1">
                {t("moysklad.account")}: <span className="text-forest-700">{status.accountName}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {status?.lastError && (
        <div className="mb-3 flex items-start gap-2 text-xs text-red-600 bg-red-100 border border-red-200 rounded-lg p-2.5">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{status.lastError}</span>
        </div>
      )}

      {s === "CONNECTED" && (
        <div className="grid grid-cols-2 gap-2 mb-3 text-[11px]">
          <div className="bg-cream-100/40 rounded-lg p-2">
            <div className="text-slate-500">{t("moysklad.connectedAt")}</div>
            <div className="text-forest-700 mt-0.5">{formatDate(status?.connectedAt)}</div>
          </div>
          <div className="bg-cream-100/40 rounded-lg p-2">
            <div className="text-slate-500">{t("moysklad.lastSync")}</div>
            <div className="text-forest-700 mt-0.5">{formatDate(status?.lastSyncAt)}</div>
          </div>
        </div>
      )}

      {activeJob && activeJob.status !== "COMPLETED" && activeJob.status !== "FAILED" && (
        <div className="mb-3 bg-blue-100 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-blue-600 flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {t("moysklad.syncing")}
            </span>
            <span className="text-blue-600">{activeJob.progress}%</span>
          </div>
          <div className="h-1.5 bg-white rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${activeJob.progress}%` }}
            />
          </div>
        </div>
      )}

      {activeJob?.status === "COMPLETED" && (
        <div className="mb-3 text-xs text-forest-700 bg-leaf-100 border border-leaf-300/60 rounded-lg p-2.5 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {t("moysklad.syncDone")}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {s === "DISCONNECTED" || s === "ERROR" ? (
          <button
            onClick={() => setShowConnect(true)}
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-leaf-100 text-forest-700 hover:bg-leaf-500/25 transition-all"
          >
            {t("moysklad.connect")}
          </button>
        ) : (
          <>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
              {t("moysklad.fullSync")}
            </button>
            <button
              onClick={handleSubscribeWebhooks}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-cream-200 text-slate-700 hover:bg-cream-300 transition-all"
            >
              {t("moysklad.subscribeWebhooks")} ({status?.webhookCount ?? 0})
            </button>
            <button
              onClick={handleDisconnect}
              className="text-xs font-medium px-3 py-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-100 transition-all ml-auto"
            >
              {t("moysklad.disconnect")}
            </button>
          </>
        )}
      </div>

      {showConnect && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-cream-300 rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-forest-800">{t("moysklad.connectTitle")}</h3>
                <p className="text-xs text-slate-500 mt-1">{t("moysklad.enterToken")}</p>
              </div>
              <button
                onClick={() => {
                  setShowConnect(false);
                  setConnectError(null);
                }}
                className="p-1.5 hover:bg-cream-100 rounded-lg text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-500 mb-3 space-y-1">
              <div>{t("moysklad.step1")}</div>
              <div>{t("moysklad.step2")}</div>
              <div>{t("moysklad.step3")}</div>
            </div>

            <a
              href="https://online.moysklad.ru/app/#admin"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 mb-3"
            >
              {t("moysklad.settingsLink")}
              <ExternalLink className="w-3 h-3" />
            </a>

            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={t("moysklad.tokenPlaceholder")}
              className="w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2 text-sm text-forest-800 placeholder-slate-400 focus:outline-none focus:border-leaf-400 mb-3"
            />

            {connectError && (
              <div className="text-xs text-red-600 bg-red-100 border border-red-200 rounded-lg p-2.5 mb-3">
                {connectError}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowConnect(false);
                  setConnectError(null);
                }}
                className="flex-1 px-3 py-2 text-sm text-slate-500 hover:text-forest-900 hover:bg-cream-100 rounded-lg transition-all"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleConnect}
                disabled={connecting || token.trim().length < 20}
                className="flex-1 px-3 py-2 text-sm font-medium bg-leaf-400 hover:bg-leaf-500 text-forest-800 rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {connecting && <Loader2 className="w-4 h-4 animate-spin" />}
                {t("moysklad.connect")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
