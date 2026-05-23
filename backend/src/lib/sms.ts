// SMS yuborish — Eskiz (eskiz.uz) va Ucell provayderlar
// Eskiz: nikname + message + mobilePhone API
// Ucell: operator SMPP/REST

interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ─── Eskiz ────────────────────────────────────────────────────────────────
interface EskizConfig {
  login: string;
  password: string;
  from: string; // SMS nomi (masalan, "ShopFlow")
}

export async function sendSmsEskiz(
  config: EskizConfig,
  phone: string,
  message: string,
): Promise<SmsResult> {
  try {
    // Token olish
    const authRes = await fetch("https://notify.eskiz.uz/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: config.login, password: config.password }),
    });
    if (!authRes.ok) return { success: false, error: `Eskiz auth xatosi: ${authRes.status}` };
    const authData = await authRes.json() as { data?: { token?: string } };
    const token = authData.data?.token;
    if (!token) return { success: false, error: "Eskiz token olinmadi" };

    // SMS yuborish
    const normalized = normalizeUzPhone(phone);
    const smsRes = await fetch("https://notify.eskiz.uz/api/message/sms/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        mobile_phone: normalized,
        message,
        from: config.from,
        callback_url: null,
      }),
    });
    const smsData = await smsRes.json() as { id?: string; status?: string; message?: string };
    if (!smsRes.ok || smsData.status === "error") {
      return { success: false, error: smsData.message ?? `HTTP ${smsRes.status}` };
    }
    return { success: true, messageId: smsData.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Noma'lum xato" };
  }
}

// Uzbekiston telefon raqamini 998XXXXXXXXX formatiga keltirish
export function normalizeUzPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("998") && digits.length === 12) return digits;
  if (digits.startsWith("8") && digits.length === 11) return "7" + digits.slice(1);
  if (digits.length === 9) return "998" + digits;
  return digits;
}

// ─── Bulk SMS (bir necha raqamga) ─────────────────────────────────────────
export async function sendBulkSmsEskiz(
  config: EskizConfig,
  phones: string[],
  message: string,
): Promise<{ sent: number; failed: number; errors: string[] }> {
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  // Eskiz bulk endpoint (to'partiy)
  try {
    const authRes = await fetch("https://notify.eskiz.uz/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: config.login, password: config.password }),
    });
    const authData = await authRes.json() as { data?: { token?: string } };
    const token = authData.data?.token;
    if (!token) throw new Error("Token olinmadi");

    // Batch — 100 ta parallel
    const BATCH = 100;
    for (let i = 0; i < phones.length; i += BATCH) {
      const batch = phones.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        batch.map(async (phone) => {
          const normalized = normalizeUzPhone(phone);
          const res = await fetch("https://notify.eskiz.uz/api/message/sms/send", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({
              mobile_phone: normalized,
              message,
              from: config.from,
            }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status} for ${phone}`);
          return res.json();
        }),
      );
      for (const r of results) {
        if (r.status === "fulfilled") sent++;
        else { failed++; errors.push(r.reason instanceof Error ? r.reason.message : String(r.reason)); }
      }
    }
  } catch (err) {
    failed = phones.length - sent;
    errors.push(err instanceof Error ? err.message : "Bulk SMS xatosi");
  }

  return { sent, failed, errors: errors.slice(0, 10) };
}
