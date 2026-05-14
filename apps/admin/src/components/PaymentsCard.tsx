import { useEffect, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { CreditCard, CheckCircle2, AlertCircle, Save, Trash2, ShieldCheck } from "lucide-react";
import {
  usePaymentProviders,
  useSavePaymentProvider,
  useDisablePaymentProvider,
  type PaymentProviderStatus,
} from "../api/hooks";
import { LoadingSkeleton } from "./common/LoadingSkeleton";
import { ErrorRetry } from "./common/ErrorRetry";

export function PaymentsCard() {
  const providers = usePaymentProviders();

  if (providers.isLoading) {
    return (
      <Card>
        <LoadingSkeleton rows={4} />
      </Card>
    );
  }
  if (providers.isError) {
    return (
      <Card>
        <ErrorRetry error={providers.error} onRetry={() => providers.refetch()} />
      </Card>
    );
  }

  const click = providers.data?.find((p) => p.provider === "CLICK");
  const payme = providers.data?.find((p) => p.provider === "PAYME");

  return (
    <Card>
      <p className="text-sm text-slate-400 mb-5">
        Click va Payme ulanganidan keyin mijozlar Mini App'da va saytda mahsulot uchun
        bevosita to'lay oladi. Maxfiy kalitlar shifrlangan holda saqlanadi.
      </p>
      <div className="space-y-5">
        <ClickForm initial={click} />
        <PaymeForm initial={payme} />
      </div>
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-xl border border-slate-800 bg-slate-900/60 p-5"
    >
      <div className="flex items-center gap-2 text-white mb-4">
        <CreditCard className="h-5 w-5 text-slate-400" />
        <h2 className="text-lg font-semibold">To'lov tizimlari</h2>
      </div>
      {children}
    </motion.div>
  );
}

function ClickForm({ initial }: { initial: PaymentProviderStatus | undefined }) {
  const save = useSavePaymentProvider();
  const disable = useDisablePaymentProvider();

  const cfg = (initial?.publicConfig ?? {}) as { serviceId?: string; merchantId?: string; merchantUserId?: string };
  const [enabled, setEnabled] = useState(initial?.enabled ?? false);
  const [serviceId, setServiceId] = useState(cfg.serviceId ?? "");
  const [merchantId, setMerchantId] = useState(cfg.merchantId ?? "");
  const [merchantUserId, setMerchantUserId] = useState(cfg.merchantUserId ?? "");
  const [secret, setSecret] = useState("");

  useEffect(() => {
    const c = (initial?.publicConfig ?? {}) as { serviceId?: string; merchantId?: string; merchantUserId?: string };
    setEnabled(initial?.enabled ?? false);
    setServiceId(c.serviceId ?? "");
    setMerchantId(c.merchantId ?? "");
    setMerchantUserId(c.merchantUserId ?? "");
  }, [initial?.enabled, initial?.publicConfig]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await save.mutateAsync({
      provider: "CLICK",
      enabled,
      publicConfig: { serviceId, merchantId, merchantUserId },
      secret: secret || undefined,
    });
    setSecret("");
  };

  return (
    <form onSubmit={submit} className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold text-white">Click</span>
          {initial?.configured && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-800 bg-emerald-950/50 px-2 py-0.5 text-[11px] text-emerald-300">
              <CheckCircle2 className="h-3 w-3" />
              {enabled ? "Yoqilgan" : "Sozlangan"}
            </span>
          )}
        </div>
        <Toggle checked={enabled} onChange={setEnabled} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <Field label="Service ID">
          <input className="input" value={serviceId} onChange={(e) => setServiceId(e.target.value)} required />
        </Field>
        <Field label="Merchant ID">
          <input className="input" value={merchantId} onChange={(e) => setMerchantId(e.target.value)} required />
        </Field>
        <Field label="Merchant User ID (ixtiyoriy)">
          <input className="input" value={merchantUserId} onChange={(e) => setMerchantUserId(e.target.value)} />
        </Field>
      </div>

      <Field label="Secret key" hint={initial?.configured ? "Bo'sh qoldirsangiz oldingi qiymat saqlanadi" : "Click kabinetidan oling"}>
        <input
          className="input"
          type="password"
          autoComplete="off"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder={initial?.configured ? "••••••••" : ""}
          required={!initial?.configured}
          minLength={8}
        />
      </Field>

      <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
        <ShieldCheck className="h-3 w-3" />
        Webhook URL: <code className="text-emerald-400">/webhooks/click/{`{tenantId}`}</code>
      </div>

      {save.isError && (
        <div className="mt-2 rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          <AlertCircle className="inline h-4 w-4 mr-1.5 -mt-0.5" />
          {extractMessage(save.error)}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="submit"
          disabled={save.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 px-4 py-2 text-sm font-medium text-white"
        >
          <Save className="h-4 w-4" />
          {save.isPending ? "Saqlanmoqda…" : "Saqlash"}
        </button>
        {initial?.configured && (
          <button
            type="button"
            onClick={() => {
              if (confirm("Click ulanishini o'chirasizmi?")) disable.mutate("CLICK");
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-red-900/60 bg-red-950/30 hover:bg-red-950/50 px-3 py-1.5 text-sm text-red-300"
          >
            <Trash2 className="h-4 w-4" />
            O'chirish
          </button>
        )}
      </div>
    </form>
  );
}

function PaymeForm({ initial }: { initial: PaymentProviderStatus | undefined }) {
  const save = useSavePaymentProvider();
  const disable = useDisablePaymentProvider();

  const cfg = (initial?.publicConfig ?? {}) as { cashboxId?: string; testMode?: boolean };
  const [enabled, setEnabled] = useState(initial?.enabled ?? false);
  const [cashboxId, setCashboxId] = useState(cfg.cashboxId ?? "");
  const [testMode, setTestMode] = useState(Boolean(cfg.testMode));
  const [secret, setSecret] = useState("");

  useEffect(() => {
    const c = (initial?.publicConfig ?? {}) as { cashboxId?: string; testMode?: boolean };
    setEnabled(initial?.enabled ?? false);
    setCashboxId(c.cashboxId ?? "");
    setTestMode(Boolean(c.testMode));
  }, [initial?.enabled, initial?.publicConfig]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await save.mutateAsync({
      provider: "PAYME",
      enabled,
      publicConfig: { cashboxId, testMode },
      secret: secret || undefined,
    });
    setSecret("");
  };

  return (
    <form onSubmit={submit} className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold text-white">Payme</span>
          {initial?.configured && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-800 bg-emerald-950/50 px-2 py-0.5 text-[11px] text-emerald-300">
              <CheckCircle2 className="h-3 w-3" />
              {enabled ? "Yoqilgan" : "Sozlangan"}
            </span>
          )}
        </div>
        <Toggle checked={enabled} onChange={setEnabled} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <Field label="Cashbox ID (m=...)">
          <input className="input" value={cashboxId} onChange={(e) => setCashboxId(e.target.value)} required />
        </Field>
        <Field label="Rejim">
          <label className="flex items-center gap-2 mt-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={testMode}
              onChange={(e) => setTestMode(e.target.checked)}
              className="accent-emerald-500"
            />
            Test rejimi (test.paycom.uz)
          </label>
        </Field>
      </div>

      <Field
        label="Cashbox key"
        hint={initial?.configured ? "Bo'sh qoldirsangiz oldingi qiymat saqlanadi" : "Payme kabinetidan oling"}
      >
        <input
          className="input"
          type="password"
          autoComplete="off"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder={initial?.configured ? "••••••••" : ""}
          required={!initial?.configured}
          minLength={8}
        />
      </Field>

      <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
        <ShieldCheck className="h-3 w-3" />
        Webhook URL: <code className="text-emerald-400">/webhooks/payme/{`{tenantId}`}</code>
      </div>

      {save.isError && (
        <div className="mt-2 rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          <AlertCircle className="inline h-4 w-4 mr-1.5 -mt-0.5" />
          {extractMessage(save.error)}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="submit"
          disabled={save.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 px-4 py-2 text-sm font-medium text-white"
        >
          <Save className="h-4 w-4" />
          {save.isPending ? "Saqlanmoqda…" : "Saqlash"}
        </button>
        {initial?.configured && (
          <button
            type="button"
            onClick={() => {
              if (confirm("Payme ulanishini o'chirasizmi?")) disable.mutate("PAYME");
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-red-900/60 bg-red-950/30 hover:bg-red-950/50 px-3 py-1.5 text-sm text-red-300"
          >
            <Trash2 className="h-4 w-4" />
            O'chirish
          </button>
        )}
      </div>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-slate-300 mb-1.5">{label}</div>
      {children}
      {hint && <div className="mt-1 text-[11px] text-slate-500">{hint}</div>}
    </label>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
        checked ? "bg-emerald-600" : "bg-slate-700"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function extractMessage(err: unknown): string {
  if (typeof err === "object" && err !== null) {
    const anyErr = err as { response?: { data?: { message?: string | string[] } }; message?: string };
    const msg = anyErr.response?.data?.message;
    if (Array.isArray(msg)) return msg.join(", ");
    if (typeof msg === "string") return msg;
    return anyErr.message ?? "Server bilan bog'lanishda xatolik";
  }
  return String(err);
}
