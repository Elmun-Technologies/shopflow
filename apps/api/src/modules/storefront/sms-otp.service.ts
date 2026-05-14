import { BadRequestException, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import axios from "axios";
import { randomInt } from "node:crypto";
import Redis from "ioredis";
import { PrismaService } from "../../prisma/prisma.service.js";
import { JwtService } from "@nestjs/jwt";
import { AppConfigService } from "../../config/app-config.service.js";

const ESKIZ_BASE = "https://notify.eskiz.uz/api";

/**
 * Phone-OTP authentication for storefront customers.
 *
 *   1. POST /storefront/auth/request-otp { phone, tenantSlug }
 *      → 4-digit code generated, stored in Redis with 5-minute TTL,
 *        sent via Eskiz.uz SMS API (or logged in dev when ESKIZ_EMAIL unset).
 *   2. POST /storefront/auth/verify-otp { phone, code, tenantSlug }
 *      → Customer is upserted, short-lived JWT issued (same shape as
 *        Mini App's JWT so the rest of /storefront/* works identically).
 *
 * Brute-force protection: per-phone rate limit (5 attempts / 15 min).
 * Eskiz access token is cached in Redis for 25 days (Eskiz returns 30-day tokens).
 */
@Injectable()
export class SmsOtpService {
  private readonly logger = new Logger(SmsOtpService.name);
  private readonly redis: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
  ) {
    this.redis = new Redis(config.redisUrl, { lazyConnect: true, maxRetriesPerRequest: null });
    this.redis.connect().catch(() => undefined);
  }

  async requestOtp(tenantSlug: string, phone: string): Promise<{ sent: boolean; debugCode?: string }> {
    const normalized = normalizePhone(phone);
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug }, select: { id: true, name: true } });
    if (!tenant) throw new BadRequestException("Tenant not found");

    const rlKey = `otp:rl:${normalized}`;
    const attempts = await this.redis.incr(rlKey);
    if (attempts === 1) await this.redis.pexpire(rlKey, 15 * 60 * 1000);
    if (attempts > 5) throw new BadRequestException("Juda ko'p urinish. 15 daqiqadan keyin qayta urinib ko'ring.");

    const code = String(randomInt(1000, 10000)).padStart(4, "0");
    const codeKey = `otp:code:${tenant.id}:${normalized}`;
    await this.redis.set(codeKey, code, "PX", 5 * 60 * 1000);

    const text = `${tenant.name}: tasdiq kodi ${code}. Hech kimga aytmang.`;

    if (!process.env.ESKIZ_EMAIL || !process.env.ESKIZ_PASSWORD) {
      // Dev mode — return the code in the response so testers can proceed
      // without an SMS provider. In production env vars MUST be set.
      this.logger.warn(`Eskiz not configured; OTP for ${normalized} = ${code}`);
      return { sent: true, debugCode: code };
    }

    try {
      const token = await this.getEskizToken();
      await axios.post(
        `${ESKIZ_BASE}/message/sms/send`,
        { mobile_phone: normalized, message: text, from: "4546" },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 10_000 },
      );
      return { sent: true };
    } catch (err) {
      this.logger.error(`Eskiz send failed: ${String(err)}`);
      throw new BadRequestException("SMS yuborib bo'lmadi. Iltimos, keyinroq urinib ko'ring.");
    }
  }

  async verifyOtp(tenantSlug: string, phone: string, code: string) {
    const normalized = normalizePhone(phone);
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, slug: true, name: true },
    });
    if (!tenant) throw new UnauthorizedException("Tenant not found");

    const codeKey = `otp:code:${tenant.id}:${normalized}`;
    const stored = await this.redis.get(codeKey);
    if (!stored || stored !== code) throw new UnauthorizedException("Noto'g'ri yoki muddati o'tgan kod");
    await this.redis.del(codeKey);

    let customer = await this.prisma.customer.findFirst({
      where: { tenantId: tenant.id, phone: normalized },
    });
    if (!customer) {
      customer = await this.prisma.customer.create({
        data: {
          tenantId: tenant.id,
          name: `+${normalized}`,
          phone: normalized,
          tags: ["sms-otp"] as never,
        },
      });
    }

    const accessToken = await this.jwt.signAsync(
      { sub: customer.id, tenantId: tenant.id, role: "STOREFRONT", phone: normalized },
      { secret: this.config.jwtAccessSecret, expiresIn: "30m" },
    );

    return {
      accessToken,
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
      customer: { id: customer.id, name: customer.name, phone: customer.phone },
    };
  }

  // ---------- Internal ----------

  private async getEskizToken(): Promise<string> {
    const cached = await this.redis.get("eskiz:token");
    if (cached) return cached;
    const res = await axios.post(
      `${ESKIZ_BASE}/auth/login`,
      { email: process.env.ESKIZ_EMAIL, password: process.env.ESKIZ_PASSWORD },
      { timeout: 10_000 },
    );
    const token = res.data?.data?.token as string | undefined;
    if (!token) throw new Error("Eskiz login: no token in response");
    await this.redis.set("eskiz:token", token, "EX", 25 * 24 * 3600);
    return token;
  }
}

/**
 * Accepts free-form Uzbek phone inputs and returns the 12-digit E.164 form
 * without the leading `+`. Eskiz expects `998xxxxxxxxx`.
 */
function normalizePhone(input: string): string {
  let digits = input.replace(/\D+/g, "");
  if (digits.startsWith("00998")) digits = digits.slice(2);
  if (digits.startsWith("998")) {
    if (digits.length !== 12) throw new BadRequestException("Telefon raqami noto'g'ri formatda");
    return digits;
  }
  // Bare 9-digit local number
  if (digits.length === 9) return `998${digits}`;
  throw new BadRequestException("Telefon raqami noto'g'ri formatda");
}
