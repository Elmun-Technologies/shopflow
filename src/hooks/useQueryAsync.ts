import { useQuery, type QueryKey } from "@tanstack/react-query";

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * `useAsync` bilan BIR XIL interfeysli ({ data, loading, error, refetch }),
 * lekin React Query bilan keshlangan + dedup + stale-while-revalidate.
 *
 * Drop-in migratsiya:
 *   useAsync(() => api.x(), [dep])  →  useQueryAsync(["x", dep], () => api.x())
 *
 * - `loading` faqat birinchi yuklashda true (kesh bo'lsa darhol data, skeleton yo'q)
 * - staleTime ichida qayta mount keshdan oniy ko'rsatadi
 * - bir xil queryKey'li parallel so'rovlar bitta so'rovga birlashtiriladi
 */
export function useQueryAsync<T>(
  queryKey: QueryKey,
  fn: () => Promise<T>,
  options?: { enabled?: boolean; staleTime?: number },
): AsyncState<T> {
  const q = useQuery<T>({
    queryKey,
    queryFn: () => fn(),
    enabled: options?.enabled ?? true,
    // staleTime'ni faqat aniq berilganda uzatamiz — aks holda undefined
    // client default'ini (queryClient.ts) bekor qilib, har mount'da refetch qiladi.
    ...(options?.staleTime !== undefined ? { staleTime: options.staleTime } : {}),
  });

  return {
    data: q.data ?? null,
    // isLoading = birinchi yuklash (data yo'q + fetch ketmoqda); refetch'da false
    loading: q.isLoading,
    error: q.error == null ? null : q.error instanceof Error ? q.error : new Error(String(q.error)),
    refetch: () => {
      void q.refetch();
    },
  };
}
