import { describe, expect, it } from "vitest";
import { buildReminderText } from "./cart-abandonment.js";
import { formatStatusMessage } from "./telegram-notify.js";

const cart = {
  storeName: "Demo",
  customerName: "Ali",
  items: [{ productId: "p1", name: "Vitamin C", qty: 2, price: 50_000 }],
  total: 100_000,
  currency: "UZS",
};

describe("customer Telegram i18n", () => {
  it("formats abandoned-cart reminders entirely in Russian", () => {
    const text = buildReminderText({ ...cart, lang: "ru" });
    expect(text).toContain("ваша корзина ждёт");
    expect(text).toContain("100 000 сум");
    expect(text).not.toContain("savatingiz");
    expect(text).not.toContain("so'm");
  });

  it("formats abandoned-cart reminders entirely in Uzbek", () => {
    const text = buildReminderText({ ...cart, lang: "uz" });
    expect(text).toContain("savatingiz kutmoqda");
    expect(text).toMatch(/100\s000 so'm/);
    expect(text).not.toContain("ваша корзина");
  });

  it("formats order status messages and currency in the selected language", () => {
    const ru = formatStatusMessage("ORD-1", 125_000, "UZS", "PROCESSING", "ru");
    const uz = formatStatusMessage("ORD-1", 125_000, "UZS", "PROCESSING", "uz");

    expect(ru).toContain("Ваш заказ готовится");
    expect(ru).toContain("125 000 сум");
    expect(ru).not.toContain("Buyurtma");

    expect(uz).toContain("Buyurtmangiz tayyorlanmoqda");
    expect(uz).toMatch(/125\s000 so'm/);
    expect(uz).not.toContain("Ваш заказ");
  });
});
