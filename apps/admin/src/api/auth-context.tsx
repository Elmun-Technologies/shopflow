import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { api, loadAuth, saveAuth } from "./client.ts";

interface AuthState {
  user: { id: string; email: string; name: string; role: string } | null;
  tenant: { id: string; slug: string; name: string } | null;
}

interface AuthContextValue extends AuthState {
  login(email: string, password: string, tenantSlug?: string): Promise<void>;
  register(payload: { tenantName: string; tenantSlug: string; email: string; password: string; name: string }): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const initial = loadAuth();
  const [state, setState] = useState<AuthState>({
    user: initial?.user ?? null,
    tenant: initial?.tenant ?? null,
  });

  const login = useCallback(async (email: string, password: string, tenantSlug?: string) => {
    const res = await api.post("/auth/login", { email, password, tenantSlug });
    saveAuth(res.data);
    setState({ user: res.data.user, tenant: res.data.tenant });
  }, []);

  const register = useCallback(async (payload: { tenantName: string; tenantSlug: string; email: string; password: string; name: string }) => {
    const res = await api.post("/auth/register", payload);
    saveAuth(res.data);
    setState({ user: res.data.user, tenant: res.data.tenant });
  }, []);

  const logout = useCallback(async () => {
    const auth = loadAuth();
    if (auth?.refreshToken) {
      await api.post("/auth/logout", { refreshToken: auth.refreshToken }).catch(() => undefined);
    }
    saveAuth(null);
    setState({ user: null, tenant: null });
  }, []);

  return <AuthContext.Provider value={{ ...state, login, register, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
