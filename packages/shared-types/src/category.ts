export interface Category {
  id: string;
  tenantId: string;
  moyskladId?: string | null;
  parentId?: string | null;
  name: string;
  slug: string;
  pathName?: string | null;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  productsCount: number;
  createdAt: string;
  updatedAt: string;
}
