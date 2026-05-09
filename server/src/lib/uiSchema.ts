/**
 * Bot UI Schema (versiya 1).
 * Mini App va klassik bot menyusi shu schema asosida render qilinadi.
 * Frontend va backend baham bir xil tipni ishlatadi.
 */
import { z } from "zod";

export const bannerActionSchema = z.union([
  z.object({ kind: z.literal("category"), categoryId: z.string() }),
  z.object({ kind: z.literal("product"), productId: z.string() }),
  z.object({ kind: z.literal("url"), url: z.string().url() }),
  z.object({ kind: z.literal("none") }),
]);

export const bannerBlockSchema = z.object({
  type: z.literal("banner"),
  id: z.string(),
  title: z.string().default(""),
  subtitle: z.string().default(""),
  imageUrl: z.string().url().or(z.literal("")).default(""),
  action: bannerActionSchema.default({ kind: "none" }),
});

export const sectionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("categories"),
    id: z.string(),
    title: z.string().default("Kategoriyalar"),
    layout: z.enum(["grid", "list", "scroll"]).default("scroll"),
    visibleIds: z.array(z.string()).optional(),
  }),
  z.object({
    type: z.literal("products"),
    id: z.string(),
    title: z.string().default("Tavsiya etilgan"),
    filter: z.object({
      categoryId: z.string().optional(),
      productIds: z.array(z.string()).optional(),
      limit: z.number().int().min(1).max(50).default(8),
    }).default({ limit: 8 }),
  }),
  z.object({
    type: z.literal("text"),
    id: z.string(),
    title: z.string().optional(),
    body: z.string().default(""),
  }),
]);

export const botUiSchemaSchema = z.object({
  version: z.literal(1).default(1),
  theme: z.object({
    primary: z.string().default("#10b981"),
    accent: z.string().optional(),
  }).default({ primary: "#10b981" }),
  welcomeMessage: z.string().default("Assalomu alaykum! Pastdagi tugmalardan foydalaning."),
  banners: z.array(bannerBlockSchema).default([]),
  sections: z.array(sectionSchema).default([
    { type: "categories", id: "default-cats", title: "Kategoriyalar", layout: "scroll" },
    { type: "products", id: "default-featured", title: "Mahsulotlar", filter: { limit: 12 } },
  ]),
});

export type BannerBlock = z.infer<typeof bannerBlockSchema>;
export type Section = z.infer<typeof sectionSchema>;
export type BotUISchema = z.infer<typeof botUiSchemaSchema>;

export const defaultUiSchema: BotUISchema = botUiSchemaSchema.parse({});
