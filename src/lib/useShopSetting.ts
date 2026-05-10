/**
 * useShopSetting — har qanday JSON-ni shop_settings jadvaliga avtomatik
 * saqlaydigan hook. Mock data o'rniga persistent storage uchun ishlatiladi.
 *
 * Misol:
 *   const [emails, setEmails] = useShopSetting('marketing.email_campaigns', initialEmailCampaigns);
 *
 * - Birinchi yuklash: backend'dan o'qiydi (yoki default qaytaradi)
 * - O'zgarganda 800ms debounce bilan backend'ga PUT
 * - Local storage'da ham cache (offline uchun)
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { api, getToken, ApiError } from "./api";

interface State<T> {
  value: T;
  loading: boolean;
  error: string | null;
}

export function useShopSetting<T>(
  key: string,
  defaultValue: T,
): [T, (next: T | ((prev: T) => T)) => void, { loading: boolean; error: string | null; reload: () => void }] {
  const cacheKey = `shopflow.settings.${key}`;
  const [state, setState] = useState<State<T>>(() => {
    if (typeof localStorage !== "undefined") {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try { return { value: JSON.parse(cached) as T, loading: true, error: null }; } catch { /* */ }
      }
    }
    return { value: defaultValue, loading: true, error: null };
  });

  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadDone = useRef(false);

  // Initial load from backend
  const reload = useCallback(async () => {
    if (!getToken()) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    try {
      const result = await api.settings.get<T>(key).catch((err) => {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      });
      if (result) {
        setState({ value: result.value, loading: false, error: null });
        if (typeof localStorage !== "undefined") localStorage.setItem(cacheKey, JSON.stringify(result.value));
      } else {
        setState({ value: defaultValue, loading: false, error: null });
      }
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err instanceof ApiError ? err.message : "Yuklab bo'lmadi" }));
    }
    initialLoadDone.current = true;
  }, [key]);

  useEffect(() => { void reload(); }, [reload]);

  const setValue = useCallback((next: T | ((prev: T) => T)) => {
    setState((prev) => {
      const newValue = typeof next === "function" ? (next as (p: T) => T)(prev.value) : next;
      // Cache local
      if (typeof localStorage !== "undefined") {
        try { localStorage.setItem(cacheKey, JSON.stringify(newValue)); } catch { /* */ }
      }
      // Debounced save to backend
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      if (initialLoadDone.current && getToken()) {
        saveTimeout.current = setTimeout(() => {
          api.settings.set(key, newValue).catch((err) => {
            console.warn(`[useShopSetting:${key}]`, err);
          });
        }, 800);
      }
      return { value: newValue, loading: false, error: null };
    });
  }, [key, cacheKey]);

  return [state.value, setValue, { loading: state.loading, error: state.error, reload }];
}
