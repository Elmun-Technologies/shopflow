import { useSyncExternalStore } from "react";

export interface CartLine {
  productId: string;
  variantId?: string;
  name: string;
  priceKopecks: number;
  quantity: number;
}

const KEY = "shopflow.cart.v1";

function load(): CartLine[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as CartLine[];
  } catch {
    return [];
  }
}

let lines: CartLine[] = load();
const listeners = new Set<() => void>();

function commit() {
  localStorage.setItem(KEY, JSON.stringify(lines));
  for (const fn of listeners) fn();
}

export function useCart() {
  const snapshot = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => lines,
  );

  return {
    lines: snapshot,
    add(line: CartLine) {
      const existing = lines.find((l) => l.productId === line.productId && l.variantId === line.variantId);
      if (existing) existing.quantity += line.quantity;
      else lines = [...lines, line];
      commit();
    },
    remove(productId: string) {
      lines = lines.filter((l) => l.productId !== productId);
      commit();
    },
    clear() {
      lines = [];
      commit();
    },
    total() {
      return lines.reduce((s, l) => s + l.priceKopecks * l.quantity, 0);
    },
  };
}
