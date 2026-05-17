import { describe, it, expect } from "vitest";
import { cn } from "./cn";

describe("cn (className utility)", () => {
  it("merges single class", () => {
    expect(cn("foo")).toBe("foo");
  });

  it("merges multiple classes", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles falsy values", () => {
    expect(cn("foo", false, null, undefined, "bar")).toBe("foo bar");
  });

  it("merges conflicting tailwind classes (last wins)", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("handles conditional classes", () => {
    const active = true;
    const disabled = false;
    expect(cn("base", active && "active", disabled && "disabled")).toBe("base active");
  });

  it("handles object syntax", () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe("foo baz");
  });

  it("handles arrays", () => {
    expect(cn(["foo", "bar"], "baz")).toBe("foo bar baz");
  });
});
