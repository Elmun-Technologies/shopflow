// Sales Doctor CRM integratsiya kartochkasi.
// Settings → Integratsiyalar → CRM bo'limida ko'rinadi.
// MoyskladIntegrationCard naqshiga o'xshash.

import { useCallback, useEffect, useState } from "react";
import {
  Briefcase, AlertTriangle, RefreshCw, Loader2, X,
  Download, Upload, Settings as SettingsIcon, AlertCircle,
} from "lucide-react";
import { salesDoctorApi, type SalesDoctorStatus, type SalesDoctorReference } from "../api/endpoints";
import { useAppToast } from "./ui/Toast";
import { useConfirm } from "./ui/ConfirmDialog";
import { useT } from "../i18n";

const STATUS_BADGE_CLS: Record<SalesDoctorStatus["status"], string> = {
  CONNECTED: "bg-leaf-100 text-forest-700",
  CONNECTING: "bg-blue-400/15 text-sky-700",
  ERROR: "bg-rose-400/15 text-rose-600",
  DISCONNECTED: "bg-cream-200 text-slate-700",
};

const STATUS_LABEL_KEYS: Record<SalesDoctorStatus["status"], string> = {
  CONNECTED: "salesdoctor.status.CONNECTED",
  CONNECTING: "salesdoctor.status.CONNECTING",
  ERROR: "salesdoctor.status.ERROR",
  DISCONNECTED: "salesdoctor.status.DISCONNECTED",
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("uz-UZ", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function SalesDoctorIntegrationCard() {
  const { t } = useT();
  const toast = useAppToast();
  const confirmDialog = useConfirm();
  const [status, setStatus] = useState<SalesDoctorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConnect, setShowConnect] = useState(false);
  const [showDefaults, setShowDefaults] = useState(false);
  const [busy, setBusy] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      const s = await salesDoctorApi.status();
      setStatus(s);
    } catch (err) {
      console.error("SD status:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refreshStatus(); }, [refreshStatus]);

  const disconnect = async () => {
    const ok = await confirmDialog({
      title: t("salesdoctor.disconnectConfirmTitle"),
      description: t("salesdoctor.disconnectConfirmDesc"),
      kind: "danger",
      confirmText: t("salesdoctor.disconnect"),
    });
    if (!ok) return;
    setBusy(true);
    try {
      await salesDoctorApi.disconnect();
      toast.success(t("salesdoctor.toast.disconnected"));
      await refreshStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("salesdoctor.toast.disconnectFailed"));
    } finally {
      setBusy(false);
    }
  };

  const pullCatalog = async () => {
    setBusy(true);
    try {
      const res = await salesDoctorApi.pullCatalog();
      toast.success(
        t("salesdoctor.toast.pull", {
          customers: res.customers.linked + res.customers.created,
          products: res.products.linked + res.products.created,
        }),
      );
      await refreshStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("salesdoctor.toast.pullFailed"));
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    try {
      const r = await salesDoctorApi.test();
      toast.success(t("salesdoctor.toast.testOk", { count: r.agentCount }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("salesdoctor.toast.testFailed"));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-cream-300 rounded-2xl p-5 flex items-center gap-3">
        <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
        <span className="text-sm text-slate-500">{t("salesdoctor.loadingStatus")}</span>
      </div>
    );
  }

  const isConnected = status?.status === "CONNECTED";
  const needsDefaults = isConnected
    && (!status?.defaults?.agentSdId || !status.defaults.priceTypeSdId || !status.defaults.warehouseSdId);

  return (
    <div className="bg-white border border-cream-300 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 p-5">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#0066CC15" }}>
          <Briefcase className="w-6 h-6" style={{ color: "#0066CC" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-forest-800">Sales Doctor</h3>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE_CLS[status?.status ?? "DISCONNECTED"]}`}>
              {t(STATUS_LABEL_KEYS[status?.status ?? "DISCONNECTED"])}
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-cream-100 text-slate-500">🇺🇿 UZ</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {t("salesdoctor.subtitle")}
          </p>
          {isConnected && (
            <p className="text-[11px] text-slate-400 mt-1.5">
              {status?.domain} · {t("salesdoctor.lastSync")} {formatDate(status?.lastSyncAt)}
            </p>
          )}
        </div>
        {!isConnected ? (
          <button
            onClick={() => setShowConnect(true)}
            disabled={busy}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-leaf-400 hover:bg-leaf-500 text-forest-800 disabled:opacity-50"
          >
            {t("salesdoctor.connect")}
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              onClick={test}
              disabled={busy}
              className="p-2 rounded-lg text-slate-500 hover:text-forest-800 hover:bg-cream-100 disabled:opacity-50"
              title={t("salesdoctor.testConnection")}
            >
              <RefreshCw className={`w-4 h-4 ${busy ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => setShowDefaults(true)}
              className="p-2 rounded-lg text-slate-500 hover:text-forest-800 hover:bg-cream-100"
              title={t("salesdoctor.configure")}
            >
              <SettingsIcon className="w-4 h-4" />
            </button>
            <button
              onClick={disconnect}
              disabled={busy}
              className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-50"
              title={t("salesdoctor.disconnect")}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Body — connected holatda */}
      {isConnected && (
        <div className="border-t border-cream-300 px-5 py-3 bg-cream-50/50">
          {needsDefaults && (
            <div className="mb-3 flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-amber-800">{t("salesdoctor.setupIncomplete")}</p>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  {t("salesdoctor.setupIncompleteDesc")}
                </p>
              </div>
              <button
                onClick={() => setShowDefaults(true)}
                className="text-[11px] font-semibold text-amber-900 hover:underline"
              >
                {t("salesdoctor.configure")}
              </button>
            </div>
          )}

          {status?.lastError && (
            <div className="mb-3 flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-rose-700 flex-1">{status.lastError}</p>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            <Stat label={t("salesdoctor.stat.pending")} value={status?.pendingRetries ?? 0} color="text-amber-600" />
            <Stat label={t("salesdoctor.stat.errors")} value={status?.failedRetries ?? 0} color="text-rose-600" />
            <Stat label={t("salesdoctor.stat.agent")} value={status?.defaults?.agentSdId ? "✓" : "—"} color="text-slate-700" />
            <Stat label={t("salesdoctor.stat.warehouse")} value={status?.defaults?.warehouseSdId ? "✓" : "—"} color="text-slate-700" />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={pullCatalog}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-cream-300 hover:bg-cream-100 text-forest-800 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              {t("salesdoctor.pullFromSd")}
            </button>
            <button
              disabled
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-cream-300 text-slate-400 cursor-not-allowed"
              title={t("salesdoctor.comingSoon")}
            >
              <Upload className="w-3.5 h-3.5" />
              {t("salesdoctor.pushFromShopflow")}
            </button>
          </div>
        </div>
      )}

      {showConnect && (
        <ConnectModal
          onClose={() => setShowConnect(false)}
          onConnected={async () => {
            setShowConnect(false);
            await refreshStatus();
            setShowDefaults(true);
          }}
        />
      )}

      {showDefaults && (
        <DefaultsModal
          onClose={() => setShowDefaults(false)}
          onSaved={async () => {
            setShowDefaults(false);
            await refreshStatus();
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-lg bg-white border border-cream-300 px-2 py-1.5 text-center">
      <p className="text-[9px] text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function ConnectModal({
  onClose,
  onConnected,
}: {
  onClose: () => void;
  onConnected: () => void;
}) {
  const { t } = useT();
  const toast = useAppToast();
  const [domain, setDomain] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await salesDoctorApi.connect({
        domain: domain.trim().replace(/^https?:\/\//, "").replace(/\/+$/, ""),
        login: login.trim(),
        password,
      });
      toast.success(t("salesdoctor.toast.connected"));
      onConnected();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("salesdoctor.toast.connectFailed");
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-cream-300 rounded-2xl p-5 max-w-md w-full"
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold text-forest-800">{t("salesdoctor.connectModalTitle")}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{t("salesdoctor.connectModalDesc")}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-cream-100">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {error && (
          <div className="mb-3 p-3 rounded-xl bg-rose-50 border border-rose-200">
            <p className="text-xs text-rose-700">{error}</p>
          </div>
        )}

        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-slate-500 mb-1 block">{t("salesdoctor.domain")}</span>
            <input
              required
              autoFocus
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="mijoz.salesdoctor.uz"
              className="w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2.5 text-sm text-forest-800 focus:outline-none focus:border-leaf-500/60"
            />
            <p className="text-[10px] text-slate-400 mt-1">{t("salesdoctor.domainHelper")}</p>
          </label>
          <label className="block">
            <span className="text-xs text-slate-500 mb-1 block">{t("salesdoctor.login")}</span>
            <input
              required
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className="w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2.5 text-sm text-forest-800 focus:outline-none focus:border-leaf-500/60"
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate-500 mb-1 block">{t("salesdoctor.password")}</span>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2.5 text-sm text-forest-800 focus:outline-none focus:border-leaf-500/60"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              {t("salesdoctor.passwordHelper")}
            </p>
          </label>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-lg text-sm bg-cream-100 hover:bg-cream-200 text-slate-700"
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm bg-leaf-400 hover:bg-leaf-500 disabled:opacity-50 text-forest-800 font-medium"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {t("salesdoctor.connect")}
          </button>
        </div>
      </form>
    </div>
  );
}

function DefaultsModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useT();
  const toast = useAppToast();
  const [refs, setRefs] = useState<{
    agents: SalesDoctorReference[];
    priceTypes: SalesDoctorReference[];
    warehouses: SalesDoctorReference[];
  } | null>(null);
  const [agentId, setAgentId] = useState("");
  const [priceTypeId, setPriceTypeId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [r, s] = await Promise.all([salesDoctorApi.references(), salesDoctorApi.status()]);
        setRefs(r);
        if (s.defaults?.agentSdId) setAgentId(s.defaults.agentSdId);
        if (s.defaults?.priceTypeSdId) setPriceTypeId(s.defaults.priceTypeSdId);
        if (s.defaults?.warehouseSdId) setWarehouseId(s.defaults.warehouseSdId);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("salesdoctor.toast.refsFailed"));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentId || !priceTypeId || !warehouseId) {
      toast.error(t("salesdoctor.allFieldsRequired"));
      return;
    }
    setBusy(true);
    try {
      await salesDoctorApi.saveDefaults({
        defaultAgentSdId: agentId,
        defaultPriceTypeSdId: priceTypeId,
        defaultWarehouseSdId: warehouseId,
      });
      toast.success(t("salesdoctor.toast.saved"));
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("salesdoctor.toast.notSaved"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-cream-300 rounded-2xl p-5 max-w-md w-full"
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold text-forest-800">{t("salesdoctor.defaultsTitle")}</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {t("salesdoctor.defaultsDesc")}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-cream-100">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {loading ? (
          <div className="py-8 flex items-center justify-center text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t("common.loading")}
          </div>
        ) : refs ? (
          <div className="space-y-3">
            <SelectField
              label={t("salesdoctor.agent")}
              value={agentId}
              onChange={setAgentId}
              options={refs.agents}
              placeholder={t("salesdoctor.agentPlaceholder")}
              emptyText={t("salesdoctor.noRecordsOfType")}
            />
            <SelectField
              label={t("salesdoctor.priceType")}
              value={priceTypeId}
              onChange={setPriceTypeId}
              options={refs.priceTypes}
              placeholder={t("salesdoctor.priceTypePlaceholder")}
              emptyText={t("salesdoctor.noRecordsOfType")}
            />
            <SelectField
              label={t("salesdoctor.warehouse")}
              value={warehouseId}
              onChange={setWarehouseId}
              options={refs.warehouses}
              placeholder={t("salesdoctor.warehousePlaceholder")}
              emptyText={t("salesdoctor.noRecordsOfType")}
            />
          </div>
        ) : (
          <p className="text-sm text-rose-600">{t("salesdoctor.refsNotLoaded")}</p>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-lg text-sm bg-cream-100 hover:bg-cream-200 text-slate-700"
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            disabled={busy || loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm bg-leaf-400 hover:bg-leaf-500 disabled:opacity-50 text-forest-800 font-medium"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {t("common.save")}
          </button>
        </div>
      </form>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  emptyText,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: SalesDoctorReference[];
  placeholder: string;
  emptyText: string;
}) {
  return (
    <label className="block">
      <span className="text-xs text-slate-500 mb-1 block">{label}</span>
      <select
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2.5 text-sm text-forest-800 focus:outline-none focus:border-leaf-500/60"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
      {options.length === 0 && <p className="text-[10px] text-rose-500 mt-1">{emptyText}</p>}
    </label>
  );
}
