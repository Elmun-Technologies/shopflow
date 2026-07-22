import { describe, it, expect } from "vitest";
import { getPeriodRange } from "./period-range.js";

// Barcha testlar in'ektsiya qilingan `now` bilan — deterministik.
// Mahalliy vaqt ishlatiladi (new Date(y, m, d)), shuning uchun offsetlarni
// nisbiy tekshiramiz, absolyut ISO emas.

describe("getPeriodRange", () => {
  it("all → hammasi null", () => {
    expect(getPeriodRange("all")).toEqual({ from: null, prevFrom: null, prevTo: null });
  });

  it("today: from = bugun 00:00, prev oynasi shu o'tgan qismga cheklanadi", () => {
    const now = new Date(2026, 4, 15, 14, 30, 0); // 15-may 14:30
    const { from, prevFrom, prevTo } = getPeriodRange("today", now);
    expect(from).toEqual(new Date(2026, 4, 15, 0, 0, 0, 0));
    expect(prevFrom).toEqual(new Date(2026, 4, 14, 0, 0, 0, 0));
    // prevTo = kecha 14:30 (o'tgan 14.5 soatga mos) — to'liq kun EMAS
    expect(prevTo).toEqual(new Date(2026, 4, 14, 14, 30, 0, 0));
  });

  it("period-to-date: joriy va oldingi oyna DAVOMIYLIGI teng", () => {
    const now = new Date(2026, 4, 3, 9, 0, 0); // oy boshidan 2.375 kun
    const { from, prevFrom, prevTo } = getPeriodRange("month", now);
    const curLen = now.getTime() - from!.getTime();
    const prevLen = prevTo!.getTime() - prevFrom!.getTime();
    expect(prevLen).toBe(curLen); // muhim: teng davomiylik
    expect(from).toEqual(new Date(2026, 4, 1)); // 1-may
    expect(prevFrom).toEqual(new Date(2026, 3, 1)); // 1-aprel
  });

  it("month: prevFrom oldingi oyning 1-sanasi", () => {
    const now = new Date(2026, 0, 20, 12, 0, 0); // 20-yanvar
    const { prevFrom } = getPeriodRange("month", now);
    expect(prevFrom).toEqual(new Date(2025, 11, 1)); // dekabr (yil o'tishi)
  });

  it("year: from = 1-yanvar, prevFrom = o'tgan yil 1-yanvar", () => {
    const now = new Date(2026, 6, 1, 0, 0, 0);
    const { from, prevFrom, prevTo } = getPeriodRange("year", now);
    expect(from).toEqual(new Date(2026, 0, 1));
    expect(prevFrom).toEqual(new Date(2025, 0, 1));
    const curLen = now.getTime() - from!.getTime();
    expect(prevTo!.getTime() - prevFrom!.getTime()).toBe(curLen);
  });

  it("week: joriy oyna 7 kun + bugungi o'tgan qism; prev teng", () => {
    const now = new Date(2026, 4, 15, 10, 0, 0);
    const { from, prevFrom, prevTo } = getPeriodRange("week", now);
    expect(from).toEqual(new Date(2026, 4, 8, 0, 0, 0, 0)); // 7 kun oldin 00:00
    const curLen = now.getTime() - from!.getTime();
    expect(prevTo!.getTime() - prevFrom!.getTime()).toBe(curLen);
  });
});
