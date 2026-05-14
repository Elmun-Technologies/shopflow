import * as Sentry from "@sentry/node";

interface InitOptions {
  /** Service name; included in `tags.service`. */
  service: string;
  /** Optional version (git sha or package version). */
  release?: string;
  /** Defaults to NODE_ENV or "development". */
  environment?: string;
  /** Defaults to 0.0 in dev, 0.1 in prod. */
  tracesSampleRate?: number;
}

/**
 * Initializes the Sentry SDK if SENTRY_DSN is set. A no-op when DSN is missing
 * — handy for local dev where you typically don't want noise in your Sentry
 * project. Returns true if initialized.
 */
export function initSentry(opts: InitOptions): boolean {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return false;

  Sentry.init({
    dsn,
    release: opts.release ?? process.env.GIT_SHA,
    environment: opts.environment ?? process.env.NODE_ENV ?? "development",
    tracesSampleRate: opts.tracesSampleRate ?? (process.env.NODE_ENV === "production" ? 0.1 : 0),
    initialScope: { tags: { service: opts.service } },
    integrations: [
      // HTTP and console breadcrumbs are on by default; we add Prisma + Postgres
      // integrations conditionally only if the package is installed at runtime.
    ],
    beforeSend(event) {
      scrubSensitiveData(event);
      return event;
    },
  });
  return true;
}

/** Captures an exception with optional tenant/extra context. */
export function captureException(err: unknown, context?: { tenantId?: string; extra?: Record<string, unknown> }): void {
  Sentry.withScope((scope) => {
    if (context?.tenantId) scope.setTag("tenantId", context.tenantId);
    if (context?.extra) scope.setContext("extra", context.extra);
    Sentry.captureException(err);
  });
}

export { Sentry };

// ---------- Internal: PII scrubbing ----------

const SENSITIVE_KEYS = [
  "password",
  "passwordhash",
  "token",
  "accesstoken",
  "refreshtoken",
  "encryptedtoken",
  "encryptedsecret",
  "secret",
  "secret_key",
  "authorization",
  "cookie",
  "set-cookie",
  "initdata",
  "x-revalidate-secret",
];

function scrubSensitiveData(event: Sentry.Event): void {
  if (event.request?.headers) {
    event.request.headers = scrubObject(event.request.headers);
  }
  if (event.request?.data && typeof event.request.data === "object") {
    event.request.data = scrubObject(event.request.data as Record<string, unknown>);
  }
  if (event.extra) event.extra = scrubObject(event.extra);
  if (event.contexts) {
    for (const [k, v] of Object.entries(event.contexts)) {
      if (v && typeof v === "object") event.contexts[k] = scrubObject(v as Record<string, unknown>);
    }
  }
}

function scrubObject<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    const lower = k.toLowerCase();
    if (SENSITIVE_KEYS.some((s) => lower.includes(s))) {
      out[k] = "[REDACTED]";
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = scrubObject(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}
