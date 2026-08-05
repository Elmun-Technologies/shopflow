import { describe, it, expect } from "vitest";
import { extractCharacteristicLabel, splitOneCId } from "./onec-import.js";

describe("splitOneCId — «Характеристика» ajratish", () => {
  it("guid#guid ni ikkiga bo'ladi", () => {
    expect(splitOneCId("aaa-111#bbb-222")).toEqual({ baseId: "aaa-111", charId: "bbb-222" });
  });

  it("oddiy guid variant emas", () => {
    expect(splitOneCId("aaa-111")).toEqual({ baseId: "aaa-111", charId: null });
  });

  it("buzuq shakl variant sifatida qaralmaydi", () => {
    expect(splitOneCId("#bbb")).toEqual({ baseId: "#bbb", charId: null });
    expect(splitOneCId("aaa#")).toEqual({ baseId: "aaa#", charId: null });
  });

  it("ikkinchi # xarakteristika ichida qoladi", () => {
    expect(splitOneCId("a#b#c")).toEqual({ baseId: "a", charId: "b#c" });
  });
});

describe("extractCharacteristicLabel", () => {
  it("qavsli shaklni tozalaydi", () => {
    expect(extractCharacteristicLabel("Aromatizator (1 kg)", "Aromatizator")).toBe("1 kg");
  });

  it("qavssiz shaklni tozalaydi", () => {
    expect(extractCharacteristicLabel("Aromatizator 5 kg", "Aromatizator")).toBe("5 kg");
  });

  it("ajratgichlarni olib tashlaydi", () => {
    expect(extractCharacteristicLabel("Aromatizator, 50 gr", "Aromatizator")).toBe("50 gr");
    expect(extractCharacteristicLabel("Aromatizator — 50 gr", "Aromatizator")).toBe("50 gr");
    expect(extractCharacteristicLabel("Aromatizator / 50 gr", "Aromatizator")).toBe("50 gr");
  });

  it("registrga bog'liq emas", () => {
    expect(extractCharacteristicLabel("AROMATIZATOR (1 kg)", "Aromatizator")).toBe("1 kg");
  });

  it("prefiks mos kelmasa to'liq nomni qoldiradi", () => {
    expect(extractCharacteristicLabel("Qora / XL", "Boshqa tovar")).toBe("Qora / XL");
  });

  it("asosiy nom noma'lum bo'lsa to'liq nom", () => {
    expect(extractCharacteristicLabel("1 kg", null)).toBe("1 kg");
  });

  it("prefiksdan keyin bo'sh qolsa to'liq nomga qaytadi", () => {
    expect(extractCharacteristicLabel("Aromatizator", "Aromatizator")).toBe("Aromatizator");
  });
});
