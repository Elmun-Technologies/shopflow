import Link from "next/link";
import { headers } from "next/headers";
import { fetchProducts, fetchCategories } from "@/lib/tenant";
import { ProductCard } from "@/components/ProductCard";

export const revalidate = 60;

interface Props {
  searchParams: Promise<{ category?: string; q?: string }>;
}

export async function generateMetadata({ searchParams }: Props) {
  const params = await searchParams;
  const title = params.q ? `Qidiruv: "${params.q}"` : "Katalog";
  return { title };
}

export default async function CatalogPage({ searchParams }: Props) {
  const h = await headers();
  const host = h.get("host") ?? "";
  const params = await searchParams;

  const [categories, products] = await Promise.all([
    fetchCategories(host),
    fetchProducts(host, { categoryId: params.category, search: params.q }),
  ]);

  const activeCategory = params.category
    ? categories.find((c) => c.id === params.category)
    : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">
          {activeCategory ? activeCategory.name : params.q ? `"${params.q}"` : "Katalog"}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          {products.length} mahsulot
        </p>
      </header>

      <form
        action="/catalog"
        method="get"
        className="mb-6 flex gap-2"
      >
        <input
          type="search"
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Qidirish…"
          className="flex-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
        />
        {params.category && <input type="hidden" name="category" value={params.category} />}
        <button
          type="submit"
          className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-sm font-medium text-white"
        >
          Qidirish
        </button>
      </form>

      {categories.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          <Link
            href="/catalog"
            className={`rounded-full px-3 py-1 text-sm transition ${
              !params.category
                ? "bg-emerald-600 text-white"
                : "bg-white border border-neutral-200 text-neutral-700 hover:border-emerald-500"
            }`}
          >
            Hammasi
          </Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/catalog?category=${c.id}`}
              className={`rounded-full px-3 py-1 text-sm transition ${
                params.category === c.id
                  ? "bg-emerald-600 text-white"
                  : "bg-white border border-neutral-200 text-neutral-700 hover:border-emerald-500"
              }`}
            >
              {c.name}
            </Link>
          ))}
        </div>
      )}

      {products.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-12 text-center text-neutral-500">
          Bunday mahsulot topilmadi
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
