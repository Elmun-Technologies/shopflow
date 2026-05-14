import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { fetchProducts, fetchTenantByHost } from "@/lib/tenant";

export const revalidate = 60;

function formatMoney(kopecks: number): string {
  return new Intl.NumberFormat("uz-UZ").format(Math.round(kopecks / 100)) + " so'm";
}

export default async function Home() {
  const h = await headers();
  const host = h.get("host") ?? "";
  const tenant = await fetchTenantByHost(host);
  if (!tenant) notFound();

  const products = await fetchProducts(host);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">{tenant.title}</h1>
        {tenant.description && <p className="mt-2 text-neutral-600">{tenant.description}</p>}
      </header>

      <section>
        <h2 className="mb-4 text-xl font-semibold">Mahsulotlar</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {products.map((p) => (
            <a key={p.id} href={`/p/${p.slug}`} className="rounded-xl bg-white p-3 shadow-sm hover:shadow">
              {p.image && (
                <img src={p.image} alt={p.name} className="mb-2 aspect-square w-full rounded-lg object-cover" />
              )}
              <div className="text-sm font-medium leading-tight">{p.name}</div>
              <div className="mt-1 font-semibold text-emerald-700">
                {formatMoney(p.salePriceKopecks ?? p.priceKopecks)}
              </div>
            </a>
          ))}
        </div>
        {products.length === 0 && (
          <p className="text-center text-neutral-500">Hozircha mahsulotlar mavjud emas</p>
        )}
      </section>
    </main>
  );
}
