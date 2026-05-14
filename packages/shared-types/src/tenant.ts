export type TenantPlan = "TRIAL" | "STARTER" | "PRO" | "ENTERPRISE";
export type TenantStatus = "ACTIVE" | "SUSPENDED" | "DELETED";

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  plan: TenantPlan;
  status: TenantStatus;
  customDomain?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TenantSettings {
  tenantId: string;
  currency: string;
  timezone: string;
  defaultWarehouseId?: string | null;
  defaultPriceTypeId?: string | null;
  language: string;
}
