"use client";

import { useSyncExternalStore } from "react";

export interface CartLine {
  productId: string;
  variantId?: string;
  name: string;
  slug: string;
  image?: string | null;
  priceKopecks: number;
  quantity: number;
}

const STORAGE_KEY = "shopflow.storefront.cart.v1";

let lines: CartLine[] = typeof window !== "undefined" ? load() : [];
const listeners = new Set<() => void>();

function load(): CartLine[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as CartLine[];
  } catch {
    return [];
  }
}

function commit() {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }
  for (const fn of listeners) fn();
}

export function getCart(): CartLine[] {
  return lines;
}

export function getCartCount(): number {
  return lines.reduce((s, l) => s + l.quantity, 0);
}

export function getCartTotal(): number {
  return lines.reduce((s, l) => s + l.priceKopecks * l.quantity, 0);
}

export function addToCart(line: Omit<CartLine, "quantity"> & { quantity?: number }): void {
  const qty = line.quantity ?? 1;
  const existing = lines.find((l) => l.productId === line.productId && l.variantId === line.variantId);
  if (existing) existing.quantity += qty;
  else lines = [...lines, { ...line, quantity: qty }];
  commit();
}

export function setLineQuantity(productId: string, qty: number, variantId?: string): void {
  if (qty <= 0) {
    lines = lines.filter((l) => !(l.productId === productId && l.variantId === variantId));
  } else {
    lines = lines.map((l) =>
      l.productId === productId && l.variantId === variantId ? { ...l, quantity: qty } : l,
    );
  }
  commit();
}

export function removeFromCart(productId: string, variantId?: string): void {
  lines = lines.filter((l) => !(l.productId === productId && l.variantId === variantId));
  commit();
}

export function clearCart(): void {
  lines = [];
  commit();
}

export function useCart() {
  const snapshot = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => lines,
    () => [] as CartLine[],
  );
  return {
    lines: snapshot,
    count: snapshot.reduce((s, l) => s + l.quantity, 0),
    total: snapshot.reduce((s, l) => s + l.priceKopecks * l.quantity, 0),
    add: addToCart,
    setQty: setLineQuantity,
    remove: removeFromCart,
    clear: clearCart,
  };
}
