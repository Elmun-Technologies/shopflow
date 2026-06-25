import { describe, it, expect, afterEach } from "vitest";
import Fastify from "fastify";
import { registerMetrics } from "./metrics.js";

const ENV = { node: process.env.NODE_ENV, token: process.env.METRICS_TOKEN };
afterEach(() => {
  process.env.NODE_ENV = ENV.node;
  if (ENV.token === undefined) delete process.env.METRICS_TOKEN;
  else process.env.METRICS_TOKEN = ENV.token;
});

describe("metrics", () => {
  it("/metrics Prometheus formatda HTTP va default metrikalarni beradi", async () => {
    delete process.env.METRICS_TOKEN;
    process.env.NODE_ENV = "test";
    const app = Fastify({ logger: false });
    registerMetrics(app);
    app.get("/ping", async () => ({ ok: true }));
    await app.ready();

    await app.inject({ method: "GET", url: "/ping" });
    const res = await app.inject({ method: "GET", url: "/metrics" });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/plain");
    expect(res.body).toContain("http_requests_total");
    expect(res.body).toContain('route="/ping"');
    // prom-client default (process) metrikasi ham bo'lishi kerak
    expect(res.body).toContain("process_cpu_user_seconds_total");
    await app.close();
  });

  it("prod'da METRICS_TOKEN bo'lmasa 503 (tasodifiy ochilmaslik)", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.METRICS_TOKEN;
    const app = Fastify({ logger: false });
    registerMetrics(app);
    await app.ready();

    const res = await app.inject({ method: "GET", url: "/metrics" });
    expect(res.statusCode).toBe(503);
    await app.close();
  });

  it("METRICS_TOKEN o'rnatilganda Bearer auth talab qiladi", async () => {
    process.env.NODE_ENV = "production";
    process.env.METRICS_TOKEN = "secret-token";
    const app = Fastify({ logger: false });
    registerMetrics(app);
    await app.ready();

    const noAuth = await app.inject({ method: "GET", url: "/metrics" });
    expect(noAuth.statusCode).toBe(401);

    const withAuth = await app.inject({
      method: "GET",
      url: "/metrics",
      headers: { authorization: "Bearer secret-token" },
    });
    expect(withAuth.statusCode).toBe(200);
    await app.close();
  });
});
