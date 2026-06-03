// Sales Doctor V2 API mijozi.
// Hujjat: https://github.com/Clever91/salesdoc-api-doc
// Barcha so'rovlar POST /api/v2 bo'lib, body ichida method, auth (userId+token), data.

export class SalesDoctorError extends Error {
  constructor(public readonly reason: string, public readonly httpStatus: number, public readonly apiCode?: number) {
    super(`SalesDoctor: ${reason} (HTTP ${httpStatus}${apiCode ? `, code ${apiCode}` : ""})`);
    this.name = "SalesDoctorError";
  }
}

interface SDResponse<T> {
  status: boolean;
  result?: T;
  code?: number;
  error?: string;
  message?: string;
}

function endpoint(domain: string): string {
  // Domain user'dan keladi: "mijoz.salesdoctor.uz" yoki to'liq URL.
  // Normallashtirib protokol qo'shamiz.
  const trimmed = domain.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return `https://${trimmed}/api/v2`;
}

async function rawCall<T>(domain: string, body: Record<string, unknown>, timeoutMs = 15000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(endpoint(domain), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    throw new SalesDoctorError(err instanceof Error ? err.message : "network error", 0);
  } finally {
    clearTimeout(timer);
  }

  let json: SDResponse<T>;
  try {
    json = await res.json() as SDResponse<T>;
  } catch {
    throw new SalesDoctorError(`HTTP ${res.status} (non-JSON response)`, res.status);
  }

  if (!json.status) {
    const reason = json.error ?? json.message ?? `HTTP ${res.status}`;
    throw new SalesDoctorError(reason, res.status, json.code);
  }
  return json.result as T;
}

export interface SDLoginResult {
  userId: string;
  token: string;
}

export async function loginToSalesDoctor(domain: string, login: string, password: string): Promise<SDLoginResult> {
  return rawCall<SDLoginResult>(domain, {
    method: "login",
    auth: { login, password },
  });
}

export interface SDReference {
  SD_id: string;
  code_1C?: string;
  CS_id?: string;
  name?: string;
}

export interface SDAgent extends SDReference {
  name: string;
}

export interface SDPriceType extends SDReference {
  name: string;
}

export interface SDWarehouse extends SDReference {
  name: string;
}

export interface SDClient extends SDReference {
  name: string;
  phone?: string;
  inn?: string;
  address?: string;
}

export interface SDProduct extends SDReference {
  name: string;
  code_1C?: string;
  // ko'p qo'shimcha maydonlar bor, bu yerda asosiy nlarini saqlaymiz
}

export class SalesDoctorClient {
  constructor(
    private readonly domain: string,
    private readonly userId: string,
    private readonly token: string,
  ) {}

  private async call<T>(method: string, data?: unknown, params?: unknown): Promise<T> {
    const body: Record<string, unknown> = {
      method,
      auth: { userId: this.userId, token: this.token },
    };
    if (data !== undefined) body.data = data;
    if (params !== undefined) body.params = params;
    return rawCall<T>(this.domain, body);
  }

  // ────── GET methods (reference data) ──────

  async getAgents(): Promise<SDAgent[]> {
    return this.call<SDAgent[]>("getAgent");
  }

  async getPriceTypes(): Promise<SDPriceType[]> {
    return this.call<SDPriceType[]>("getPriceType");
  }

  async getWarehouses(): Promise<SDWarehouse[]> {
    return this.call<SDWarehouse[]>("getWarehouse");
  }

  async getClients(params?: { phone?: string; page?: number; limit?: number }): Promise<SDClient[]> {
    return this.call<SDClient[]>("getClient", undefined, params);
  }

  async getProducts(params?: { code_1C?: string; page?: number; limit?: number }): Promise<SDProduct[]> {
    return this.call<SDProduct[]>("getProduct", undefined, params);
  }

  // ────── SET methods (write) ──────

  /** Mijoz yaratish/yangilash. SD_id keyinchalik response'da kelmasligi mumkin —
   *  shuning uchun bizning code_1C uchun ShopFlow Customer.id ishlatamiz va shu bilan
   *  keyingi marta qidiramiz. */
  async setClient(client: {
    code_1C: string;
    name: string;
    phone?: string;
    address?: string;
    clientCategory?: { code_1C?: string; SD_id?: string };
    clientChannel?: { code_1C?: string; SD_id?: string };
    clientType?: { code_1C?: string; SD_id?: string };
  }): Promise<unknown> {
    return this.call("setClient", { client: [client] });
  }

  async setProduct(product: {
    code_1C: string;
    name: string;
    unit?: { code_1C?: string; SD_id?: string };
    productCategory?: { code_1C?: string; SD_id?: string };
    valyutaType?: { code_1C?: string; SD_id?: string };
  }): Promise<unknown> {
    return this.call("setProduct", { product: [product] });
  }

  async setOrder(order: {
    code_1C: string;
    status: number;
    dateCreate?: string;
    comment?: string;
    client: { code_1C?: string; SD_id?: string; CS_id?: string };
    agent: { code_1C?: string; SD_id?: string; CS_id?: string };
    expeditor?: { code_1C?: string; SD_id?: string; CS_id?: string };
    priceType: { code_1C?: string; SD_id?: string; CS_id?: string };
    warehouse: { code_1C?: string; SD_id?: string; CS_id?: string };
    orderProducts: Array<{
      product: { code_1C?: string; SD_id?: string; CS_id?: string };
      quantity: number;
      price: number;
      discount?: number;
    }>;
  }): Promise<unknown> {
    return this.call("setOrder", { order: [order] });
  }

  async setStatus(order: {
    code_1C?: string;
    SD_id?: string;
    status: number;
    dateShipment?: string;
  }): Promise<unknown> {
    return this.call("setStatus", { order: [order] });
  }

  async setDeletedOrder(order: { code_1C?: string; SD_id?: string }): Promise<unknown> {
    return this.call("setDeletedOrder", { deletedOrder: [order] });
  }

  /** Mijoz vozvrati (qaytarilgan tovar omborga qaytadi). */
  async setOrderDefect(orderDefect: {
    code_1C: string;
    status: number;
    dateCreate?: string;
    dateDefect?: string;
    comment?: string;
    client: { code_1C?: string; SD_id?: string; CS_id?: string };
    agent: { code_1C?: string; SD_id?: string; CS_id?: string };
    expeditor?: { code_1C?: string; SD_id?: string; CS_id?: string };
    priceType: { code_1C?: string; SD_id?: string; CS_id?: string };
    warehouse: { code_1C?: string; SD_id?: string; CS_id?: string };
    defectProducts: Array<{
      product: { code_1C?: string; SD_id?: string; CS_id?: string };
      quantity: number;
      price: number;
    }>;
  }): Promise<unknown> {
    return this.call("setOrderDefect", { orderDefect: [orderDefect] });
  }
}
