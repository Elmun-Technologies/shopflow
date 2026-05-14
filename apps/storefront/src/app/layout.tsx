import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { fetchTenantByHost } from "@/lib/tenant";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const host = h.get("host") ?? "";
  const tenant = await fetchTenantByHost(host);
  return {
    title: tenant?.title ?? "ShopFlow",
    description: tenant?.description ?? "ShopFlow do'koni",
    openGraph: tenant
      ? {
          title: tenant.title,
          description: tenant.description ?? undefined,
          locale: "uz_UZ",
          type: "website",
          images: tenant.theme.logoUrl ? [{ url: tenant.theme.logoUrl }] : undefined,
        }
      : undefined,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const host = h.get("host") ?? "";
  const tenant = await fetchTenantByHost(host);
  if (!tenant) notFound();

  const cssVars: Record<string, string> = {};
  if (tenant.theme.primaryColor) cssVars["--brand-primary"] = tenant.theme.primaryColor;
  if (tenant.theme.accentColor) cssVars["--brand-accent"] = tenant.theme.accentColor;

  return (
    <html lang="uz">
      <body className="bg-neutral-50 text-neutral-900 min-h-screen flex flex-col" style={cssVars as React.CSSProperties}>
        <Header
          tenantTitle={tenant.title}
          catalogOnly={tenant.catalogOnly}
          logoUrl={tenant.theme.logoUrl ?? null}
        />
        <main className="flex-1">{children}</main>
        <Footer tenantTitle={tenant.title} />
      </body>
    </html>
  );
}
