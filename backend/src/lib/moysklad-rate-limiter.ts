/**
 * Tenant-aware in-memory rate limiter for MoySklad API.
 *
 * MoySklad limits (rasmiy):
 *   - 45 so'rov / 3 sekund (burst)
 *   - 5 so'rov / sekund (sustained)
 *
 * Bu implementatsiya 45/3s burst limitini sliding-window bilan amalga oshiradi.
 * Bir vaqtning o'zida ko'p instance ishlasa, har biri mustaqil hisoblaydi —
 * shu sababli single-process backend uchun mo'ljallangan. Multi-replica
 * kerak bo'lsa, Redis'ga ko'chiriladi.
 */

const CAPACITY = 45;
const WINDOW_MS = 3_000;

const timestamps = new Map<string, number[]>();

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

export async function acquireMoyskladSlot(tenantId: string, maxWaitMs = 15_000): Promise<void> {
  const deadline = Date.now() + maxWaitMs;

  while (true) {
    const now = Date.now();
    const cutoff = now - WINDOW_MS;
    const stamps = timestamps.get(tenantId) ?? [];
    const active = stamps.filter((t) => t > cutoff);

    if (active.length < CAPACITY) {
      active.push(now);
      timestamps.set(tenantId, active);
      return;
    }

    timestamps.set(tenantId, active);

    if (now >= deadline) {
      throw new Error(`MoySklad rate limit: tenant=${tenantId} uchun slot olishga vaqt yetmadi`);
    }
    // Eng eski stamp tushgandan keyin yana urinamiz
    const waitFor = Math.max(50, active[0] + WINDOW_MS - now + 25);
    await sleep(Math.min(waitFor, deadline - now));
  }
}
