import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Product, Order, Customer, Category, Warehouse, SyncJob, WebhookEvent } from "@shopflow/shared-types";
import { api } from "./client.ts";

interface Paginated<T> { data: T[]; total: number; page: number; perPage: number }

export function useProducts(params: Record<string, string | number | boolean | undefined> = {}) {
  return useQuery({
    queryKey: ["products", params],
    queryFn: () => api.get<Paginated<Product>>("/products", { params }).then((r) => r.data),
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: ["product", id],
    queryFn: () => api.get<Product>(`/products/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useOrders(params: Record<string, string | number | undefined> = {}) {
  return useQuery({
    queryKey: ["orders", params],
    queryFn: () => api.get<Paginated<Order>>("/orders", { params }).then((r) => r.data),
  });
}

export function useCustomers(params: Record<string, string | number | undefined> = {}) {
  return useQuery({
    queryKey: ["customers", params],
    queryFn: () => api.get<Paginated<Customer>>("/customers", { params }).then((r) => r.data),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<Category[]>("/categories").then((r) => r.data),
  });
}

export function useWarehouses() {
  return useQuery({
    queryKey: ["warehouses"],
    queryFn: () => api.get<Warehouse[]>("/warehouses").then((r) => r.data),
  });
}

export function useMoyskladStatus() {
  return useQuery({
    queryKey: ["integrations", "moysklad"],
    queryFn: () => api.get("/integrations/moysklad").then((r) => r.data),
    refetchInterval: 5000,
  });
}

export function useConnectMoysklad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => api.post("/integrations/moysklad", { token }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integrations"] }),
  });
}

export function useTelegramBotStatus() {
  return useQuery({
    queryKey: ["integrations", "telegram"],
    queryFn: () => api.get("/integrations/telegram").then((r) => r.data),
  });
}

export function useConnectTelegram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => api.post("/integrations/telegram", { token }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integrations", "telegram"] }),
  });
}

export function useSyncJobs() {
  return useQuery({
    queryKey: ["sync", "jobs"],
    queryFn: () => api.get<SyncJob[]>("/sync/jobs").then((r) => r.data),
    refetchInterval: 5000,
  });
}

export function useWebhookEvents(opts: { onlyFailed?: boolean } = {}) {
  return useQuery({
    queryKey: ["sync", "events", opts],
    queryFn: () =>
      api
        .get<WebhookEvent[]>("/sync/events", {
          params: { onlyFailed: opts.onlyFailed ? "true" : undefined },
        })
        .then((r) => r.data),
    refetchInterval: 10000,
  });
}

export function useRetryWebhookEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/sync/events/${id}/retry`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sync"] }),
  });
}

export function useResyncEntity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entity: "product" | "variant" | "productfolder" | "customerorder" | "counterparty" | "stock") =>
      api.post(`/integrations/moysklad/resync/${entity}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sync"] }),
  });
}

export function useReconcile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/integrations/moysklad/reconcile").then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sync"] }),
  });
}
