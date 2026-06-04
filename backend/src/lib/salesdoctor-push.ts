// Sales Doctor'ga buyurtma/mijoz/mahsulot push qilish.
// Fire-and-forget: hech qachon throw qilmaymiz — barcha xato audit'ga yoziladi,
// va SalesDoctorRetry table'ga PENDING bo'lib qo'shiladi. Worker keyin urinadi.

import type { PrismaClient, Prisma } from "@prisma/client";
import { SalesDoctorClient, SalesDoctorError, loginToSalesDoctor } from "./salesdoctor-client.js";
import { encryptSecret, decryptSecret } from "./secret-cipher.js";
import { logAudit } from "./audit.js";

type OrderStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "CANCELLED" | "REFUNDED";

const DEFAULT_STATUS_MAP: Record<OrderStatus, number> = {
  PENDING: 1,    // New
  PROCESSING: 2, // Sent
  COMPLETED: 3,  // Delivered
  CANCELLED: 5,  // Cancelled
  REFUNDED: 5,   // Faqat fallback — REFUNDED odatda pushOrderRefund() (setOrderDefect) bilan ketadi
};

function mapStatus(status: OrderStatus, override: Prisma.JsonValue | null): number {
  if (override && typeof override === "object" && !Array.isArray(override)) {
    const map = override as Record<string, unknown>;
    const v = map[status];
    if (typeof v === "number") return v;
  }
  return DEFAULT_STATUS_MAP[status];
}

interface SalesDoctorAccountRow {
  id: string;
  tenantId: string;
  domain: string;
  login: string;
  encryptedPassword: string;
  encryptedToken: string | null;
  userId: string | null;
  status: string;
  defaultAgentSdId: string | null;
  defaultPriceTypeSdId: string | null;
  defaultWarehouseSdId: string | null;
  statusMap: Prisma.JsonValue | null;
}

/** Account uchun tayyor SD client. Token yo'q yoki eskirgan bo'lsa qaytadan login qiladi. */
async function getClient(
  prisma: PrismaClient,
  account: SalesDoctorAccountRow,
): Promise<SalesDoctorClient> {
  if (account.userId && account.encryptedToken) {
    try {
      const token = decryptSecret(account.encryptedToken);
      return new SalesDoctorClient(account.domain, account.userId, token);
    } catch {
      // Encryption key o'zgargan bo'lishi mumkin — qaytadan login qilamiz
    }
  }
  // Login qilib token saqlaymiz
  const password = decryptSecret(account.encryptedPassword);
  const login = await loginToSalesDoctor(account.domain, account.login, password);
  await prisma.salesDoctorAccount.update({
    where: { id: account.id },
    data: {
      userId: login.userId,
      encryptedToken: encryptSecret(login.token),
      status: "CONNECTED",
      lastError: null,
    },
  });
  return new SalesDoctorClient(account.domain, login.userId, login.token);
}

async function getAccount(prisma: PrismaClient, tenantId: string): Promise<SalesDoctorAccountRow | null> {
  const row = await prisma.salesDoctorAccount.findUnique({ where: { tenantId } });
  if (!row || row.status === "DISCONNECTED") return null;
  return row as unknown as SalesDoctorAccountRow;
}

/** Telefon raqamini normalize qilamiz — qidirishda bir xil format ishlatish uchun.
 *  Faqat raqamlar qoldiriladi; 9 ta oxirgi belgi olinadi (998 prefiks ham, +998 ham ishlaydi). */
export function normalizePhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 0) return null;
  return digits.length > 9 ? digits.slice(-9) : digits;
}

async function queueRetry(
  prisma: PrismaClient,
  tenantId: string,
  resourceType: string,
  resourceId: string,
  method: string,
  payload: Prisma.InputJsonValue,
  err: unknown,
): Promise<void> {
  const errMsg = err instanceof Error ? err.message : String(err);
  try {
    await prisma.salesDoctorRetry.create({
      data: {
        tenantId,
        resourceType,
        resourceId,
        method,
        payload,
        status: "PENDING",
        attempts: 0,
        lastError: errMsg,
        nextAttemptAt: new Date(Date.now() + 60_000), // 1 daqiqa keyin birinchi urinish
      },
    });
  } catch (queueErr) {
    console.warn("[salesdoctor] failed to queue retry", queueErr);
  }
  await logAudit({
    prisma,
    tenantId,
    action: "SD_PUSH_FAILED",
    resourceType,
    resourceId,
    summary: `Sales Doctor push xato: ${errMsg.slice(0, 200)}`,
    changes: { method, error: errMsg },
  });
}

/** Customer SD'da mavjud yoki yaratish. Telefonga qarab match qilamiz; yo'q bo'lsa setClient. */
export async function ensureCustomerInSD(
  client: SalesDoctorClient,
  prisma: PrismaClient,
  customerId: string,
  tenantId: string,
): Promise<string | null> {
  // Defense-in-depth: tenantId bilan birga qidiramiz — caller'lar har doim
  // tenant-validatsiya qilingan id beradi, lekin bu qatlam yana himoya beradi
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenantId },
    select: { id: true, name: true, phone: true, location: true, salesDoctorId: true, tenantId: true },
  });
  if (!customer) return null;
  if (customer.salesDoctorId) return customer.salesDoctorId;

  // 1. Phone bo'yicha SD'da qidirish
  const phone = normalizePhone(customer.phone);
  if (phone) {
    try {
      const matches = await client.getClients({ phone });
      const hit = matches.find((c) => normalizePhone(c.phone) === phone);
      if (hit?.SD_id) {
        await prisma.customer.update({
          where: { id: customer.id },
          data: { salesDoctorId: hit.SD_id },
        });
        return hit.SD_id;
      }
    } catch {
      // Qidiruv xato bersa, davom etamiz — setClient orqali yaratamiz
    }
  }

  // 2. SD'da yaratish — code_1C uchun bizning Customer.id ni ishlatamiz
  //    (keyingi marta uni bo'yicha topiladi).
  await client.setClient({
    code_1C: customer.id,
    name: customer.name,
    phone: customer.phone ?? undefined,
    address: customer.location ?? undefined,
  });
  // SD setClient response'da SD_id qaytarmaydi — code_1C bizning ID, shuni saqlaymiz
  // va keyingi setOrder'da `client.code_1C` orqali link qilamiz.
  return null;
}

/** Product SD'da mavjud yoki yaratish. SKU = code_1C deb hisoblaymiz. */
export async function ensureProductInSD(
  client: SalesDoctorClient,
  prisma: PrismaClient,
  productId: string,
  tenantId: string,
): Promise<string | null> {
  const product = await prisma.product.findFirst({
    where: { id: productId, tenantId },
    select: { id: true, name: true, sku: true, salesDoctorId: true },
  });
  if (!product) return null;
  if (product.salesDoctorId) return product.salesDoctorId;

  // SKU bo'yicha qidirish
  try {
    const matches = await client.getProducts({ code_1C: product.sku });
    const hit = matches.find((p) => p.code_1C === product.sku);
    if (hit?.SD_id) {
      await prisma.product.update({
        where: { id: product.id },
        data: { salesDoctorId: hit.SD_id },
      });
      return hit.SD_id;
    }
  } catch {
    // davom etamiz
  }

  // SD'da yaratish — code_1C = SKU
  await client.setProduct({
    code_1C: product.sku,
    name: product.name,
  });
  return null; // SD_id keyingi sync'da yaratilgach link bo'ladi
}

/** Buyurtmani Sales Doctor'ga push qilish. Fire-and-forget — throw qilmaydi. */
export async function pushOrderToSalesDoctor(
  prisma: PrismaClient,
  tenantId: string,
  orderId: string,
): Promise<void> {
  let account: SalesDoctorAccountRow | null = null;
  try {
    account = await getAccount(prisma, tenantId);
    if (!account) return; // Integration o'rnatilmagan — skip

    if (!account.defaultAgentSdId || !account.defaultPriceTypeSdId || !account.defaultWarehouseSdId) {
      await logAudit({
        prisma,
        tenantId,
        action: "SD_PUSH_SKIPPED",
        resourceType: "order",
        resourceId: orderId,
        summary: "Default agent/priceType/warehouse tanlanmagan — Settings'da sozlang",
      });
      return;
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, tenantId },
      include: {
        customer: { select: { id: true, name: true, phone: true, salesDoctorId: true } },
        items: { include: { product: { select: { id: true, name: true, sku: true, salesDoctorId: true } } } },
      },
    });
    if (!order) return;
    if (!order.customer) {
      // Mijozsiz buyurtma SD'ga yuborilmaydi
      await logAudit({
        prisma,
        tenantId,
        action: "SD_PUSH_SKIPPED",
        resourceType: "order",
        resourceId: orderId,
        summary: "Buyurtmada mijoz yo'q — SD'ga yuborilmadi",
      });
      return;
    }

    const client = await getClient(prisma, account);

    // 1. Customer ensure
    await ensureCustomerInSD(client, prisma, order.customer.id, tenantId);

    // 2. Har bir product ensure
    for (const item of order.items) {
      if (item.product) {
        await ensureProductInSD(client, prisma, item.product.id, tenantId);
      }
    }

    // 3. setOrder chaqirish
    const sdStatus = mapStatus(order.status as OrderStatus, account.statusMap);
    const orderProducts = order.items.map((item) => ({
      product: item.product?.salesDoctorId
        ? { SD_id: item.product.salesDoctorId }
        : { code_1C: item.product?.sku ?? item.productId },
      quantity: item.qty,
      price: Number(item.price),
    }));

    const payload = {
      code_1C: order.code, // ShopFlow order code (ORD-1234)
      status: sdStatus,
      dateCreate: order.createdAt.toISOString().replace("T", " ").slice(0, 19),
      comment: order.notes ?? undefined,
      client: order.customer.salesDoctorId
        ? { SD_id: order.customer.salesDoctorId }
        : { code_1C: order.customer.id },
      agent: { SD_id: account.defaultAgentSdId },
      priceType: { SD_id: account.defaultPriceTypeSdId },
      warehouse: { SD_id: account.defaultWarehouseSdId },
      orderProducts,
    };

    await client.setOrder(payload);

    await prisma.order.update({
      where: { id: order.id },
      data: { pushedToSalesDoctor: true },
    });

    await prisma.salesDoctorAccount.update({
      where: { id: account.id },
      data: { lastSyncAt: new Date(), lastError: null },
    });

    await logAudit({
      prisma,
      tenantId,
      action: "SD_PUSH_SUCCESS",
      resourceType: "order",
      resourceId: orderId,
      summary: `Buyurtma Sales Doctor'ga yuborildi (status ${sdStatus})`,
    });
  } catch (err) {
    await queueRetry(
      prisma,
      tenantId,
      "order",
      orderId,
      "setOrder",
      { orderId } as Prisma.InputJsonValue,
      err,
    );
    if (account && err instanceof SalesDoctorError && err.httpStatus === 401) {
      // Token eskirgan — uni o'chirib qo'yamiz, keyingi push qaytadan login qiladi
      await prisma.salesDoctorAccount.update({
        where: { id: account.id },
        data: { encryptedToken: null, lastError: err.message },
      });
    }
  }
}

/** Buyurtma statusi o'zgarganda SD'ga setStatus. */
export async function pushOrderStatus(
  prisma: PrismaClient,
  tenantId: string,
  orderId: string,
  newStatus: OrderStatus,
): Promise<void> {
  let account: SalesDoctorAccountRow | null = null;
  try {
    account = await getAccount(prisma, tenantId);
    if (!account) return;

    const order = await prisma.order.findFirst({
      where: { id: orderId, tenantId },
      select: { id: true, code: true, salesDoctorId: true, pushedToSalesDoctor: true },
    });
    if (!order) return;

    // Hali SD'ga umuman yuborilmagan bo'lsa — to'liq push qilamiz, status emas
    if (!order.pushedToSalesDoctor) {
      return pushOrderToSalesDoctor(prisma, tenantId, orderId);
    }

    // REFUNDED — oddiy status o'zgartirish emas, balki vozvrat hujjati (setOrderDefect):
    // tovar SD omboriga qaytadi, qoldiq tiklanadi.
    if (newStatus === "REFUNDED") {
      return pushOrderRefund(prisma, tenantId, orderId);
    }

    const client = await getClient(prisma, account);
    const sdStatus = mapStatus(newStatus, account.statusMap);

    await client.setStatus({
      code_1C: order.code,
      status: sdStatus,
    });

    await logAudit({
      prisma,
      tenantId,
      action: "SD_STATUS_PUSH_SUCCESS",
      resourceType: "order",
      resourceId: orderId,
      summary: `Status SD'da yangilandi → ${sdStatus}`,
    });
  } catch (err) {
    await queueRetry(
      prisma,
      tenantId,
      "order",
      orderId,
      "setStatus",
      { orderId, newStatus } as Prisma.InputJsonValue,
      err,
    );
  }
}

// Vozvrat hujjati uchun SD status — "New" (1): SD operatori qabul qiladi.
// statusMap'da "REFUND_DEFECT" kaliti bilan o'zgartirish mumkin (masalan 4 = Closed).
const DEFAULT_DEFECT_STATUS = 1;

/**
 * Buyurtma REFUNDED bo'lganda SD'ga vozvrat (setOrderDefect) yuboramiz.
 * Buyurtma asl holatida qoladi (masalan Delivered), defect hujjati esa
 * tovarni omborga qaytaradi — qoldiq tiklanadi. setOrder bilan bir xil
 * client/agent/priceType/warehouse ishlatiladi.
 */
export async function pushOrderRefund(
  prisma: PrismaClient,
  tenantId: string,
  orderId: string,
): Promise<void> {
  let account: SalesDoctorAccountRow | null = null;
  try {
    account = await getAccount(prisma, tenantId);
    if (!account) return;

    if (!account.defaultAgentSdId || !account.defaultPriceTypeSdId || !account.defaultWarehouseSdId) {
      await logAudit({
        prisma,
        tenantId,
        action: "SD_REFUND_SKIPPED",
        resourceType: "order",
        resourceId: orderId,
        summary: "Default agent/priceType/warehouse tanlanmagan — Settings'da sozlang",
      });
      return;
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, tenantId },
      include: {
        customer: { select: { id: true, name: true, phone: true, salesDoctorId: true } },
        items: { include: { product: { select: { id: true, name: true, sku: true, salesDoctorId: true } } } },
      },
    });
    if (!order) return;
    if (!order.customer) {
      await logAudit({
        prisma,
        tenantId,
        action: "SD_REFUND_SKIPPED",
        resourceType: "order",
        resourceId: orderId,
        summary: "Buyurtmada mijoz yo'q — vozvrat yuborilmadi",
      });
      return;
    }

    const client = await getClient(prisma, account);

    // Mijoz va mahsulotlar SD'da mavjudligini ta'minlaymiz (odatda allaqachon bor)
    await ensureCustomerInSD(client, prisma, order.customer.id, tenantId);
    for (const item of order.items) {
      if (item.product) {
        await ensureProductInSD(client, prisma, item.product.id, tenantId);
      }
    }

    // Vozvrat status — statusMap'da "REFUND_DEFECT" kaliti bo'lsa undan, aks holda default (1)
    let defectStatus = DEFAULT_DEFECT_STATUS;
    const sm = account.statusMap;
    if (sm && typeof sm === "object" && !Array.isArray(sm)) {
      const v = (sm as Record<string, unknown>)["REFUND_DEFECT"];
      if (typeof v === "number") defectStatus = v;
    }

    const defectProducts = order.items.map((item) => ({
      product: item.product?.salesDoctorId
        ? { SD_id: item.product.salesDoctorId }
        : { code_1C: item.product?.sku ?? item.productId },
      quantity: item.qty,
      price: Number(item.price),
    }));

    await client.setOrderDefect({
      code_1C: `${order.code}-RET`, // Vozvrat hujjati — buyurtma kodidan alohida
      status: defectStatus,
      dateCreate: new Date().toISOString().replace("T", " ").slice(0, 19),
      dateDefect: new Date().toISOString().slice(0, 10),
      comment: `Vozvrat: buyurtma #${order.code}${order.notes ? ` — ${order.notes}` : ""}`,
      client: order.customer.salesDoctorId
        ? { SD_id: order.customer.salesDoctorId }
        : { code_1C: order.customer.id },
      agent: { SD_id: account.defaultAgentSdId },
      priceType: { SD_id: account.defaultPriceTypeSdId },
      warehouse: { SD_id: account.defaultWarehouseSdId },
      defectProducts,
    });

    await prisma.salesDoctorAccount.update({
      where: { id: account.id },
      data: { lastSyncAt: new Date(), lastError: null },
    });

    await logAudit({
      prisma,
      tenantId,
      action: "SD_REFUND_SUCCESS",
      resourceType: "order",
      resourceId: orderId,
      summary: `Vozvrat Sales Doctor'ga yuborildi (${order.items.length} ta tovar omborga qaytdi)`,
    });
  } catch (err) {
    await queueRetry(
      prisma,
      tenantId,
      "order",
      orderId,
      "setOrderDefect",
      { orderId } as Prisma.InputJsonValue,
      err,
    );
    if (account && err instanceof SalesDoctorError && err.httpStatus === 401) {
      await prisma.salesDoctorAccount.update({
        where: { id: account.id },
        data: { encryptedToken: null, lastError: err.message },
      });
    }
  }
}

/** Product create/update'da SD'ga yuborish. */
export async function pushProductToSD(
  prisma: PrismaClient,
  tenantId: string,
  productId: string,
): Promise<void> {
  try {
    const account = await getAccount(prisma, tenantId);
    if (!account) return;

    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId },
      select: { id: true, name: true, sku: true, salesDoctorId: true },
    });
    if (!product) return;

    const client = await getClient(prisma, account);
    await client.setProduct({
      code_1C: product.sku,
      name: product.name,
    });

    await logAudit({
      prisma,
      tenantId,
      action: "SD_PUSH_SUCCESS",
      resourceType: "product",
      resourceId: productId,
      summary: `Mahsulot SD'ga yuborildi: ${product.name}`,
    });
  } catch (err) {
    await queueRetry(
      prisma,
      tenantId,
      "product",
      productId,
      "setProduct",
      { productId } as Prisma.InputJsonValue,
      err,
    );
  }
}

/** Customer create/update'da SD'ga yuborish. */
export async function pushCustomerToSD(
  prisma: PrismaClient,
  tenantId: string,
  customerId: string,
): Promise<void> {
  try {
    const account = await getAccount(prisma, tenantId);
    if (!account) return;
    const client = await getClient(prisma, account);
    await ensureCustomerInSD(client, prisma, customerId, tenantId);
  } catch (err) {
    await queueRetry(
      prisma,
      tenantId,
      "customer",
      customerId,
      "setClient",
      { customerId } as Prisma.InputJsonValue,
      err,
    );
  }
}
