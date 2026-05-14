import type { Request, Response, NextFunction } from "express";
import { httpRequestDuration, httpRequestsTotal } from "@shopflow/observability";

/**
 * Express middleware that records every HTTP request to Prometheus. The
 * `route` label uses the routing pattern (e.g. `/api/products/:id`) not the
 * raw path, so cardinality stays low.
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const route = resolveRoute(req);
    const labels = {
      method: req.method,
      route,
      status: String(res.statusCode),
    };
    httpRequestsTotal.inc(labels);
    const durSec = Number(process.hrtime.bigint() - start) / 1e9;
    httpRequestDuration.observe(labels, durSec);
  });
  next();
}

function resolveRoute(req: Request): string {
  // Express resolves route at this point: req.route?.path is the pattern.
  // If unresolved (404), fall back to a coarse label to keep cardinality bounded.
  const pattern = (req as Request & { route?: { path?: string } }).route?.path;
  if (pattern && typeof pattern === "string") {
    return (req.baseUrl ?? "") + pattern;
  }
  // Strip UUIDs and numeric ids from the raw path so we don't explode cardinality.
  return req.path.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id");
}
