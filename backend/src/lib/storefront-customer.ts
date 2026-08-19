// Storefront B2C mijoz identifikatsiyasi.
// Mini App profili Telegram ID bilan, checkout esa telefon bilan mijoz yaratishi
// mumkin — natijada buyurtma boshqa yozuvda qolib, "Buyurtmalarim" bo'sh chiqadi.

export function phoneDigits(phone: string | null | undefined): string {
  return (phone ?? "").replace(/\D/g, "");
}

/** Saqlash uchun barqaror format: +998901234567 */
export function canonicalPhone(phone: string | null | undefined): string | null {
  let digits = phoneDigits(phone);
  if (!digits) return null;
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (!digits.startsWith("998") && digits.length === 9) digits = `998${digits}`;
  if (digits.length < 9) return `+${digits}`;
  return `+${digits.slice(0, 12)}`;
}

/** Bazadagi turli formatlarni topish uchun variantlar. */
export function phoneLookupVariants(phone: string | null | undefined): string[] {
  const raw = (phone ?? "").trim();
  const digits = phoneDigits(raw);
  if (!digits && !raw) return [];

  let national = digits;
  if (national.startsWith("0")) national = national.slice(1);
  if (national.startsWith("998") && national.length >= 12) national = national.slice(3);

  const full = national.length === 9 ? `998${national}` : digits;
  const nat = full.startsWith("998") && full.length >= 12 ? full.slice(3) : national;
  const pretty =
    nat.length >= 9
      ? `+998 ${nat.slice(0, 2)} ${nat.slice(2, 5)} ${nat.slice(5, 7)} ${nat.slice(7, 9)}`
      : "";

  return [...new Set([raw, digits, full, `+${full}`, nat, pretty, canonicalPhone(raw) ?? ""].filter(Boolean))];
}

export interface CustomerIdentityRow {
  id: string;
  phone: string | null;
  telegramUserId: bigint | null;
}

type CustomerFinder = {
  customer: {
    findMany: (args: {
      where: Record<string, unknown>;
      select: { id: true; phone: true; telegramUserId: true };
    }) => Promise<CustomerIdentityRow[]>;
  };
};

/** Telegram ID va/yoki telefon bo'yicha barcha bog'liq mijoz yozuvlari. */
export async function findRelatedCustomers(
  prisma: CustomerFinder,
  tenantId: string,
  opts: { telegramUserId?: bigint | null; phone?: string | null },
): Promise<CustomerIdentityRow[]> {
  const seen = new Map<string, CustomerIdentityRow>();

  if (opts.telegramUserId) {
    const rows = await prisma.customer.findMany({
      where: { tenantId, telegramUserId: opts.telegramUserId },
      select: { id: true, phone: true, telegramUserId: true },
    });
    for (const r of rows) seen.set(r.id, r);
  }

  const phones = new Set<string>();
  if (opts.phone) for (const v of phoneLookupVariants(opts.phone)) phones.add(v);
  for (const r of seen.values()) {
    if (r.phone) for (const v of phoneLookupVariants(r.phone)) phones.add(v);
  }

  if (phones.size > 0) {
    const rows = await prisma.customer.findMany({
      where: { tenantId, phone: { in: [...phones] } },
      select: { id: true, phone: true, telegramUserId: true },
    });
    for (const r of rows) seen.set(r.id, r);
  }

  return [...seen.values()];
}

export function pickCanonicalCustomer(rows: CustomerIdentityRow[]): CustomerIdentityRow | null {
  if (rows.length === 0) return null;
  const withTg = rows.find((r) => r.telegramUserId != null);
  return withTg ?? rows[0];
}

type CustomerMutator = CustomerFinder & {
  customer: CustomerFinder["customer"] & {
    update: (args: {
      where: { id: string };
      data: { phone?: string; telegramUserId?: bigint; language?: string; name?: string };
    }) => Promise<unknown>;
  };
  order: {
    updateMany: (args: {
      where: { tenantId: string; customerId: string };
      data: { customerId: string };
    }) => Promise<unknown>;
  };
};

/** Buyurtmalarni bitta "asosiy" mijozga yig'adi (Telegram ID ustun). */
export async function mergeRelatedCustomerOrders(
  prisma: CustomerMutator,
  tenantId: string,
  canonicalId: string,
  related: CustomerIdentityRow[],
): Promise<void> {
  for (const row of related) {
    if (row.id === canonicalId) continue;
    await prisma.order.updateMany({
      where: { tenantId, customerId: row.id },
      data: { customerId: canonicalId },
    });
  }
}
