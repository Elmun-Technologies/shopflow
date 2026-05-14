// k6 load test for ShopFlow storefront — simulates 100 concurrent customers
// browsing products across 10 tenants. Targets the public read endpoints, so
// MoySklad credentials are not required.
//
// Run:
//   k6 run -e API_URL=https://api.shopflow.uz -e TENANTS=demo,kitobsho,gulchi scripts/k6-storefront.js
//
// SLOs we verify (see thresholds below):
//   p95 latency < 400ms for catalog list
//   p99 latency < 1s
//   error rate  < 0.5%

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";

const API_URL = __ENV.API_URL || "http://localhost:4000";
const TENANTS = (__ENV.TENANTS || "demo").split(",");

const errors = new Rate("errors");
const cacheHits = new Counter("cache_hits");
const productListLatency = new Trend("product_list_ms");
const productDetailLatency = new Trend("product_detail_ms");

export const options = {
  scenarios: {
    catalog_browse: {
      executor: "ramping-vus",
      stages: [
        { duration: "30s", target: 25 },
        { duration: "1m", target: 100 },
        { duration: "2m", target: 100 },
        { duration: "30s", target: 0 },
      ],
      exec: "browseCatalog",
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<400", "p(99)<1000"],
    errors: ["rate<0.005"],
    "product_list_ms": ["p(95)<400"],
  },
};

export function browseCatalog() {
  const tenant = TENANTS[Math.floor(Math.random() * TENANTS.length)];
  const host = `${tenant}.shopflow.uz`;
  const headers = { host, "user-agent": "k6-shopflow-load" };

  group("home", () => {
    const r = http.get(`${API_URL}/api/storefront/site`, { headers, tags: { name: "GET /storefront/site" } });
    errors.add(r.status >= 400);
    check(r, { "site 200": (x) => x.status === 200 });
  });

  group("catalog", () => {
    const r = http.get(`${API_URL}/api/storefront/products?perPage=30`, {
      headers,
      tags: { name: "GET /storefront/products" },
    });
    productListLatency.add(r.timings.duration);
    errors.add(r.status >= 400);
    check(r, { "products 200": (x) => x.status === 200 });
    if (r.headers["X-Cache"] === "HIT") cacheHits.add(1);

    const products = r.status === 200 ? r.json() : [];
    if (Array.isArray(products) && products.length > 0) {
      const sample = products[Math.floor(Math.random() * products.length)];
      const detail = http.get(`${API_URL}/api/storefront/products/${sample.slug}`, {
        headers,
        tags: { name: "GET /storefront/products/:slug" },
      });
      productDetailLatency.add(detail.timings.duration);
      errors.add(detail.status >= 400);
    }
  });

  sleep(Math.random() * 2 + 0.5);
}
