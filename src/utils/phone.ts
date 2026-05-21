// O'zbekiston telefon raqami formatlash yordamchilari.
// Maqsad: foydalanuvchi qanday ko'rinishda kiritsa ham, oddiy chiroyli
// "+998 90 123 45 67" formatiga keltiramiz. Backend'ga oddiy raqamlar ketadi.

const UZ_COUNTRY_CODE = "998";

/** Raqamdan tashqari hammasini olib tashlaydi. */
export function normalizeDigits(input: string): string {
  return input.replace(/\D/g, "");
}

/**
 * Foydalanuvchi inputini O'zbekiston formatiga keltiradi: +998 XX XXX XX XX
 * - "998901234567" → "+998 90 123 45 67"
 * - "901234567" → "+998 90 123 45 67"
 * - "+998901234567" → "+998 90 123 45 67"
 * - kam belgi bo'lsa qancha mavjud bo'lsa shuncha format qilinadi
 */
export function formatUzPhone(input: string): string {
  let digits = normalizeDigits(input);

  // Foydalanuvchi 998 prefiksini kiritmasa qo'shamiz
  if (digits.length > 0 && !digits.startsWith(UZ_COUNTRY_CODE)) {
    // "0" bilan boshlanishi mumkin (eski format) — olib tashlaymiz
    if (digits.startsWith("0")) digits = digits.slice(1);
    digits = UZ_COUNTRY_CODE + digits;
  }

  // Maksimal 12 ta raqam (998 + 9 ta milliy)
  digits = digits.slice(0, 12);

  if (digits.length === 0) return "";

  // Format qismlarga ajratamiz: 998 XX XXX XX XX
  const cc = digits.slice(0, 3);
  const op = digits.slice(3, 5);
  const a = digits.slice(5, 8);
  const b = digits.slice(8, 10);
  const c = digits.slice(10, 12);

  let result = `+${cc}`;
  if (op) result += ` ${op}`;
  if (a) result += ` ${a}`;
  if (b) result += ` ${b}`;
  if (c) result += ` ${c}`;
  return result;
}

/** To'liq O'zbekiston telefon raqami formatda ekanligini tekshiradi. */
export function isValidUzPhone(input: string): boolean {
  const digits = normalizeDigits(input);
  // 998 + 9 raqam = 12
  if (digits.length !== 12) return false;
  if (!digits.startsWith(UZ_COUNTRY_CODE)) return false;
  // Operator kodi 9X yoki 6X (mobil), 7X (CDMA), 88X, 99X — keng ruxsat beramiz
  const op = digits.slice(3, 5);
  return /^[3-9]\d$/.test(op);
}

/** Backend'ga yuborish uchun standart format: "+998901234567" */
export function toE164Uz(input: string): string {
  const digits = normalizeDigits(input);
  if (digits.length === 0) return "";
  let d = digits;
  if (!d.startsWith(UZ_COUNTRY_CODE)) {
    if (d.startsWith("0")) d = d.slice(1);
    d = UZ_COUNTRY_CODE + d;
  }
  return `+${d.slice(0, 12)}`;
}
