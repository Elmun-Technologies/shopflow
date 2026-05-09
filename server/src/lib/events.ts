/**
 * Process-local event bus.
 * Production'da Redis pub/sub'ga almashtiriladi.
 */
import { EventEmitter } from "node:events";

export type ShopEvent =
  | { type: "order.created"; shopId: string; order: { id: string; orderNumber: string; total: number; createdAt: Date | number } }
  | { type: "order.updated"; shopId: string; orderId: string; status: string }
  | { type: "product.updated"; shopId: string; productId: string };

const bus = new EventEmitter();
bus.setMaxListeners(0);

export function emit(event: ShopEvent) {
  bus.emit(event.shopId, event);
  bus.emit("*", event);
}

export function subscribe(shopId: string, listener: (e: ShopEvent) => void): () => void {
  bus.on(shopId, listener);
  return () => bus.off(shopId, listener);
}
