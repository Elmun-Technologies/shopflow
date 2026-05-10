/**
 * MoySklad listener — order.created event'iga ulanib, avtomatik buyurtma push qiladi.
 */
import { subscribeAll } from "../../lib/events.js";
import { pushOrder } from "./sync.js";

export function startMoyskladListener() {
  subscribeAll((event) => {
    if (event.type !== "order.created") return;
    // Async, error blockchain'ni buzmasin
    setTimeout(() => {
      void pushOrder(event.shopId, event.order.id).catch((err) => {
        console.warn("[moysklad listener] order push failed:", err);
      });
    }, 500);
  });
  console.log("[moysklad listener] started — buyurtmalar avtomatik push qilinadi");
}
