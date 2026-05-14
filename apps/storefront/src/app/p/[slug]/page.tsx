import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { fetchProduct, fetchTenantByHost } from "@/lib/tenant";
import { AddToCartButton } from "@/components/AddToCartButton";
import { formatMoney } from "@/lib/format";

export const revalidate = 120;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const h = await headers();
  const host = h.get("host") ?? "";
  const { slug } = await params;
  const product = await fetchProduct(host, slug);
  if (!product) return { title: "Mahsulot topilmadi" };
  return {
    title: product.name,
    description: product.description ?? `${product.name} — ${formatMoney(product.salePriceKopecks ?? product.priceKopecks)}`,
    openGraph: {
      title: product.name,
      description: product.description ?? undefined,
      images: product.image ? [{ url: product.image }] : undefined,
      type: "website",
    },
  };
}

export default async function ProductDetailPage({ params }: Props) {
  const h = await headers();
  const host = h.get("host") ?? "";
  const { slug } = await params;
  const [tenant, product] = await Promise.all([
    fetchTenantByHost(host),
    fetchProduct(host, slug),
  ]);

  if (!product || !tenant) notFound();

  const price = product.salePriceKopecks ?? product.priceKopecks;
  const hasDiscount = product.salePriceKopecks && product.salePriceKopecks < product.priceKopecks;
  const outOfStock = product.stockTotal <= 0;

  const jsonLd = {
    "@context": "https://schema.org/",
    "@type": "Product",
    name: product.name,
    description: product.description ?? undefined,
    image: product.images?.length ? product.images : product.image ? [product.image] : undefined,
    sku: product.sku,
    brand: product.category?.name,
    offers: {
      "@type": "Offer",
      priceCurrency: "UZS",
      price: (price / 100).toFixed(0),
      availability: outOfStock
        ? "https://schema.org/OutOfStock"
        : "https://schema.org/InStock",
      seller: { "@type": "Organization", name: tenant.title },
    },
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              className="aspect-square w-full rounded-lg object-cover"
            />
          ) : (
            <div className="aspect-square w-full rounded-lg bg-neutral-100 flex items-center justify-center text-6xl text-neutral-300">
              ◻
            </div>
          )}
          {product.images && product.images.length > 1 && (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {product.images.slice(0, 8).map((img, i) => (
                <img
                  key={i}
                  src={img}
                  alt=""
                  className="aspect-square rounded object-cover border border-neutral-200"
                />
              ))}
            </div>
          )}
        </div>

        <div>
          {product.category && (
            <div className="text-xs uppercase tracking-wide text-neutral-500">
              {product.category.name}
            </div>
          )}
          <h1 className="mt-1 text-2xl md:text-3xl font-bold text-neutral-900">{product.name}</h1>
          <div className="mt-2 text-xs text-neutral-500 font-mono">SKU: {product.sku}</div>

          <div className="mt-6 flex items-baseline gap-3">
            <div className="text-3xl font-bold text-emerald-700">{formatMoney(price)}</div>
            {hasDiscount && (
              <div className="text-lg text-neutral-400 line-through">
                {formatMoney(product.priceKopecks)}
              </div>
            )}
          </div>

          <div className="mt-2 text-sm text-neutral-600">
            {outOfStock ? (
              <span className="text-red-600">Hozircha tugagan</span>
            ) : (
              <span>Mavjud: <b>{Math.round(product.stockTotal)}</b> {product.unit}</span>
            )}
          </div>

          {!tenant.catalogOnly && (
            <div className="mt-6">
              <AddToCartButton
                product={{
                  id: product.id,
                  slug: product.slug,
                  name: product.name,
                  image: product.image,
                  priceKopecks: product.priceKopecks,
                  salePriceKopecks: product.salePriceKopecks,
                }}
                outOfStock={outOfStock}
              />
            </div>
          )}

          {product.description && (
            <div className="mt-8 prose prose-neutral max-w-none">
              <h2 className="text-base font-semibold text-neutral-900">Tavsif</h2>
              <p className="mt-2 text-sm text-neutral-700 whitespace-pre-line">{product.description}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
