import { describe, expect, it } from "vitest";
import { validateAndNormalizeQuantity } from "./quantity.js";

const areaProduct = {
  quantityMode: "AREA",
  inputMode: "DIMENSIONS",
  quantityStep: 0.01,
  minQuantity: 1,
  maxQuantity: 100,
};

describe("validateAndNormalizeQuantity", () => {
  it("recalculates area on the server instead of trusting client qty", () => {
    expect(
      validateAndNormalizeQuantity(areaProduct, 999, { width: 2, length: 3, pieces: 2 })
    ).toEqual({
      qty: 12,
      measurement: { width: 2, length: 3, pieces: 2 },
    });
  });

  it("accepts fractional direct quantities", () => {
    expect(validateAndNormalizeQuantity({ ...areaProduct, inputMode: "QUANTITY" }, 2.5)).toEqual({
      qty: 2.5,
      measurement: null,
    });
  });

  it("keeps piece products integer-only", () => {
    expect(() =>
      validateAndNormalizeQuantity(
        { ...areaProduct, quantityMode: "PIECE", inputMode: "STEPPER", quantityStep: 1 },
        1.5
      )
    ).toThrow("butun son");
  });

  it("enforces configured limits and step", () => {
    expect(() =>
      validateAndNormalizeQuantity(areaProduct, 0.5, { width: 0.5, length: 1, pieces: 1 })
    ).toThrow("Minimal");
    expect(() =>
      validateAndNormalizeQuantity(
        { ...areaProduct, inputMode: "QUANTITY", quantityStep: 0.5 },
        1.2
      )
    ).toThrow("qadami");
  });
});
