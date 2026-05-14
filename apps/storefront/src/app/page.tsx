import Link from "next/link";
import { headers } from "next/headers";
import { fetchProducts, fetchCategories, fetchTenantByHost } from "@/lib/tenant";
import { ProductCard } from "@/components/ProductCard";

export const revalidate = 60;

export default async function Home() {
  const h = await headers();
  const host = h.get("host") ?? "";
  const [tenant, products, categories] = await Promise.all([
    fetchTenantByHost(host),
    fetchProducts(host),
    fetchCategories(host),
  ]);

  if (!tenant) return null;

  return (
    <div>
      <section className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-neutral-900">{tenant.title}</h1>
          {tenant.description && (
            <p className="mt-3 max-w-2xl mx-auto text-neutral-600">{tenant.description}</p>
          )}
          <Link
            href="/catalog"
            className="mt-6 inline-block rounded-lg bg-emerald-600 hover:bg-emerald-500 px-6 py-3 text-sm font-semibold text-white transition"
          >
            Katalogni ko'rish
          </Link>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-8">
        {categories.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-4 text-lg font-semibold text-neutral-900">Kategoriyalar</h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {categories.map((c) => (
                <Link
                  key={c.id}
                  href={`/catalog?category=${c.id}`}
                  className="shrink-0 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:border-emerald-500 hover:text-emerald-700 transition"
                  style={c.color ? { borderLeft: `3px solid ${c.color}` } : undefined}
                >
                  {c.name}
                </Link>
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-900">Mashhur mahsulotlar</h2>
            <Link href="/catalog" className="text-sm text-emerald-700 hover:underline">
              Barchasini ko'rish →
            </Link>
          </div>
          {products.length === 0 ? (
            <p className="rounded-xl border border-dashed border-neutral-300 bg-white p-12 text-center text-neutral-500">
              Hozircha mahsulotlar mavjud emas
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
              {products.slice(0, 8).map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
