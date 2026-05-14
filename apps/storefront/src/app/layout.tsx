import type { Metadata } from "next";
import { headers } from "next/headers";
import { fetchTenantByHost } from "@/lib/tenant";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const host = h.get("host") ?? "";
  const tenant = await fetchTenantByHost(host);
  return {
    title: tenant?.title ?? "ShopFlow",
    description: tenant?.description ?? "ShopFlow do'koni",
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <body className="bg-neutral-50 text-neutral-900 min-h-screen">{children}</body>
    </html>
  );
}
