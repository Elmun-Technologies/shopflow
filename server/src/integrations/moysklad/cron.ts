/**
 * MoySklad fonda davomiy sinxronizatsiya.
 * Har 15 daqiqada barcha ulangan shopslar uchun sync ishga tushadi.
 */
import { eq } from "drizzle-orm";
import { db, schema } from "../../db/index.js";
import { syncProducts, syncStock } from "./sync.js";

const SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 daqiqa
const STOCK_INTERVAL_MS = 5 * 60 * 1000;  // 5 daqiqa (stock tezroq)

let timers: { full?: ReturnType<typeof setInterval>; stock?: ReturnType<typeof setInterval> } = {};

export function startMoyskladCron() {
  stopMoyskladCron();
  timers.full = setInterval(() => { void runSync("full"); }, SYNC_INTERVAL_MS);
  timers.stock = setInterval(() => { void runSync("stock"); }, STOCK_INTERVAL_MS);
  console.log("[moysklad cron] started: full 15min, stock 5min");
  // Birinchi marta - 30 sekunddan keyin
  setTimeout(() => { void runSync("stock"); }, 30 * 1000);
}

export function stopMoyskladCron() {
  if (timers.full) clearInterval(timers.full);
  if (timers.stock) clearInterval(timers.stock);
  timers = {};
}

async function runSync(kind: "full" | "stock") {
  const integrations = await db.query.integrations.findMany({
    where: eq(schema.integrations.type, "moysklad"),
  });
  for (const integ of integrations) {
    if (integ.status !== "connected") continue;
    try {
      if (kind === "full") {
        await syncProducts(integ.shopId);
      } else {
        await syncStock(integ.shopId).catch(() => { /* */ });
      }
    } catch (err) {
      console.warn(`[moysklad cron] shop ${integ.shopId}:`, err);
    }
  }
}
