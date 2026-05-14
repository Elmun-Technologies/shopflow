import axios, { AxiosError, type AxiosInstance } from "axios";

const AUTH_KEY = "shopflow.auth.v1";

interface StoredAuth {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: { id: string; email: string; name: string; role: string; tenantSlug: string };
  tenant: { id: string; slug: string; name: string };
}

export function loadAuth(): StoredAuth | null {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY) ?? "null");
  } catch {
    return null;
  }
}

export function saveAuth(auth: StoredAuth | null): void {
  if (auth) localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
  else localStorage.removeItem(AUTH_KEY);
}

export const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "/api",
});

api.interceptors.request.use((config) => {
  const auth = loadAuth();
  if (auth?.accessToken) {
    config.headers.set?.("Authorization", `Bearer ${auth.accessToken}`);
  }
  return config;
});

let refreshing: Promise<string | null> | null = null;

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config;
    if (error.response?.status !== 401 || !original || (original as { _retry?: boolean })._retry) {
      throw error;
    }
    (original as { _retry?: boolean })._retry = true;

    const auth = loadAuth();
    if (!auth?.refreshToken) throw error;

    refreshing ??= refresh(auth.refreshToken);
    const newToken = await refreshing.finally(() => (refreshing = null));
    if (!newToken) throw error;

    original.headers ??= {};
    (original.headers as Record<string, string>).Authorization = `Bearer ${newToken}`;
    return api.request(original);
  },
);

async function refresh(refreshToken: string): Promise<string | null> {
  try {
    const res = await axios.post(`${api.defaults.baseURL}/auth/refresh`, { refreshToken });
    const data = res.data as StoredAuth;
    saveAuth(data);
    return data.accessToken;
  } catch {
    saveAuth(null);
    return null;
  }
}
