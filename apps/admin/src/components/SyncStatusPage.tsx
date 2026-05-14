import { useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Inbox,
  RotateCcw,
  Database,
  Filter,
} from "lucide-react";
import {
  useSyncJobs,
  useWebhookEvents,
  useRetryWebhookEvent,
  useResyncEntity,
  useReconcile,
} from "../api/hooks";
import { LoadingSkeleton } from "./common/LoadingSkeleton";
import { EmptyState } from "./common/EmptyState";
import { ErrorRetry } from "./common/ErrorRetry";
import type { SyncJob, WebhookEvent, SyncJobStatus } from "@shopflow/shared-types";

const RESYNC_ENTITIES: Array<{ key: "product" | "variant" | "productfolder" | "customerorder" | "counterparty" | "stock"; label: string }> = [
  { key: "product", label: "Mahsulotlar" },
  { key: "variant", label: "Variantlar" },
  { key: "productfolder", label: "Kategoriyalar" },
  { key: "counterparty", label: "Mijozlar" },
  { key: "customerorder", label: "Buyurtmalar" },
  { key: "stock", label: "Qoldiqlar" },
];

export function SyncStatusPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Sinxronizatsiya holati</h1>
        <p className="text-sm text-slate-400 mt-1">
          MoySklad sync ishlari va kelib tushgan webhook hodisalari. Sahifa har 5–10 sekundda yangilanadi.
        </p>
      </header>

      <ResyncControls />
      <JobsSection />
      <EventsSection />
    </div>
  );
}

function ResyncControls() {
  const resyncEntity = useResyncEntity();
  const reconcile = useReconcile();
  const [lastAction, setLastAction] = useState<string | null>(null);

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-white">
          <Database className="h-5 w-5 text-slate-400" />
          <h2 className="text-lg font-semibold">Qayta sinxronlash</h2>
        </div>
        <button
          type="button"
          onClick={async () => {
            await reconcile.mutateAsync();
            setLastAction("Reconcile boshlandi");
          }}
          disabled={reconcile.isPending}
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-700 bg-emerald-950/40 hover:bg-emerald-950/60 px-3 py-1.5 text-sm text-emerald-200 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${reconcile.isPending ? "animate-spin" : ""}`} />
          Reconcile (to'liq tekshirish)
        </button>
      </div>
      <p className="text-sm text-slate-400 mb-4">
        Tanlangan entity'larni MoySklad'dan qaytadan tortib oling. Reconcile esa lokal va remote
        soni o'rtasidagi farqni tekshiradi va kerak bo'lsa avtomatik re-import qiladi.
      </p>
      <div className="flex flex-wrap gap-2">
        {RESYNC_ENTITIES.map((e) => (
          <button
            key={e.key}
            type="button"
            onClick={async () => {
              await resyncEntity.mutateAsync(e.key);
              setLastAction(`${e.label} qayta sinxronlash boshlandi`);
            }}
            disabled={resyncEntity.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-800 px-3 py-1.5 text-sm text-slate-200 disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {e.label}
          </button>
        ))}
      </div>
      {lastAction && (
        <p className="mt-3 text-xs text-emerald-300">
          <CheckCircle2 className="inline h-3 w-3 mr-1" />
          {lastAction}
        </p>
      )}
    </section>
  );
}

function JobsSection() {
  const jobs = useSyncJobs();

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="flex items-center gap-2 text-white mb-4">
        <Activity className="h-5 w-5 text-slate-400" />
        <h2 className="text-lg font-semibold">Sync ishlari</h2>
      </div>

      {jobs.isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : jobs.isError ? (
        <ErrorRetry error={jobs.error} onRetry={() => jobs.refetch()} />
      ) : !jobs.data || jobs.data.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-8 w-8" />}
          title="Hali sync ishlari yo'q"
          description="MoySklad ulanganidan keyin bu yerda boshlang'ich import va keyingi sync'lar paydo bo'ladi."
        />
      ) : (
        <ul className="divide-y divide-slate-800">
          {jobs.data.map((j) => (
            <JobRow key={j.id} job={j} />
          ))}
        </ul>
      )}
    </section>
  );
}

function JobRow({ job }: { job: SyncJob }) {
  return (
    <motion.li
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="py-3 flex items-start justify-between gap-4"
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <StatusIcon status={job.status} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">{prettyType(job.type)}</span>
            <StatusBadge status={job.status} />
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            {new Date(job.createdAt).toLocaleString("uz-UZ")}
            {job.startedAt && (
              <>
                {" "}· boshlangan: {new Date(job.startedAt).toLocaleTimeString("uz-UZ")}
              </>
            )}
            {job.finishedAt && (
              <>
                {" "}· tugagan: {new Date(job.finishedAt).toLocaleTimeString("uz-UZ")}
              </>
            )}
          </div>
          {job.status === "RUNNING" && (
            <>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <motion.div
                  className="h-full bg-emerald-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${job.progress}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
              {typeof job.stats?._phase === "string" && (
                <div className="mt-1 text-xs text-blue-300">{job.stats._phase}…</div>
              )}
            </>
          )}
          {Object.keys(job.stats ?? {}).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(job.stats).map(([k, v]) => (
                <span
                  key={k}
                  className="rounded-md border border-slate-800 bg-slate-950 px-2 py-0.5 text-[11px] text-slate-300"
                >
                  {k}: <b className="text-white">{v}</b>
                </span>
              ))}
            </div>
          )}
          {job.error && (
            <div className="mt-2 text-xs text-red-300/90">
              <AlertTriangle className="inline h-3 w-3 mr-1 -mt-0.5" />
              {job.error}
            </div>
          )}
        </div>
      </div>
      <div className="text-right text-sm text-slate-400 tabular-nums shrink-0">
        {job.status === "RUNNING" ? `${job.progress}%` : ""}
      </div>
    </motion.li>
  );
}

function EventsSection() {
  const [onlyFailed, setOnlyFailed] = useState(false);
  const events = useWebhookEvents({ onlyFailed });
  const retry = useRetryWebhookEvent();

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-white">
          <RefreshCw className="h-5 w-5 text-slate-400" />
          <h2 className="text-lg font-semibold">Webhook hodisalari</h2>
          <span className="text-xs text-slate-500 ml-2">(so'nggi {onlyFailed ? "xatoli" : "100"})</span>
        </div>
        <button
          type="button"
          onClick={() => setOnlyFailed((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition ${
            onlyFailed
              ? "border-red-800 bg-red-950/30 text-red-200"
              : "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          <Filter className="h-3.5 w-3.5" />
          {onlyFailed ? "Faqat xatolar (yoqilgan)" : "Faqat xatolarni ko'rsatish"}
        </button>
      </div>

      {events.isLoading ? (
        <LoadingSkeleton rows={6} />
      ) : events.isError ? (
        <ErrorRetry error={events.error} onRetry={() => events.refetch()} />
      ) : !events.data || events.data.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-8 w-8" />}
          title="Webhook hodisalari yo'q"
          description="MoySklad'da mahsulot, narx yoki buyurtma o'zgarganda bu yerda yozuvlar paydo bo'ladi."
        />
      ) : (
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-800">
              <tr>
                <th className="px-5 py-2 font-medium">Vaqt</th>
                <th className="px-5 py-2 font-medium">Manba</th>
                <th className="px-5 py-2 font-medium">Entity</th>
                <th className="px-5 py-2 font-medium">Action</th>
                <th className="px-5 py-2 font-medium">Status</th>
                <th className="px-5 py-2 font-medium text-right">Amal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {events.data.map((e: WebhookEvent) => (
                <tr key={e.id} className="hover:bg-slate-800/30">
                  <td className="px-5 py-2 text-slate-400 whitespace-nowrap">
                    {new Date(e.createdAt).toLocaleTimeString("uz-UZ")}
                  </td>
                  <td className="px-5 py-2 text-slate-300">{e.source}</td>
                  <td className="px-5 py-2 font-mono text-xs text-slate-200">{e.entityType}</td>
                  <td className="px-5 py-2 text-slate-300">{e.action}</td>
                  <td className="px-5 py-2">
                    {e.error ? (
                      <span className="inline-flex items-center gap-1 text-red-300 text-xs" title={e.error}>
                        <AlertTriangle className="h-3 w-3" />
                        Xato
                      </span>
                    ) : e.processedAt ? (
                      <span className="inline-flex items-center gap-1 text-emerald-300 text-xs">
                        <CheckCircle2 className="h-3 w-3" />
                        Bajarildi
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-300 text-xs">
                        <Clock className="h-3 w-3" />
                        Navbatda
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-2 text-right">
                    {e.error && (
                      <button
                        type="button"
                        onClick={() => retry.mutate(e.id)}
                        disabled={retry.isPending}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800/60 hover:bg-slate-800 px-2 py-1 text-xs text-slate-200 disabled:opacity-50"
                        title="Qayta urinish"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Qayta
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function StatusIcon({ status }: { status: SyncJobStatus }) {
  if (status === "DONE") return <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5" />;
  if (status === "FAILED") return <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5" />;
  if (status === "RUNNING") return <RefreshCw className="h-5 w-5 text-blue-400 animate-spin mt-0.5" />;
  return <Clock className="h-5 w-5 text-slate-400 mt-0.5" />;
}

function StatusBadge({ status }: { status: SyncJobStatus }) {
  const cls = {
    QUEUED: "bg-slate-800 text-slate-300 border-slate-700",
    RUNNING: "bg-blue-950/50 text-blue-300 border-blue-800",
    DONE: "bg-emerald-950/50 text-emerald-300 border-emerald-800",
    FAILED: "bg-red-950/50 text-red-300 border-red-800",
  }[status];
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${cls}`}>{status}</span>;
}

function prettyType(type: string): string {
  const map: Record<string, string> = {
    INITIAL_IMPORT: "Boshlang'ich import",
    INCREMENTAL_SYNC: "Qo'shimcha sinxronizatsiya",
    ENTITY_REFRESH: "Yangilash",
    SUBSCRIBE_WEBHOOKS: "Webhook obunalari",
    RECONCILE: "Tekshirish",
  };
  return map[type] ?? type;
}
