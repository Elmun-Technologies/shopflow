export interface Customer {
  id: string;
  tenantId: string;
  moyskladId?: string | null;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  tags: string[];
  notes?: string | null;
  totalOrders: number;
  totalSpent: number;
  createdAt: string;
  updatedAt: string;
}
