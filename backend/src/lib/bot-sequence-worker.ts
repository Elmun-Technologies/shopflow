/**
 * Bot Voronka (Funnel) Worker
 *
 * Har 5 daqiqada ishga tushadi:
 * 1. nextSendAt <= now bo'lgan enrollments'larni topadi
 * 2. Tegishli sequence step'ni yuboradi
 * 3. Keyingi step'ga o'tkazadi yoki tugallangan deb belgilaydi
 *
 * Trigger'lar:
 * - NEW_CUSTOMER, FIRST_PURCHASE, VIP_STATUS — trigger paytida enrollBotSequence() chaqiriladi
 * - INACTIVE_DAYS — bu worker'da kuniga bir marta tekshiriladi
 * - BIRTHDAY — bu worker'da kuniga bir marta tekshiriladi
 * - WEEKLY — bu worker'da tegishli kunda tekshiriladi
 */

import type { PrismaClient } from "@prisma/client";
import { sendTelegramRaw } from "./telegram-notify.js";

// ─── Enrollment yaratish (trigger paytida chaqiriladi) ────────────────────────

export async function enrollBotSequences(
  prisma: PrismaClient,
  tenantId: string,
  customerId: string,
  trigger: "NEW_CUSTOMER" | "FIRST_PURCHASE" | "VIP_STATUS",
): Promise<void> {
  const sequences = await prisma.botSequence.findMany({
    where: { tenantId, trigger, active: true },
    include: { steps: { orderBy: { stepOrder: "asc" } } },
  });

  for (const seq of sequences) {
    if (seq.steps.length === 0) continue;
    const first = seq.steps[0];
    const nextSendAt = new Date(Date.now() + first.delayHours * 60 * 60 * 1000);

    await prisma.botSequenceEnrollment.upsert({
      where: { sequenceId_customerId: { sequenceId: seq.id, customerId } },
      create: { sequenceId: seq.id, customerId, currentStep: 0, nextSendAt, completed: false },
      update: {},  // Agar allaqachon ro'yxatda bo'lsa, qayta boshlamas
    });
  }
}

// ─── Bot token olish ──────────────────────────────────────────────────────────

async function getTenantBotToken(prisma: PrismaClient, tenantId: string): Promise<string | null> {
  const channel = await prisma.channel.findFirst({
    where: { tenantId, type: "TELEGRAM", active: true },
    select: { config: true },
  });
  if (!channel) return null;
  const cfg = channel.config as { botToken?: string } | null;
  return cfg?.botToken?.trim() || null;
}

// ─── Asosiy worker funksiyasi ─────────────────────────────────────────────────

export async function runBotSequenceWorker(prisma: PrismaClient): Promise<void> {
  const now = new Date();

  // 1. Pending enrollment step'larni yuborish
  await processPendingSteps(prisma, now);

  // 2. INACTIVE_DAYS trigger — har safar tekshiramiz
  await checkInactiveTriggers(prisma, now);

  // 3. BIRTHDAY trigger — bugungi tug'ilgan kunlar
  await checkBirthdayTriggers(prisma, now);

  // 4. WEEKLY trigger — bugun kerakli kun bo'lsa
  await checkWeeklyTriggers(prisma, now);
}

async function processPendingSteps(prisma: PrismaClient, now: Date): Promise<void> {
  const pending = await prisma.botSequenceEnrollment.findMany({
    where: { completed: false, nextSendAt: { lte: now } },
    include: {
      sequence: {
        include: {
          steps: { orderBy: { stepOrder: "asc" } },
          tenant: { select: { id: true } },
        },
      },
      customer: { select: { id: true, tenantId: true, telegramUserId: true } },
    },
    take: 100, // Bir vaqtda ko'pi bilan 100 ta
  });

  for (const enrollment of pending) {
    const { sequence, customer } = enrollment;
    if (!customer.telegramUserId) {
      await prisma.botSequenceEnrollment.update({
        where: { id: enrollment.id },
        data: { completed: true },
      });
      continue;
    }

    const steps = sequence.steps;
    const step = steps[enrollment.currentStep];
    if (!step) {
      await prisma.botSequenceEnrollment.update({
        where: { id: enrollment.id },
        data: { completed: true, nextSendAt: null },
      });
      continue;
    }

    const token = await getTenantBotToken(prisma, customer.tenantId);
    if (!token) continue;

    // Xabar yuborish
    await sendTelegramRaw(token, customer.telegramUserId.toString(), step.message).catch(() => null);

    // Keyingi step
    const nextStepIndex = enrollment.currentStep + 1;
    const nextStep = steps[nextStepIndex];
    if (!nextStep) {
      await prisma.botSequenceEnrollment.update({
        where: { id: enrollment.id },
        data: { completed: true, nextSendAt: null, currentStep: nextStepIndex },
      });
    } else {
      const nextSendAt = new Date(Date.now() + nextStep.delayHours * 60 * 60 * 1000);
      await prisma.botSequenceEnrollment.update({
        where: { id: enrollment.id },
        data: { currentStep: nextStepIndex, nextSendAt },
      });
    }
  }
}

async function checkInactiveTriggers(prisma: PrismaClient, now: Date): Promise<void> {
  const sequences = await prisma.botSequence.findMany({
    where: { trigger: "INACTIVE_DAYS", active: true, inactiveDays: { gt: 0 } },
    include: { steps: { orderBy: { stepOrder: "asc" } }, tenant: { select: { id: true } } },
  });

  for (const seq of sequences) {
    if (!seq.inactiveDays || seq.steps.length === 0) continue;
    const cutoff = new Date(now.getTime() - seq.inactiveDays * 24 * 60 * 60 * 1000);

    const inactiveCustomers = await prisma.customer.findMany({
      where: {
        tenantId: seq.tenantId,
        telegramUserId: { not: null },
        // Oxirgi buyurtmasi cutoff'dan eski yoki umuman buyurtma bermagan
        orders: { none: { createdAt: { gte: cutoff } } },
        // Allaqachon bu sekansga ro'yxatga olinmagan
        botEnrollments: { none: { sequenceId: seq.id } },
      },
      select: { id: true },
      take: 500,
    });

    for (const c of inactiveCustomers) {
      const first = seq.steps[0];
      const nextSendAt = new Date(Date.now() + first.delayHours * 60 * 60 * 1000);
      await prisma.botSequenceEnrollment.upsert({
        where: { sequenceId_customerId: { sequenceId: seq.id, customerId: c.id } },
        create: { sequenceId: seq.id, customerId: c.id, currentStep: 0, nextSendAt },
        update: {},
      });
    }
  }
}

async function checkBirthdayTriggers(prisma: PrismaClient, now: Date): Promise<void> {
  const sequences = await prisma.botSequence.findMany({
    where: { trigger: "BIRTHDAY", active: true },
    include: { steps: { orderBy: { stepOrder: "asc" } } },
  });

  for (const seq of sequences) {
    if (seq.steps.length === 0) continue;
    const todayMonth = now.getMonth() + 1;
    const todayDay = now.getDate();

    // Bugun tug'ilgan kunlari bo'lgan, telegram ID'si bor mijozlar
    const customers = await prisma.customer.findMany({
      where: {
        tenantId: seq.tenantId,
        telegramUserId: { not: null },
        birthDate: { not: null },
      },
      select: { id: true, birthDate: true },
    });

    for (const c of customers) {
      if (!c.birthDate) continue;
      const bDay = new Date(c.birthDate);
      if (bDay.getMonth() + 1 !== todayMonth || bDay.getDate() !== todayDay) continue;

      // Bugun allaqachon yuborilmagan bo'lsa — yangi enrollment
      const existing = await prisma.botSequenceEnrollment.findUnique({
        where: { sequenceId_customerId: { sequenceId: seq.id, customerId: c.id } },
      });
      // Har yil qayta enrollment (completed bo'lsa ham)
      if (existing && existing.enrolledAt.getFullYear() === now.getFullYear()) continue;

      const first = seq.steps[0];
      const nextSendAt = new Date(Date.now() + first.delayHours * 60 * 60 * 1000);
      if (existing) {
        await prisma.botSequenceEnrollment.update({
          where: { id: existing.id },
          data: { currentStep: 0, nextSendAt, completed: false, enrolledAt: now },
        });
      } else {
        await prisma.botSequenceEnrollment.create({
          data: { sequenceId: seq.id, customerId: c.id, currentStep: 0, nextSendAt, enrolledAt: now },
        });
      }
    }
  }
}

async function checkWeeklyTriggers(prisma: PrismaClient, now: Date): Promise<void> {
  const todayWeekDay = now.getDay(); // 0=Yak, 1=Du, ..., 5=Ju, 6=Sha

  const sequences = await prisma.botSequence.findMany({
    where: { trigger: "WEEKLY", active: true, weekDay: todayWeekDay },
    include: { steps: { orderBy: { stepOrder: "asc" } } },
  });

  for (const seq of sequences) {
    if (seq.steps.length === 0) continue;

    // Bugun allaqachon yuborilgan bo'lsa o'tkazib yuborish
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const customers = await prisma.customer.findMany({
      where: {
        tenantId: seq.tenantId,
        telegramUserId: { not: null },
        botEnrollments: {
          none: { sequenceId: seq.id, enrolledAt: { gte: todayStart } },
        },
      },
      select: { id: true },
      take: 1000,
    });

    for (const c of customers) {
      const first = seq.steps[0];
      const nextSendAt = new Date(Date.now() + first.delayHours * 60 * 60 * 1000);
      await prisma.botSequenceEnrollment.create({
        data: { sequenceId: seq.id, customerId: c.id, currentStep: 0, nextSendAt },
      }).catch(() => null); // ignore unique constraint if somehow duplicated
    }
  }
}

// ─── Worker starter ───────────────────────────────────────────────────────────

export function startBotSequenceWorker(prisma: PrismaClient, log: { info: (msg: string) => void; error: (obj: object, msg: string) => void }): NodeJS.Timeout {
  log.info("[bot-sequence-worker] started — runs every 5 minutes");
  const interval = setInterval(async () => {
    try {
      await runBotSequenceWorker(prisma);
    } catch (err) {
      log.error({ err }, "[bot-sequence-worker] tick error");
    }
  }, 5 * 60 * 1000);

  // Birinchi marta darhol ishga tushirish
  runBotSequenceWorker(prisma).catch((err) => log.error({ err }, "[bot-sequence-worker] initial run error"));

  return interval;
}
