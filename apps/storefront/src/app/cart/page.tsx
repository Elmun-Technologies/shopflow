"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart-store";
import { formatMoney } from "@/lib/format";

export default function CartPage() {
  const cart = useCart();

  if (cart.lines.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-neutral-900">Savatcha bo'sh</h1>
        <p className="mt-2 text-neutral-500">Katalogdan biror mahsulot tanlang</p>
        <Link
          href="/catalog"
          className="mt-6 inline-block rounded-lg bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-sm font-medium text-white"
        >
          Katalogga o'tish
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-bold text-neutral-900 mb-6">Savatcha</h1>

      <ul className="space-y-3">
        {cart.lines.map((line) => (
          <li
            key={`${line.productId}:${line.variantId ?? ""}`}
            className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3"
          >
            <Link href={`/p/${line.slug}`} className="shrink-0">
              {line.image ? (
                <img src={line.image} alt={line.name} className="h-20 w-20 rounded-lg object-cover" />
              ) : (
                <div className="h-20 w-20 rounded-lg bg-neutral-100" />
              )}
            </Link>

            <div className="flex-1 min-w-0">
              <Link href={`/p/${line.slug}`} className="block font-medium text-neutral-900 hover:text-emerald-700 line-clamp-2">
                {line.name}
              </Link>
              <div className="mt-1 text-sm text-neutral-500">{formatMoney(line.priceKopecks)}</div>

              <div className="mt-2 inline-flex items-center rounded-lg border border-neutral-200">
                <button
                  type="button"
                  onClick={() => cart.setQty(line.productId, line.quantity - 1, line.variantId)}
                  className="px-2.5 py-1 text-neutral-700 hover:bg-neutral-50"
                  aria-label="Kamaytirish"
                >
                  −
                </button>
                <span className="px-3 text-sm tabular-nums w-10 text-center">{line.quantity}</span>
                <button
                  type="button"
                  onClick={() => cart.setQty(line.productId, line.quantity + 1, line.variantId)}
                  className="px-2.5 py-1 text-neutral-700 hover:bg-neutral-50"
                  aria-label="Ko'paytirish"
                >
                  +
                </button>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="font-semibold text-neutral-900">
                {formatMoney(line.priceKopecks * line.quantity)}
              </div>
              <button
                type="button"
                onClick={() => cart.remove(line.productId, line.variantId)}
                className="mt-1 text-xs text-red-500 hover:text-red-600"
              >
                O'chirish
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4">
        <div className="flex justify-between text-base font-semibold">
          <span>Jami</span>
          <span>{formatMoney(cart.total)}</span>
        </div>
        <Link
          href="/checkout"
          className="mt-4 block w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 py-3 text-center text-sm font-semibold text-white"
        >
          Buyurtma berish
        </Link>
        <button
          type="button"
          onClick={cart.clear}
          className="mt-2 block w-full text-center text-xs text-neutral-500 hover:text-red-600"
        >
          Savatchani tozalash
        </button>
      </div>
    </div>
  );
}
