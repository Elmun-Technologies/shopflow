import { QueryClient } from "@tanstack/react-query";

// Markaziy React Query mijozi. Logout/401'da queryClient.clear() chaqiriladi
// (AuthContext) — tenantlararo kesh oqishini oldini olish uchun.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 30s ichida qayta mount/navigatsiya keshdan ko'rsatiladi (refetch yo'q)
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      // Oyna fokusida avtomatik refetch yo'q — real-time SSE/polling alohida
      refetchOnWindowFocus: false,
    },
  },
});
