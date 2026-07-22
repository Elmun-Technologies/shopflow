// Dashboard KPI davr oynalari — joriy va oldingi davr chegaralari.
//
// MUHIM: joriy oyna period-to-date (davr boshidan HOZIRgacha, to'liq emas).
// Shu sabab oldingi oynani ham xuddi shu O'TGAN qismga cheklaymiz
// (prevFrom + elapsed), aks holda "yarim oy vs to'liq oy" taqqoslanib
// %-o'zgarish sun'iy ravishda tushib ketardi (masalan oy boshida -90%).
//
// `now` in'ektsiya qilinadi (default `new Date()`) — deterministik test uchun.

export type Period = "today" | "week" | "month" | "year" | "all";

export interface PeriodRange {
  from: Date | null;
  prevFrom: Date | null;
  prevTo: Date | null;
}

export function getPeriodRange(period: Period, now: Date = new Date()): PeriodRange {
  let from: Date | null = null;
  let prevFrom: Date | null = null;
  if (period === "today") {
    from = new Date(now); from.setHours(0, 0, 0, 0);
    prevFrom = new Date(from); prevFrom.setDate(prevFrom.getDate() - 1);
  } else if (period === "week") {
    from = new Date(now); from.setDate(now.getDate() - 7); from.setHours(0, 0, 0, 0);
    prevFrom = new Date(from); prevFrom.setDate(prevFrom.getDate() - 7);
  } else if (period === "month") {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
    prevFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  } else if (period === "year") {
    from = new Date(now.getFullYear(), 0, 1);
    prevFrom = new Date(now.getFullYear() - 1, 0, 1);
  } else {
    // "all" — barcha vaqt
    return { from: null, prevFrom: null, prevTo: null };
  }
  const elapsed = now.getTime() - from.getTime();
  const prevTo = new Date(prevFrom.getTime() + elapsed);
  return { from, prevFrom, prevTo };
}
