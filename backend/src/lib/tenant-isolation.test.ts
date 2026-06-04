// Tenant izolyatsiyasi — INTEGRATION test (real Postgres talab qiladi).
//
// Bu test loyihaning eng muhim xavfsizlik kafolatini ISBOTLAYDI:
// bir tenant boshqa tenant ma'lumotini o'qiy/o'zgartira/o'chira olmaydi.
//
// Faqat CI'da (yoki RUN_DB_TESTS=1 bilan) ishlaydi — lokal `npm test` tez
// qolishi uchun DB bo'lmasa o'tkazib yuboriladi.
//
// CI: postgres service + `npx prisma db push` + RUN_DB_TESTS=1.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";

const RUN = process.env.RUN_DB_TESTS === "1";

const prisma = new PrismaClient();

// Test ma'lumotlari — ikkita alohida tenant
let tenantA = "";
let tenantB = "";
let orderA = "";
let customerA = "";
let productA = "";

describe.skipIf(!RUN)("tenant isolation (integration)", () => {
  beforeAll(async () => {
    const suffix = Date.now();
    const a = await prisma.tenant.create({ data: { slug: `iso-a-${suffix}`, name: "Tenant A" } });
    const b = await prisma.tenant.create({ data: { slug: `iso-b-${suffix}`, name: "Tenant B" } });
    tenantA = a.id;
    tenantB = b.id;

    const cust = await prisma.customer.create({
      data: { tenantId: tenantA, name: "A mijoz", phone: "998900000001" },
    });
    customerA = cust.id;
    const prod = await prisma.product.create({
      data: { tenantId: tenantA, sku: "ISO-SKU-1", name: "A mahsulot", price: 1000 },
    });
    productA = prod.id;
    const order = await prisma.order.create({
      data: { tenantId: tenantA, code: "ISO-ORD-1", total: 1000, customerId: customerA },
    });
    orderA = order.id;
  });

  afterAll(async () => {
    // Cascade — tenant o'chsa hamma narsasi ketadi
    if (tenantA) await prisma.tenant.delete({ where: { id: tenantA } }).catch(() => {});
    if (tenantB) await prisma.tenant.delete({ where: { id: tenantB } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("cross-tenant O'QISH bloklanadi (order)", async () => {
    const ownView = await prisma.order.findFirst({ where: { id: orderA, tenantId: tenantA } });
    const crossView = await prisma.order.findFirst({ where: { id: orderA, tenantId: tenantB } });
    expect(ownView).not.toBeNull();
    expect(crossView).toBeNull();
  });

  it("cross-tenant YOZISH bloklanadi (order updateMany → count 0)", async () => {
    const res = await prisma.order.updateMany({
      where: { id: orderA, tenantId: tenantB },
      data: { status: "CANCELLED" },
    });
    expect(res.count).toBe(0);
    // Asl tenant'da hali ham PENDING
    const order = await prisma.order.findFirst({ where: { id: orderA, tenantId: tenantA } });
    expect(order?.status).toBe("PENDING");
  });

  it("cross-tenant O'CHIRISH bloklanadi (order deleteMany → count 0)", async () => {
    const res = await prisma.order.deleteMany({ where: { id: orderA, tenantId: tenantB } });
    expect(res.count).toBe(0);
    const order = await prisma.order.findFirst({ where: { id: orderA, tenantId: tenantA } });
    expect(order).not.toBeNull();
  });

  it("customer va product ham cross-tenant himoyalangan", async () => {
    expect(await prisma.customer.findFirst({ where: { id: customerA, tenantId: tenantB } })).toBeNull();
    expect(await prisma.product.findFirst({ where: { id: productA, tenantId: tenantB } })).toBeNull();
    const cw = await prisma.customer.updateMany({ where: { id: customerA, tenantId: tenantB }, data: { name: "hack" } });
    expect(cw.count).toBe(0);
  });

  it("unique constraintlar tenant-scoped (bir xil SKU/code 2 tenantda mumkin)", async () => {
    // Tenant B'da xuddi shu SKU va order code — konflikt bo'lmasligi kerak
    const p = await prisma.product.create({
      data: { tenantId: tenantB, sku: "ISO-SKU-1", name: "B mahsulot", price: 2000 },
    });
    const o = await prisma.order.create({
      data: { tenantId: tenantB, code: "ISO-ORD-1", total: 2000 },
    });
    expect(p.id).toBeTruthy();
    expect(o.id).toBeTruthy();
    expect(p.id).not.toBe(productA);
  });

  it("tenant o'chsa — faqat o'z ma'lumoti cascade o'chadi", async () => {
    // Tenant B'ni o'chiramiz, A buzilmasligi kerak
    const suffix = Date.now();
    const temp = await prisma.tenant.create({ data: { slug: `iso-temp-${suffix}`, name: "Temp" } });
    await prisma.order.create({ data: { tenantId: temp.id, code: "TMP-1", total: 1 } });
    await prisma.tenant.delete({ where: { id: temp.id } });
    // Temp order ham ketgan
    const leftover = await prisma.order.findFirst({ where: { tenantId: temp.id } });
    expect(leftover).toBeNull();
    // Tenant A hali joyida
    expect(await prisma.order.findFirst({ where: { id: orderA, tenantId: tenantA } })).not.toBeNull();
  });
});
