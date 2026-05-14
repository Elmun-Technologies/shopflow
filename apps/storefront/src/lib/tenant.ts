import "server-only";

export interface PublicTenant {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  theme: { primaryColor?: string; accentColor?: string };
  catalogOnly: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function fetchTenantByHost(host: string): Promise<PublicTenant | null> {
  try {
    const res = await fetch(`${API_URL}/api/storefront/site`, {
      headers: { host },
      next: { revalidate: 60, tags: ["storefront-site"] },
    });
    if (!res.ok) return null;
    return (await res.json()) as PublicTenant;
  } catch {
    return null;
  }
}

export async function fetchProducts(host: string): Promise<Array<{ id: string; name: string; slug: string; priceKopecks: number; salePriceKopecks: number | null; image: string | null; stockTotal: number }>> {
  try {
    const res = await fetch(`${API_URL}/api/storefront/products`, {
      headers: { host },
      next: { revalidate: 60, tags: ["storefront-products"] },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}
