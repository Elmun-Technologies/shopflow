import { useEffect, useState, useSyncExternalStore } from "react";
import WebApp from "@twa-dev/sdk";
import { api } from "./api.ts";

const STORAGE_KEY = "shopflow.miniapp.auth.v1";

interface AuthState {
  accessToken: string;
  tenantSlug: string;
  customerId: string;
  customerName: string;
  expiresAt: number;
}

const listeners = new Set<() => void>();
let state: AuthState | null = load();

function load(): AuthState | null {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as AuthState | null;
    if (!raw) return null;
    if (raw.expiresAt < Date.now()) return null;
    return raw;
  } catch {
    return null;
  }
}

function commit(next: AuthState | null) {
  state = next;
  if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  else localStorage.removeItem(STORAGE_KEY);
  for (const fn of listeners) fn();
}

export function setAccessToken(token: string) {
  api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
}

/**
 * Exchanges the Telegram WebApp `initData` for a short-lived storefront JWT.
 * Result is cached in localStorage for 25 minutes (server side TTL is 30 min,
 * we leave headroom). The Mini App reopens cheaply so re-verification is fine.
 */
export async function ensureAuth(tenantSlug: string): Promise<AuthState | null> {
  const initData = WebApp.initData;
  if (!initData) {
    // Mini App opened in a regular browser (dev) — no auth, anonymous browsing.
    return null;
  }

  if (state && state.tenantSlug === tenantSlug && state.expiresAt > Date.now() + 5 * 60_000) {
    setAccessToken(state.accessToken);
    return state;
  }

  const res = await api.post<{
    accessToken: string;
    tenant: { id: string; slug: string; name: string };
    customer: { id: string; name: string };
  }>(`/miniapp/${tenantSlug}/auth/verify`, { initData });

  const next: AuthState = {
    accessToken: res.data.accessToken,
    tenantSlug: res.data.tenant.slug,
    customerId: res.data.customer.id,
    customerName: res.data.customer.name,
    expiresAt: Date.now() + 25 * 60_000,
  };
  setAccessToken(next.accessToken);
  commit(next);
  return next;
}

export function logout() {
  delete api.defaults.headers.common["Authorization"];
  commit(null);
}

export function useAuth(): AuthState | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => null,
  );
}

export function useEnsureAuth(tenantSlug: string | undefined): { ready: boolean; error: string | null } {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantSlug) return;
    let cancelled = false;
    ensureAuth(tenantSlug)
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tenantSlug]);

  return { ready, error };
}
