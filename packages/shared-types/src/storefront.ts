export interface StorefrontTheme {
  primaryColor: string;
  accentColor: string;
  fontFamily?: string;
  logoUrl?: string | null;
}

export interface StorefrontSite {
  id: string;
  tenantId: string;
  subdomain: string;
  customDomain?: string | null;
  theme: StorefrontTheme;
  featuredProductIds: string[];
  published: boolean;
  catalogOnly: boolean;
  title: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}
