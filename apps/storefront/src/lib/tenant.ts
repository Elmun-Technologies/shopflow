import "server-only";

export interface PublicTenant {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  theme: { primaryColor?: string; accentColor?: string; logoUrl?: string | null };
  catalogOnly: boolean;
}

export interface PublicProduct {
  id: string;
  name: string;
  slug: string;
  sku: string;
  priceKopecks: number;
  salePriceKopecks: number | null;
  stockTotal: number;
  unit: string;
  image: string | null;
  category: { name: string; slug: string } | null;
}

export interface PublicProductDetail extends PublicProduct {
  description: string | null;
  images: string[];
  barcode: string | null;
  weight: number | null;
  dimensions: string | null;
  vatPercent: number;
}

export interface PublicCategory {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function tenantFetch<T>(
  host: string,
  path: string,
  opts: { revalidate?: number; tags?: string[] } = {},
): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}/api${path}`, {
      headers: { host },
      next: { revalidate: opts.revalidate ?? 60, tags: opts.tags },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchTenantByHost(host: string): Promise<PublicTenant | null> {
  return tenantFetch<PublicTenant>(host, "/storefront/site", {
    revalidate: 60,
    tags: ["storefront-site"],
  });
}

export async function fetchProducts(
  host: string,
  params: { categoryId?: string; search?: string; page?: number } = {},
): Promise<PublicProduct[]> {
  const qs = new URLSearchParams();
  if (params.categoryId) qs.set("categoryId", params.categoryId);
  if (params.search) qs.set("search", params.search);
  if (params.page) qs.set("page", String(params.page));
  qs.set("perPage", "60");

  const data = await tenantFetch<PublicProduct[]>(host, `/storefront/products?${qs.toString()}`, {
    revalidate: 60,
    tags: ["storefront-products"],
  });
  return data ?? [];
}

export async function fetchProduct(host: string, slug: string): Promise<PublicProductDetail | null> {
  return tenantFetch<PublicProductDetail>(host, `/storefront/products/${slug}`, {
    revalidate: 120,
    tags: ["storefront-products", `product:${slug}`],
  });
}

export async function fetchCategories(host: string): Promise<PublicCategory[]> {
  const data = await tenantFetch<PublicCategory[]>(host, "/storefront/categories", {
    revalidate: 300,
    tags: ["storefront-categories"],
  });
  return data ?? [];
}
