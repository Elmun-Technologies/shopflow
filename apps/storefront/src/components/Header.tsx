"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart-store";

interface Props {
  tenantTitle: string;
  catalogOnly: boolean;
  logoUrl?: string | null;
}

export function Header({ tenantTitle, catalogOnly, logoUrl }: Props) {
  const cart = useCart();
  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 min-w-0">
          {logoUrl ? (
            <img src={logoUrl} alt={tenantTitle} className="h-8 w-8 rounded object-cover" />
          ) : (
            <span className="inline-flex h-8 w-8 items-center justify-center rounded bg-emerald-600 text-white text-sm font-bold">
              {tenantTitle.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="font-semibold text-neutral-900 truncate">{tenantTitle}</span>
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          <Link href="/catalog" className="rounded-md px-3 py-1.5 text-neutral-700 hover:bg-neutral-100">
            Katalog
          </Link>
          {!catalogOnly && (
            <Link
              href="/cart"
              className="relative rounded-md px-3 py-1.5 text-neutral-700 hover:bg-neutral-100"
              aria-label="Savatcha"
            >
              Savatcha
              {cart.count > 0 && (
                <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[11px] font-medium text-white">
                  {cart.count}
                </span>
              )}
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
