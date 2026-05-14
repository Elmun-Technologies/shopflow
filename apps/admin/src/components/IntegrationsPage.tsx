import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import {
  Plug,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Trash2,
  Send,
  Database,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useMoyskladStatus,
  useConnectMoysklad,
  useTelegramBotStatus,
  useConnectTelegram,
} from "../api/hooks";
import { api } from "../api/client";
import { ErrorRetry } from "./common/ErrorRetry";
import { LoadingSkeleton } from "./common/LoadingSkeleton";

export function IntegrationsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Integratsiyalar</h1>
        <p className="text-sm text-slate-400 mt-1">
          Tashqi xizmatlarni ulang — MoySklad, Telegram bot va boshqalar.
        </p>
      </header>

      <MoyskladCard />
      <TelegramCard />
    </div>
  );
}

// ──────────────────────────────────── MoySklad ────────────────────────────────────

function MoyskladCard() {
  const status = useMoyskladStatus();
  const connect = useConnectMoysklad();
  const qc = useQueryClient();
  const resync = useMutation({
    mutationFn: () => api.post("/integrations/moysklad/resync").then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sync"] }),
  });
  const disconnect = useMutation({
    mutationFn: () => api.delete("/integrations/moysklad").then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integrations", "moysklad"] }),
  });

  const [token, setToken] = useState("");

  if (status.isLoading) {
    return (
      <Card title="MoySklad" icon={<Database className="h-5 w-5" />}>
        <LoadingSkeleton rows={3} />
      </Card>
    );
  }
  if (status.isError) {
    return (
      <Card title="MoySklad" icon={<Database className="h-5 w-5" />}>
        <ErrorRetry error={status.error} onRetry={() => status.refetch()} />
      </Card>
    );
  }

  const s = status.data as MoyskladStatusDto | undefined;
  const isConnected = s?.status === "CONNECTED" || s?.status === "CONNECTING";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await connect.mutateAsync(token.trim());
    setToken("");
  };

  return (
    <Card
      title="MoySklad"
      icon={<Database className="h-5 w-5" />}
      status={
        s?.status === "CONNECTED"
          ? { label: "Ulangan", tone: "success" }
          : s?.status === "CONNECTING"
            ? { label: "Sinxronlanmoqda…", tone: "info" }
            : s?.status === "ERROR"
              ? { label: "Xatolik", tone: "error" }
              : { label: "Ulanmagan", tone: "muted" }
      }
    >
      <p className="text-sm text-slate-400 mb-4">
        MoySklad — sizning ombor, mahsulot va qoldiq ma'lumotlaringizning yagona manbai.
        Token bilan ulanganingizdan so'ng, mahsulotlar avtomatik tarzda platformaga va Telegram
        botga import qilinadi. Webhook va har 10 daqiqali zaxira sync orqali ikki tomonlama
        sinxronlash ta'minlanadi.
      </p>

      {!isConnected ? (
        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-300">Token (Personal access token)</span>
            <input
              required
              minLength={20}
              type="password"
              autoComplete="off"
              placeholder="MoySklad'dagi Sozlamalar → Token'dan oling"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
            <span className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
              <ShieldCheck className="h-3 w-3" />
              Token AES-256-GCM bilan shifrlangan holda saqlanadi
            </span>
          </label>
          {connect.isError && (
            <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
              {extractMessage(connect.error)}
            </div>
          )}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={connect.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 px-4 py-2 text-sm font-medium text-white"
            >
              <Plug className="h-4 w-4" />
              {connect.isPending ? "Tekshirilmoqda…" : "Ulash va import qilish"}
            </button>
            <a
              href="https://online.moysklad.ru/app/#users"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200"
            >
              Token qayerdan olinadi?
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Akkaunt UUID" value={s?.accountUuid ?? "—"} mono />
            <Field
              label="Ulanish vaqti"
              value={s?.connectedAt ? new Date(s.connectedAt).toLocaleString("uz-UZ") : "—"}
            />
            <Field
              label="So'nggi webhook"
              value={s?.lastWebhookAt ? new Date(s.lastWebhookAt).toLocaleString("uz-UZ") : "—"}
            />
            <Field
              label="So'nggi sync"
              value={s?.lastSyncAt ? new Date(s.lastSyncAt).toLocaleString("uz-UZ") : "—"}
            />
          </div>
          {s?.lastError && (
            <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
              <AlertCircle className="inline h-4 w-4 mr-1.5 -mt-0.5" />
              So'nggi xatolik: {s.lastError}
            </div>
          )}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => resync.mutate()}
              disabled={resync.isPending}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${resync.isPending ? "animate-spin" : ""}`} />
              Qayta sync qilish
            </button>
            <button
              onClick={() => {
                if (confirm("MoySklad ulanishini uzasizmi? Mahsulotlar bazada qoladi.")) disconnect.mutate();
              }}
              disabled={disconnect.isPending}
              className="inline-flex items-center gap-2 rounded-lg border border-red-900/60 bg-red-950/30 hover:bg-red-950/50 px-3 py-1.5 text-sm text-red-300"
            >
              <Trash2 className="h-4 w-4" />
              Ulanishni uzish
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

// ──────────────────────────────────── Telegram ────────────────────────────────────

function TelegramCard() {
  const status = useTelegramBotStatus();
  const connect = useConnectTelegram();
  const qc = useQueryClient();
  const disconnect = useMutation({
    mutationFn: () => api.delete("/integrations/telegram").then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integrations", "telegram"] }),
  });

  const [token, setToken] = useState("");

  if (status.isLoading) {
    return (
      <Card title="Telegram bot" icon={<Send className="h-5 w-5" />}>
        <LoadingSkeleton rows={3} />
      </Card>
    );
  }
  if (status.isError) {
    return (
      <Card title="Telegram bot" icon={<Send className="h-5 w-5" />}>
        <ErrorRetry error={status.error} onRetry={() => status.refetch()} />
      </Card>
    );
  }

  const s = status.data as TelegramStatusDto | undefined;
  const isConnected = !!s?.enabled;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await connect.mutateAsync(token.trim());
    setToken("");
  };

  return (
    <Card
      title="Telegram bot"
      icon={<Send className="h-5 w-5" />}
      status={
        isConnected
          ? { label: `@${s?.username ?? "ulangan"}`, tone: "success" }
          : { label: "Ulanmagan", tone: "muted" }
      }
    >
      <p className="text-sm text-slate-400 mb-4">
        Har bir do'kon o'zining Telegram botiga ega. @BotFather'da yangi bot yarating va olingan
        tokenni shu yerga kiriting. Mijozlaringiz bot orqali katalogni ko'radi, savatga qo'shadi
        va buyurtma beradi.
      </p>

      {!isConnected ? (
        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-300">Bot token</span>
            <input
              required
              type="password"
              autoComplete="off"
              placeholder="123456789:AAH..."
              pattern="\d+:[A-Za-z0-9_-]{20,}"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
            <span className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
              <ShieldCheck className="h-3 w-3" />
              Token shifrlangan holda saqlanadi
            </span>
          </label>
          {connect.isError && (
            <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
              {extractMessage(connect.error)}
            </div>
          )}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={connect.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 px-4 py-2 text-sm font-medium text-white"
            >
              <Plug className="h-4 w-4" />
              {connect.isPending ? "Tekshirilmoqda…" : "Ulash"}
            </button>
            <a
              href="https://t.me/BotFather"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200"
            >
              @BotFather'ga o'tish
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Bot username" value={s?.username ? `@${s.username}` : "—"} mono />
            <Field
              label="Ulanish vaqti"
              value={s?.connectedAt ? new Date(s.connectedAt).toLocaleString("uz-UZ") : "—"}
            />
            <Field
              label="So'nggi update"
              value={s?.lastUpdateAt ? new Date(s.lastUpdateAt).toLocaleString("uz-UZ") : "—"}
            />
            <Field
              label="Webhook"
              value={s?.webhookSet ? "Sozlangan" : "Yo'q"}
              tone={s?.webhookSet ? "success" : "muted"}
            />
          </div>
          {s?.username && (
            <a
              href={`https://t.me/${s.username}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm text-emerald-400 hover:text-emerald-300"
            >
              Botda ochish
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <button
            onClick={() => {
              if (confirm("Telegram bot ulanishini uzasizmi?")) disconnect.mutate();
            }}
            disabled={disconnect.isPending}
            className="inline-flex items-center gap-2 rounded-lg border border-red-900/60 bg-red-950/30 hover:bg-red-950/50 px-3 py-1.5 text-sm text-red-300"
          >
            <Trash2 className="h-4 w-4" />
            Ulanishni uzish
          </button>
        </div>
      )}
    </Card>
  );
}

// ──────────────────────────────────── Building blocks ────────────────────────────────────

type Tone = "success" | "info" | "error" | "muted";

function Card({
  title,
  icon,
  status,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  status?: { label: string; tone: Tone };
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-xl border border-slate-800 bg-slate-900/60 p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-white">
          <span className="text-slate-400">{icon}</span>
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        {status && <Badge tone={status.tone}>{status.label}</Badge>}
      </div>
      {children}
    </motion.div>
  );
}

function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const cls = {
    success: "bg-emerald-950/50 text-emerald-300 border-emerald-800",
    info: "bg-blue-950/50 text-blue-300 border-blue-800",
    error: "bg-red-950/50 text-red-300 border-red-800",
    muted: "bg-slate-800 text-slate-400 border-slate-700",
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs ${cls}`}>
      {tone === "success" && <CheckCircle2 className="h-3 w-3" />}
      {tone === "error" && <AlertCircle className="h-3 w-3" />}
      {children}
    </span>
  );
}

function Field({
  label,
  value,
  mono = false,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: Tone;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div
        className={`mt-0.5 text-sm ${mono ? "font-mono text-xs" : ""} ${
          tone === "success" ? "text-emerald-300" : tone === "muted" ? "text-slate-400" : "text-slate-200"
        }`}
      >
        {value}
      </div>
    </div>
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

interface MoyskladStatusDto {
  status: "DISCONNECTED" | "CONNECTING" | "CONNECTED" | "ERROR";
  accountUuid?: string | null;
  connectedAt?: string | null;
  lastWebhookAt?: string | null;
  lastSyncAt?: string | null;
  lastError?: string | null;
}

interface TelegramStatusDto {
  enabled: boolean;
  username?: string | null;
  webhookSet?: boolean;
  connectedAt?: string | null;
  lastUpdateAt?: string | null;
}
