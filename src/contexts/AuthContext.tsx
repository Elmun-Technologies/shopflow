import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { auth as authApi } from "../api/endpoints";
import { setToken, setRefreshToken, clearAuth } from "../api/client";
import { api } from "../api/client";
import { queryClient } from "../api/queryClient";
import type { User, Tenant } from "../types/api";

interface AuthState {
  user: User | null;
  tenant: Tenant | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string, tenantSlug?: string) => Promise<void>;
  register: (data: {
    tenantName: string;
    tenantSlug: string;
    email: string;
    password: string;
    name: string;
  }) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Bootstrap — sahifa qayta ochilganda tokendan sessiyani tiklash
  useEffect(() => {
    const token = localStorage.getItem("shopflow.token");
    if (!token) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then((res) => {
        setUser(res.user);
        setTenant(res.tenant);
      })
      .catch(() => {
        clearAuth();
      })
      .finally(() => setLoading(false));
  }, []);

  // 401 da avtomatik logout
  useEffect(() => {
    const onUnauthorized = () => {
      setUser(null);
      setTenant(null);
      queryClient.clear(); // keshlangan tenant ma'lumotlarini tozalash
    };
    window.addEventListener("shopflow:unauthorized", onUnauthorized);
    return () => window.removeEventListener("shopflow:unauthorized", onUnauthorized);
  }, []);

  const login = useCallback<AuthState["login"]>(async (email, password, tenantSlug) => {
    setError(null);
    try {
      const res = await authApi.login(email, password, tenantSlug);
      setToken(res.token);
      const extended = res as typeof res & { refreshToken?: string };
      if (extended.refreshToken) setRefreshToken(extended.refreshToken);
      setUser(res.user);
      setTenant(res.tenant);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Kirish muvaffaqiyatsiz";
      setError(msg);
      throw err;
    }
  }, []);

  const register = useCallback<AuthState["register"]>(async (data) => {
    setError(null);
    try {
      const res = await authApi.register(data);
      setToken(res.token);
      const extended2 = res as typeof res & { refreshToken?: string };
      if (extended2.refreshToken) setRefreshToken(extended2.refreshToken);
      setUser(res.user);
      setTenant(res.tenant);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Ro'yxatdan o'tish muvaffaqiyatsiz";
      setError(msg);
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    const refreshToken = localStorage.getItem("shopflow.refreshToken");
    if (refreshToken) {
      // Fonda — kutmaymiz
      api("/auth/logout", { method: "POST", body: { refreshToken }, _skipRefresh: true } as never)
        .catch(() => null);
    }
    clearAuth();
    setUser(null);
    setTenant(null);
    queryClient.clear(); // keshlangan tenant ma'lumotlarini tozalash (tenant-leak oldini olish)
  }, []);

  const value = useMemo(
    () => ({ user, tenant, loading, error, login, register, logout }),
    [user, tenant, loading, error, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
