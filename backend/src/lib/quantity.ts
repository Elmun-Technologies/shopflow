import { z } from "zod";

export const productTypeSchema = z.enum(["PHYSICAL", "SERVICE"]);
export const quantityModeSchema = z.enum(["PIECE", "LENGTH", "AREA", "WEIGHT", "VOLUME", "CUSTOM"]);
export const inputModeSchema = z.enum(["STEPPER", "QUANTITY", "DIMENSIONS"]);

export const measurementSchema = z
  .object({
    width: z.number().positive().max(1_000_000).optional(),
    length: z.number().positive().max(1_000_000).optional(),
    pieces: z.number().int().positive().max(100_000).optional(),
  })
  .strict()
  .optional();

export type QuantityProduct = {
  quantityMode: string;
  inputMode: string;
  quantityStep: unknown;
  minQuantity: unknown | null;
  maxQuantity: unknown | null;
};

const EPSILON = 0.000_001;

/** Server-side quantity validation. Client-calculated area is never trusted. */
export function validateAndNormalizeQuantity(
  product: QuantityProduct,
  rawQty: number,
  measurement?: z.infer<typeof measurementSchema>
): { qty: number; measurement: Record<string, number> | null } {
  if (!Number.isFinite(rawQty) || rawQty <= 0) throw new Error("Miqdor 0 dan katta bo'lishi kerak");

  let qty = rawQty;
  let normalizedMeasurement: Record<string, number> | null = null;
  if (product.inputMode === "DIMENSIONS") {
    if (!measurement?.width || !measurement.length) throw new Error("Eni va uzunligini kiriting");
    const pieces = measurement.pieces ?? 1;
    qty = measurement.width * measurement.length * pieces;
    normalizedMeasurement = { width: measurement.width, length: measurement.length, pieces };
  }

  if (product.quantityMode === "PIECE" && !Number.isInteger(qty)) {
    throw new Error("Dona mahsulot miqdori butun son bo'lishi kerak");
  }

  const min = product.minQuantity == null ? null : Number(product.minQuantity);
  const max = product.maxQuantity == null ? null : Number(product.maxQuantity);
  const step = Number(product.quantityStep) || 1;
  if (min != null && qty + EPSILON < min) throw new Error(`Minimal miqdor: ${min}`);
  if (max != null && qty - EPSILON > max) throw new Error(`Maksimal miqdor: ${max}`);

  const base = min ?? 0;
  const steps = (qty - base) / step;
  if (Math.abs(steps - Math.round(steps)) > EPSILON) {
    throw new Error(`Miqdor qadami: ${step}`);
  }

  return { qty: Math.round(qty * 1000) / 1000, measurement: normalizedMeasurement };
}
