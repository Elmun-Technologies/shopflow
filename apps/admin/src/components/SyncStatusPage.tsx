import { motion } from "framer-motion";
import { Activity, CheckCircle2, Clock, AlertTriangle, RefreshCw, Inbox } from "lucide-react";
import { useSyncJobs, useWebhookEvents } from "../api/hooks";
import { LoadingSkeleton } from "./common/LoadingSkeleton";
import { EmptyState } from "./common/EmptyState";
import { ErrorRetry } from "./common/ErrorRetry";
import type { SyncJob, WebhookEvent, SyncJobStatus } from "@shopflow/shared-types";

export function SyncStatusPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Sinxronizatsiya holati</h1>
        <p className="text-sm text-slate-400 mt-1">
          MoySklad sync ishlari va kelib tushgan webhook hodisalari. Sahifa har 5–10 sekundda yangilanadi.
        </p>
      </header>

      <JobsSection />
      <EventsSection />
    </div>
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
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <motion.div
                className="h-full bg-emerald-500"
                initial={{ width: 0 }}
                animate={{ width: `${job.progress}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
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
  const events = useWebhookEvents();

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="flex items-center gap-2 text-white mb-4">
        <RefreshCw className="h-5 w-5 text-slate-400" />
        <h2 className="text-lg font-semibold">Webhook hodisalari</h2>
        <span className="text-xs text-slate-500 ml-2">(so'nggi 100)</span>
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
                      <span className="inline-flex items-center gap-1 text-red-300 text-xs">
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
