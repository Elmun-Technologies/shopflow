// Prometheus metrikalar — /metrics endpoint + HTTP so'rov hooklari.
//
// Node default metrikalari (CPU, xotira, event-loop lag, GC) + maxsus
// HTTP counter/histogram/gauge. Route label sifatida shablon (/api/orders/:id)
// ishlatiladi — xom URL emas (label cardinality portlashining oldini olish).

import type { FastifyInstance, FastifyRequest } from "fastify";
import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from "prom-client";

// Alohida registry — global default'ni ifloslantirmaymiz (test izolyatsiyasi oson)
export const register = new Registry();
collectDefaultMetrics({ register });

const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Jami HTTP so'rovlar (method, route, status_code bo'yicha)",
  labelNames: ["method", "route", "status_code"] as const,
  registers: [register],
});

const httpRequestDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP so'rov davomiyligi (sekund)",
  labelNames: ["method", "route", "status_code"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

const httpRequestsInFlight = new Gauge({
  name: "http_requests_in_flight",
  help: "Hozir bajarilayotgan HTTP so'rovlar soni",
  registers: [register],
});

type MetricLabels = Partial<Record<"method" | "route" | "status_code", string | number>>;
interface ReqWithTimer extends FastifyRequest {
  __metricsEnd?: (labels?: MetricLabels) => number;
}

function routeLabel(req: FastifyRequest): string {
  // Route shabloni (/api/orders/:id) — xom URL emas (cardinality nazorati)
  return req.routeOptions?.url ?? "unknown";
}

/**
 * Metrics hooklari + himoyalangan /metrics endpoint'ini ro'yxatdan o'tkazadi.
 * Route registratsiyasidan OLDIN chaqirilishi kerak (barcha so'rovlarni qamrash uchun).
 */
export function registerMetrics(app: FastifyInstance): void {
  app.addHook("onRequest", async (req) => {
    (req as ReqWithTimer).__metricsEnd = httpRequestDuration.startTimer();
    httpRequestsInFlight.inc();
  });

  app.addHook("onResponse", async (req, reply) => {
    httpRequestsInFlight.dec();
    const route = routeLabel(req);
    if (route === "/metrics") return; // o'z scrape'ini hisoblamaymiz (shovqin)
    const labels = { method: req.method, route, status_code: String(reply.statusCode) };
    httpRequestsTotal.inc(labels);
    (req as ReqWithTimer).__metricsEnd?.(labels);
  });

  // Prometheus scrape endpoint — rate-limit'dan ozod.
  // Prod: METRICS_TOKEN majburiy (Bearer auth). Dev: ochiq.
  // Prod'da token o'rnatilmagan bo'lsa → 503 (tasodifiy ochilib qolishning oldini oladi).
  app.get("/metrics", { config: { rateLimit: false } }, async (req, reply) => {
    const token = process.env.METRICS_TOKEN;
    if (token) {
      if (req.headers.authorization !== `Bearer ${token}`) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
    } else if (process.env.NODE_ENV === "production") {
      return reply.code(503).send({ error: "metrics o'chirilgan — METRICS_TOKEN o'rnating" });
    }
    reply.header("Content-Type", register.contentType);
    return register.metrics();
  });
}
