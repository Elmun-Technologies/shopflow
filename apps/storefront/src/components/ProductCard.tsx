import Link from "next/link";
import { formatMoney } from "@/lib/format";
import type { PublicProduct } from "@/lib/tenant";

export function ProductCard({ product }: { product: PublicProduct }) {
  const price = product.salePriceKopecks ?? product.priceKopecks;
  const hasDiscount = product.salePriceKopecks && product.salePriceKopecks < product.priceKopecks;
  const outOfStock = product.stockTotal <= 0;

  return (
    <Link
      href={`/p/${product.slug}`}
      className="group block rounded-xl border border-neutral-200 bg-white p-3 transition hover:shadow-md"
      aria-label={product.name}
    >
      <div className="relative">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="aspect-square w-full rounded-lg object-cover"
            loading="lazy"
          />
        ) : (
          <div className="aspect-square w-full rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-400 text-3xl">
            ◻
          </div>
        )}
        {outOfStock && (
          <span className="absolute top-2 right-2 rounded-full bg-neutral-900/80 px-2 py-0.5 text-[11px] text-white">
            Tugagan
          </span>
        )}
        {!outOfStock && hasDiscount && (
          <span className="absolute top-2 left-2 rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-medium text-white">
            Chegirma
          </span>
        )}
      </div>

      <div className="mt-3 text-sm font-medium text-neutral-900 line-clamp-2 min-h-[2.5rem]">
        {product.name}
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-semibold text-emerald-700">{formatMoney(price)}</span>
        {hasDiscount && (
          <span className="text-xs text-neutral-400 line-through">
            {formatMoney(product.priceKopecks)}
          </span>
        )}
      </div>
    </Link>
  );
}
