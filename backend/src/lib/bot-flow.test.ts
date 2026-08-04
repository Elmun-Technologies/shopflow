import { describe, it, expect } from "vitest";
import {
  botFlowDefinitionSchema,
  findOrphanScreens,
  pick,
  validateFlowRefs,
  type BotFlowDefinition,
} from "./bot-flow-schema.js";
import { getTemplate, TEMPLATE_LIST } from "./bot-flow-templates.js";
import { simulateScreen } from "./bot-engine.js";

function baseFlow(): BotFlowDefinition {
  return botFlowDefinitionSchema.parse({
    screens: [
      {
        id: "main",
        name: "Bosh menyu",
        text: { uz: "Tanlang", ru: "Выберите" },
        showBack: false,
        buttons: [],
      },
    ],
  });
}

describe("bot-flow schema", () => {
  it("bo'sh obyektdan to'liq oqim yasaydi (default'lar)", () => {
    const def = botFlowDefinitionSchema.parse({});
    expect(def.version).toBe(1);
    expect(def.settings.startScreenId).toBe("main");
    expect(def.settings.languages).toEqual(["uz", "ru"]);
    expect(def.screens).toEqual([]);
  });

  it("noto'g'ri ID'ni rad etadi", () => {
    const res = botFlowDefinitionSchema.safeParse({
      screens: [{ id: "Bosh Menyu", name: "x", text: { uz: "a", ru: "b" } }],
    });
    expect(res.success).toBe(false);
  });

  it("ID uzunligini cheklaydi (callback_data 64 bayt limiti uchun)", () => {
    const res = botFlowDefinitionSchema.safeParse({
      screens: [{ id: "a".repeat(25), name: "x", text: { uz: "a", ru: "b" } }],
    });
    expect(res.success).toBe(false);
  });
});

describe("pick()", () => {
  it("tilga mos matnni oladi", () => {
    expect(pick({ uz: "Salom", ru: "Привет" }, "ru")).toBe("Привет");
  });

  it("bo'sh til ikkinchisiga fallback qiladi", () => {
    expect(pick({ uz: "", ru: "Привет" }, "uz")).toBe("Привет");
    expect(pick({ uz: "Salom", ru: "" }, "ru")).toBe("Salom");
  });

  it("umuman bo'sh bo'lsa bo'sh satr", () => {
    expect(pick({ uz: "", ru: "" }, "uz")).toBe("");
    expect(pick(undefined, "uz")).toBe("");
  });
});

describe("validateFlowRefs", () => {
  it("to'g'ri oqimda xato yo'q", () => {
    expect(validateFlowRefs(baseFlow())).toEqual([]);
  });

  it("mavjud bo'lmagan ekranga havolani topadi", () => {
    const def = baseFlow();
    def.screens[0].buttons.push({
      id: "go",
      label: { uz: "Ket", ru: "Идти" },
      fullWidth: true,
      action: { type: "screen", screenId: "yoq" },
    });
    expect(validateFlowRefs(def).join()).toContain("yoq");
  });

  it("mavjud bo'lmagan anketaga havolani topadi", () => {
    const def = baseFlow();
    def.screens[0].buttons.push({
      id: "ask",
      label: { uz: "So'rov", ru: "Заявка" },
      fullWidth: true,
      action: { type: "form", formId: "yoq" },
    });
    expect(validateFlowRefs(def).join()).toContain("yoq");
  });

  it("takroriy ekran ID'sini topadi", () => {
    const def = baseFlow();
    def.screens.push({ ...def.screens[0] });
    expect(validateFlowRefs(def).join()).toContain("takrorlangan");
  });

  it("yo'q bosh ekranni topadi", () => {
    const def = baseFlow();
    def.settings.startScreenId = "boshqa";
    expect(validateFlowRefs(def).join()).toContain("Bosh ekran topilmadi");
  });

  it("variantsiz choice savolini topadi", () => {
    const def = baseFlow();
    def.forms.push({
      id: "f1",
      name: "Anketa",
      intro: { uz: "", ru: "" },
      successText: { uz: "ok", ru: "ок" },
      leadStatus: "NEW",
      tags: [],
      notifyAdmin: true,
      fields: [
        { id: "q1", label: { uz: "Soha", ru: "Отрасль" }, type: "choice", required: true, options: [], mapTo: null },
      ],
    });
    expect(validateFlowRefs(def).join()).toContain("variantlar yo'q");
  });

  it("savolsiz anketani topadi", () => {
    const def = baseFlow();
    def.forms.push({
      id: "f1",
      name: "Bo'sh anketa",
      intro: { uz: "", ru: "" },
      successText: { uz: "ok", ru: "ок" },
      leadStatus: "NEW",
      tags: [],
      notifyAdmin: true,
      fields: [],
    });
    expect(validateFlowRefs(def).join()).toContain("savol yo'q");
  });
});

describe("findOrphanScreens", () => {
  it("hech kim ishora qilmagan ekranni topadi", () => {
    const def = baseFlow();
    def.screens.push({
      id: "yolgiz",
      name: "Yolg'iz",
      text: { uz: "a", ru: "b" },
      imageUrl: null,
      showBack: true,
      buttons: [],
    });
    expect(findOrphanScreens(def)).toEqual(["yolgiz"]);
  });

  it("tugma orqali erishiladigan ekran orphan emas", () => {
    const def = baseFlow();
    def.screens.push({
      id: "ichki",
      name: "Ichki",
      text: { uz: "a", ru: "b" },
      imageUrl: null,
      showBack: true,
      buttons: [],
    });
    def.screens[0].buttons.push({
      id: "go",
      label: { uz: "Ket", ru: "Идти" },
      fullWidth: true,
      action: { type: "screen", screenId: "ichki" },
    });
    expect(findOrphanScreens(def)).toEqual([]);
  });

  it("buyruq orqali erishiladigan ekran orphan emas", () => {
    const def = baseFlow();
    def.screens.push({
      id: "yordam",
      name: "Yordam",
      text: { uz: "a", ru: "b" },
      imageUrl: null,
      showBack: true,
      buttons: [],
    });
    def.settings.commands.push({
      command: "help",
      description: { uz: "Yordam", ru: "Помощь" },
      screenId: "yordam",
    });
    expect(findOrphanScreens(def)).toEqual([]);
  });
});

describe("shablonlar", () => {
  it.each(TEMPLATE_LIST.map((t) => t.id))("%s shabloni sxemaga mos va xatosiz", (id) => {
    const def = getTemplate(id);
    expect(botFlowDefinitionSchema.safeParse(def).success).toBe(true);
    expect(validateFlowRefs(def)).toEqual([]);
  });

  it.each(TEMPLATE_LIST.map((t) => t.id))("%s shablonida erishilmaydigan ekran yo'q", (id) => {
    expect(findOrphanScreens(getTemplate(id))).toEqual([]);
  });

  it("B2B shabloni ikkala tilda ham to'liq to'ldirilgan", () => {
    const def = getTemplate("b2b");
    for (const s of def.screens) {
      expect(pick(s.text, "uz"), `${s.id} uz`).not.toBe("");
      expect(pick(s.text, "ru"), `${s.id} ru`).not.toBe("");
      for (const b of s.buttons) {
        expect(b.label.uz, `${s.id}.${b.id} uz`).not.toBe("");
        expect(b.label.ru, `${s.id}.${b.id} ru`).not.toBe("");
      }
    }
    for (const f of def.forms) {
      for (const field of f.fields) {
        expect(field.label.uz, `${f.id}.${field.id} uz`).not.toBe("");
        expect(field.label.ru, `${f.id}.${field.id} ru`).not.toBe("");
      }
    }
  });

  it("B2B anketalari lid ustunlariga bog'langan", () => {
    const def = getTemplate("b2b");
    for (const form of def.forms) {
      const mapped = form.fields.map((f) => f.mapTo).filter(Boolean);
      expect(mapped, `${form.id} — hech bo'lmasa telefon bog'lansin`).toContain("phone");
    }
  });

  it("shablon nusxasi mustaqil (mutatsiya boshqa chaqiruvga o'tmaydi)", () => {
    const a = getTemplate("retail");
    a.screens[0].name = "O'zgargan";
    expect(getTemplate("retail").screens[0].name).not.toBe("O'zgargan");
  });
});

describe("simulateScreen (admin preview)", () => {
  it("{store} o'rniga do'kon nomini qo'yadi", () => {
    const def = botFlowDefinitionSchema.parse({
      screens: [{ id: "main", name: "M", text: { uz: "Salom {store}", ru: "Привет {store}" } }],
    });
    expect(simulateScreen(def, "main", "uz", "Gulf")?.text).toBe("Salom Gulf");
  });

  it("tugma turlarini ajratadi", () => {
    const def = getTemplate("b2b");
    const sim = simulateScreen(def, "main", "ru", "Gulf");
    expect(sim).not.toBeNull();
    expect(sim!.buttons.some((b) => b.kind === "screen")).toBe(true);
    expect(sim!.buttons.some((b) => b.kind === "form")).toBe(true);
  });

  it("yo'q ekran uchun null", () => {
    expect(simulateScreen(baseFlow(), "yoq", "uz", "X")).toBeNull();
  });
});
