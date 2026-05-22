import { useCallback, useEffect, useState } from "react";
import { Boxes, CheckCircle2, AlertTriangle, RefreshCw, Loader2, ExternalLink, X } from "lucide-react";
import { moyskladApi, type MoyskladStatus, type SyncJob } from "../api/endpoints";
import { useAppToast } from "./ui/Toast";
import { useConfirm } from "./ui/ConfirmDialog";
import { useT } from "../i18n";

const STATUS_BADGE_CLS: Record<MoyskladStatus["status"], string> = {
  CONNECTED: "bg-emerald-400/15 text-emerald-300",
  CONNECTING: "bg-blue-400/15 text-blue-300",
  ERROR: "bg-rose-400/15 text-rose-300",
  DISCONNECTED: "bg-slate-700 text-slate-300",
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
    } catch (err) {
      console.error("MoySklad status:", err);
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
      } catch (err) {
        console.error("Sync job poll:", err);
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
      <div className="bg-slate-800/50 border border-slate-800 rounded-xl p-5 flex items-center justify-center min-h-[120px]">
        <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
      </div>
    );
  }

  const s = status?.status ?? "DISCONNECTED";
  const badgeCls = STATUS_BADGE_CLS[s];

  return (
    <div className="bg-slate-800/50 border border-slate-800 rounded-xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-orange-400/15">
            <Boxes className="w-5 h-5 text-orange-300" />
          </div>
          <div>
            <h4 className="text-sm text-white font-semibold flex items-center gap-2">
              MoySklad
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badgeCls}`}>{t(`moysklad.status.${s}`)}</span>
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Mahsulot katalogi, qoldiq va buyurtmalar yagona manbadan
            </p>
            {status?.accountName && (
              <p className="text-[11px] text-slate-400 mt-1">
                Hisob: <span className="text-slate-200">{status.accountName}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {status?.lastError && (
        <div className="mb-3 flex items-start gap-2 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg p-2.5">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{status.lastError}</span>
        </div>
      )}

      {s === "CONNECTED" && (
        <div className="grid grid-cols-2 gap-2 mb-3 text-[11px]">
          <div className="bg-slate-900/40 rounded-lg p-2">
            <div className="text-slate-500">Ulangan</div>
            <div className="text-slate-200 mt-0.5">{formatDate(status?.connectedAt)}</div>
          </div>
          <div className="bg-slate-900/40 rounded-lg p-2">
            <div className="text-slate-500">Oxirgi sync</div>
            <div className="text-slate-200 mt-0.5">{formatDate(status?.lastSyncAt)}</div>
          </div>
        </div>
      )}

      {activeJob && activeJob.status !== "COMPLETED" && activeJob.status !== "FAILED" && (
        <div className="mb-3 bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-blue-300 flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Sinxronlash...
            </span>
            <span className="text-blue-200">{activeJob.progress}%</span>
          </div>
          <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-400 transition-all"
              style={{ width: `${activeJob.progress}%` }}
            />
          </div>
        </div>
      )}

      {activeJob?.status === "COMPLETED" && (
        <div className="mb-3 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2.5 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          Sinxronizatsiya tugadi
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {s === "DISCONNECTED" || s === "ERROR" ? (
          <button
            onClick={() => setShowConnect(true)}
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-400/15 text-emerald-300 hover:bg-emerald-400/25 transition-all"
          >
            Ulash
          </button>
        ) : (
          <>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-400/15 text-blue-300 hover:bg-blue-400/25 transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
              To'liq sinxronlash
            </button>
            <button
              onClick={handleSubscribeWebhooks}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-all"
            >
              Webhook'larni ulash ({status?.webhookCount ?? 0})
            </button>
            <button
              onClick={handleDisconnect}
              className="text-xs font-medium px-3 py-1.5 rounded-lg text-slate-500 hover:text-rose-300 hover:bg-rose-500/10 transition-all ml-auto"
            >
              Uzish
            </button>
          </>
        )}
      </div>

      {showConnect && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-white">MoySklad'ga ulash</h3>
                <p className="text-xs text-slate-500 mt-1">Access token kiriting</p>
              </div>
              <button
                onClick={() => {
                  setShowConnect(false);
                  setConnectError(null);
                }}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-400 mb-3 space-y-1">
              <div>1. MoySklad → Sozlamalar → Foydalanuvchilar → o'zingiz</div>
              <div>2. Pastda "Access token" → "Yangi token yaratish"</div>
              <div>3. Token'ni nusxalab, pastga joylang</div>
            </div>

            <a
              href="https://online.moysklad.ru/app/#admin"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 mb-3"
            >
              MoySklad sozlamalari
              <ExternalLink className="w-3 h-3" />
            </a>

            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="MoySklad access token"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-600 mb-3"
            />

            {connectError && (
              <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg p-2.5 mb-3">
                {connectError}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowConnect(false);
                  setConnectError(null);
                }}
                className="flex-1 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
              >
                Bekor qilish
              </button>
              <button
                onClick={handleConnect}
                disabled={connecting || token.trim().length < 20}
                className="flex-1 px-3 py-2 text-sm font-medium bg-emerald-500 hover:bg-emerald-400 text-slate-900 rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {connecting && <Loader2 className="w-4 h-4 animate-spin" />}
                Ulash
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
