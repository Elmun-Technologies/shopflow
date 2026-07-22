import { describe, it, expect } from "vitest";
import { amountsMatch, reconcileOutcome, paymeStateForStatus } from "./payment-reconcile.js";

describe("amountsMatch", () => {
  it("teng summa → true", () => expect(amountsMatch(89000, 89000)).toBe(true));
  it("1 so'm farq (dumaloqlash) → true", () => expect(amountsMatch(89000, 89001)).toBe(true));
  it("katta farq → false", () => expect(amountsMatch(50000, 89000)).toBe(false));
  it("0 va 0 → true", () => expect(amountsMatch(0, 0)).toBe(true));
});

describe("reconcileOutcome", () => {
  it("ref bor, order topilmadi → no_order", () => {
    expect(reconcileOutcome("ORD-7524", null, 89000)).toBe("no_order");
  });
  it("ref yo'q, order yo'q → ok (referenssiz webhook bloklanmaydi)", () => {
    expect(reconcileOutcome(null, null, 89000)).toBe("ok");
  });
  it("summa mos emas → amount_mismatch", () => {
    expect(reconcileOutcome("ORD-7524", { total: 89000 }, 50000)).toBe("amount_mismatch");
  });
  it("summa mos → ok", () => {
    expect(reconcileOutcome("ORD-7524", { total: 89000 }, 89000)).toBe("ok");
  });
  it("summa 1 so'm farq → ok (tolerans)", () => {
    expect(reconcileOutcome("ORD-7524", { total: 89000 }, 89001)).toBe("ok");
  });
});

describe("paymeStateForStatus", () => {
  it("PENDING → 1 (yaratilgan)", () => expect(paymeStateForStatus("PENDING")).toBe(1));
  it("SUCCESS → 2 (bajarilgan)", () => expect(paymeStateForStatus("SUCCESS")).toBe(2));
  it("CANCELLED → -2", () => expect(paymeStateForStatus("CANCELLED")).toBe(-2));
  it("REFUNDED → -2", () => expect(paymeStateForStatus("REFUNDED")).toBe(-2));
  it("FAILED → -1", () => expect(paymeStateForStatus("FAILED")).toBe(-1));
});
