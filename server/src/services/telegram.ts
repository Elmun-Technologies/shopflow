/**
 * Telegram Bot API helper.
 * grammY ishlatamiz, lekin bot lifecycle va token validatsiyasini bu qatlam boshqaradi.
 */

const TG_API = "https://api.telegram.org";

export interface TgBotInfo {
  id: number;
  is_bot: boolean;
  first_name: string;
  username: string;
  can_join_groups: boolean;
  can_read_all_group_messages: boolean;
  supports_inline_queries: boolean;
}

async function call<T>(token: string, method: string, body?: object): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${TG_API}/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new Error(`Telegram serveriga ulanib bo'lmadi: ${err instanceof Error ? err.message : String(err)}`);
  }
  const text = await res.text();
  let json: { ok: boolean; result?: T; description?: string };
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Telegram javobi noto'g'ri (HTTP ${res.status}). Tarmoqni tekshiring.`);
  }
  if (!json.ok) throw new Error(json.description ?? `Telegram ${method} xatosi`);
  return json.result as T;
}

export function validateTokenFormat(token: string): boolean {
  return /^\d{6,12}:[A-Za-z0-9_-]{30,}$/.test(token);
}

export async function getMe(token: string): Promise<TgBotInfo> {
  return call<TgBotInfo>(token, "getMe");
}

export async function setWebhook(token: string, url: string, secretToken: string): Promise<true> {
  await call(token, "setWebhook", {
    url,
    secret_token: secretToken,
    allowed_updates: ["message", "callback_query", "pre_checkout_query", "web_app_data"],
  });
  return true;
}

export async function deleteWebhook(token: string): Promise<true> {
  await call(token, "deleteWebhook", { drop_pending_updates: false });
  return true;
}

export async function setChatMenuButton(token: string, miniappUrl: string, label = "Do'kon"): Promise<true> {
  await call(token, "setChatMenuButton", {
    menu_button: { type: "web_app", text: label, web_app: { url: miniappUrl } },
  });
  return true;
}

export async function sendMessage(token: string, chatId: number | string, text: string, extra?: object): Promise<unknown> {
  return call(token, "sendMessage", { chat_id: chatId, text, parse_mode: "HTML", ...extra });
}
