"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart-store";

interface Props {
  product: {
    id: string;
    slug: string;
    name: string;
    image: string | null;
    priceKopecks: number;
    salePriceKopecks: number | null;
  };
  outOfStock?: boolean;
}

export function AddToCartButton({ product, outOfStock }: Props) {
  const cart = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const router = useRouter();

  if (outOfStock) {
    return (
      <button
        type="button"
        disabled
        className="w-full rounded-lg bg-neutral-200 py-3 text-sm font-semibold text-neutral-500 cursor-not-allowed"
      >
        Hozircha mavjud emas
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <div className="inline-flex items-center rounded-lg border border-neutral-200 bg-white">
        <button
          type="button"
          onClick={() => setQty((q) => Math.max(1, q - 1))}
          className="px-3 py-2 text-lg text-neutral-700 hover:bg-neutral-100"
          aria-label="Kamaytirish"
        >
          −
        </button>
        <span className="px-4 text-sm font-medium tabular-nums w-12 text-center">{qty}</span>
        <button
          type="button"
          onClick={() => setQty((q) => q + 1)}
          className="px-3 py-2 text-lg text-neutral-700 hover:bg-neutral-100"
          aria-label="Ko'paytirish"
        >
          +
        </button>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            cart.add({
              productId: product.id,
              slug: product.slug,
              name: product.name,
              image: product.image,
              priceKopecks: product.salePriceKopecks ?? product.priceKopecks,
              quantity: qty,
            });
            setAdded(true);
            setTimeout(() => setAdded(false), 2000);
          }}
          className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 py-3 text-sm font-semibold text-white transition"
        >
          {added ? "✓ Qo'shildi" : "Savatga qo'shish"}
        </button>
        <button
          type="button"
          onClick={() => {
            cart.add({
              productId: product.id,
              slug: product.slug,
              name: product.name,
              image: product.image,
              priceKopecks: product.salePriceKopecks ?? product.priceKopecks,
              quantity: qty,
            });
            router.push("/checkout");
          }}
          className="rounded-lg border border-emerald-600 bg-white hover:bg-emerald-50 py-3 px-4 text-sm font-semibold text-emerald-700 transition"
        >
          Tezda xarid
        </button>
      </div>

      {added && (
        <Link href="/cart" className="block text-center text-xs text-emerald-700 hover:underline">
          Savatchaga o'tish →
        </Link>
      )}
    </div>
  );
}
