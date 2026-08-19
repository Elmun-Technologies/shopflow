import { describe, it, expect } from "vitest";
import { skuify, slugify } from "./slug.js";

describe("skuify", () => {
  it("lotin nomdan SKU yasaydi", () => {
    expect(skuify("iPhone 15 Pro")).toBe("IPHONE15PRO");
  });

  it("kirill nomni lotinga o'giradi", () => {
    expect(skuify("Чай зелёный")).toMatch(/^[A-Z0-9]+$/);
    expect(skuify("Чай зелёный").length).toBeGreaterThan(0);
  });

  it("bo'sh satrdan bo'sh SKU", () => {
    expect(skuify("???")).toBe("");
  });
});

describe("slugify", () => {
  it("tire bilan URL-safe", () => {
    expect(slugify("iPhone 15 Pro")).toBe("iphone-15-pro");
  });
});
