import { Counter, Histogram, Gauge, Registry, collectDefaultMetrics } from "prom-client";

/**
 * Process-wide Prometheus registry. We expose this from each service via a
 * `/metrics` HTTP route (api) or a sidecar port (worker, bot).
 *
 * Default metrics (event loop lag, GC, process CPU/RSS) are auto-collected.
 * Service-specific counters/histograms are declared once and re-used.
 */
export const registry = new Registry();
collectDefaultMetrics({ register: registry, prefix: "shopflow_" });

export const httpRequestsTotal = new Counter({
  name: "shopflow_http_requests_total",
  help: "HTTP requests by method, route, status",
  labelNames: ["method", "route", "status"] as const,
  registers: [registry],
});

export const httpRequestDuration = new Histogram({
  name: "shopflow_http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status"] as const,
  buckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1, 2, 5],
  registers: [registry],
});

export const moyskladRequestsTotal = new Counter({
  name: "shopflow_moysklad_requests_total",
  help: "MoySklad API calls (per tenant + method + status)",
  labelNames: ["tenant_id", "method", "status"] as const,
  registers: [registry],
});

export const ordersCreatedTotal = new Counter({
  name: "shopflow_orders_created_total",
  help: "Orders created by channel",
  labelNames: ["tenant_id", "channel"] as const,
  registers: [registry],
});

export const paymentsTotal = new Counter({
  name: "shopflow_payments_total",
  help: "Payments by provider and result",
  labelNames: ["tenant_id", "provider", "result"] as const,
  registers: [registry],
});

export const webhookEventsTotal = new Counter({
  name: "shopflow_webhook_events_total",
  help: "Webhook events received by source and outcome",
  labelNames: ["tenant_id", "source", "outcome"] as const,
  registers: [registry],
});

export const syncJobDuration = new Histogram({
  name: "shopflow_sync_job_duration_seconds",
  help: "Sync job duration in seconds",
  labelNames: ["tenant_id", "type", "status"] as const,
  buckets: [1, 5, 15, 60, 300, 900, 3600],
  registers: [registry],
});

export const activeBotsGauge = new Gauge({
  name: "shopflow_active_bots",
  help: "Number of grammY Bot instances currently loaded",
  registers: [registry],
});

/**
 * Returns a serialized Prometheus exposition. Call inside the /metrics route.
 */
export function renderMetrics(): Promise<string> {
  return registry.metrics();
}
