/**
 * MoySklad REST API mijozi (Remap API v1.2).
 * Docs: https://dev.moysklad.ru/doc/api/remap/1.2/
 */

const API_BASE = "https://api.moysklad.ru/api/remap/1.2";

export interface MsAuth {
  /** "Bearer ..." yoki "Basic base64(login:password)" */
  authorization: string;
}

export interface MsProduct {
  id: string;
  name: string;
  description?: string;
  code?: string;
  article?: string;
  archived?: boolean;
  salePrices?: Array<{ value: number; currency?: { meta?: { href?: string } } }>;
  productFolder?: { meta: { href: string } };
  images?: { meta?: { href?: string }; rows?: Array<{ miniature?: { href?: string }; tiny?: { href?: string } }> };
}

export interface MsCategory {
  id: string;
  name: string;
  parent?: { meta: { href: string } };
  pathName?: string;
}

export class MoyskladClient {
  constructor(private auth: MsAuth) {}

  static fromToken(token: string): MoyskladClient {
    const authHeader = token.startsWith("Bearer ") || token.startsWith("Basic ") ? token : `Bearer ${token}`;
    return new MoyskladClient({ authorization: authHeader });
  }

  static fromBasic(login: string, password: string): MoyskladClient {
    const b64 = Buffer.from(`${login}:${password}`).toString("base64");
    return new MoyskladClient({ authorization: `Basic ${b64}` });
  }

  private async req<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "authorization": this.auth.authorization,
        "content-type": "application/json",
        "accept": "application/json;charset=utf-8",
        ...(init.headers ?? {}),
      },
    });
    const text = await res.text();
    if (!res.ok) {
      let msg = `MoySklad ${res.status}`;
      try {
        const data = JSON.parse(text);
        msg = data.errors?.[0]?.error ?? msg;
      } catch { /* */ }
      throw new Error(msg);
    }
    return text ? JSON.parse(text) as T : (null as T);
  }

  /** Hisob ma'lumotlarini olish — kalitni tekshirish uchun */
  async me(): Promise<{ name?: string; email?: string }> {
    return await this.req("/context/employee");
  }

  /** Mahsulotlar (assortment) — sahifalab oladi */
  async listProducts(opts: { limit?: number; offset?: number } = {}): Promise<{ rows: MsProduct[]; meta: { size: number } }> {
    const limit = Math.min(opts.limit ?? 100, 1000);
    return await this.req(`/entity/product?limit=${limit}&offset=${opts.offset ?? 0}`);
  }

  /** Kategoriyalar (productfolder) */
  async listFolders(): Promise<{ rows: MsCategory[] }> {
    return await this.req("/entity/productfolder?limit=1000");
  }

  /** Buyurtma yaratish */
  async createCustomerOrder(payload: object): Promise<{ id: string; name: string; meta: { href: string } }> {
    return await this.req("/entity/customerorder", { method: "POST", body: JSON.stringify(payload) });
  }

  /** Webhook ro'yxatdan o'tkazish */
  async createWebhook(input: { url: string; entityType: string; action: "CREATE" | "UPDATE" | "DELETE" }): Promise<{ id: string }> {
    return await this.req("/entity/webhook", {
      method: "POST",
      body: JSON.stringify({
        url: input.url,
        action: input.action,
        entityType: input.entityType,
      }),
    });
  }

  async deleteWebhook(id: string): Promise<void> {
    await this.req(`/entity/webhook/${id}`, { method: "DELETE" });
  }

  async listWebhooks(): Promise<{ rows: Array<{ id: string; url: string; action: string; entityType: string }> }> {
    return await this.req("/entity/webhook");
  }
}
