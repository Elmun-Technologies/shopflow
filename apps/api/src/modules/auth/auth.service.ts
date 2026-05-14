import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { randomBytes, createHash } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service.js";
import { AppConfigService } from "../../config/app-config.service.js";
import type { LoginDto, RefreshDto, RegisterDto } from "./auth.dto.js";

interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const slugTaken = await this.prisma.tenant.findUnique({ where: { slug: dto.tenantSlug } });
    if (slugTaken) throw new ConflictException("Tenant slug is already taken");

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    const tenant = await this.prisma.tenant.create({
      data: {
        slug: dto.tenantSlug,
        name: dto.tenantName,
        plan: "TRIAL",
        status: "ACTIVE",
        settings: { create: {} },
        users: {
          create: {
            email: dto.email.toLowerCase(),
            name: dto.name,
            passwordHash,
            role: "OWNER",
          },
        },
        storefrontSite: {
          create: {
            subdomain: dto.tenantSlug,
            title: dto.tenantName,
            theme: { primaryColor: "#10b981", accentColor: "#3b82f6" },
            published: false,
            catalogOnly: false,
          },
        },
      },
      include: { users: true },
    });

    const user = tenant.users[0]!;
    const tokens = await this.issueTokens(tenant.id, user.id, user.role);
    return {
      user: this.publicUser(user, tenant),
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    const email = dto.email.toLowerCase();
    const users = await this.prisma.user.findMany({
      where: { email, tenant: dto.tenantSlug ? { slug: dto.tenantSlug } : undefined },
      include: { tenant: true },
    });
    if (users.length === 0) throw new UnauthorizedException("Invalid credentials");
    if (users.length > 1 && !dto.tenantSlug) {
      throw new BadRequestException("tenantSlug is required when the email belongs to multiple workspaces");
    }
    const user = users[0]!;
    const ok = await argon2.verify(user.passwordHash, dto.password);
    if (!ok) throw new UnauthorizedException("Invalid credentials");

    const tokens = await this.issueTokens(user.tenantId, user.id, user.role);
    return {
      user: this.publicUser(user, user.tenant),
      tenant: { id: user.tenant.id, slug: user.tenant.slug, name: user.tenant.name },
      ...tokens,
    };
  }

  async refresh(dto: RefreshDto) {
    const tokenHash = sha256(dto.refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { tenant: true } } },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException("Invalid refresh token");
    }
    // Rotate
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    const tokens = await this.issueTokens(stored.user.tenantId, stored.user.id, stored.user.role);
    return {
      user: this.publicUser(stored.user, stored.user.tenant),
      tenant: { id: stored.user.tenant.id, slug: stored.user.tenant.slug, name: stored.user.tenant.name },
      ...tokens,
    };
  }

  async revoke(refreshToken: string) {
    const tokenHash = sha256(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(tenantId: string, userId: string, role: string): Promise<IssuedTokens> {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, tenantId, role },
      { secret: this.config.jwtAccessSecret, expiresIn: this.config.jwtAccessTtl },
    );
    const refreshToken = randomBytes(48).toString("base64url");
    const expiresAt = new Date(Date.now() + this.config.jwtRefreshTtlDays * 86_400_000);
    await this.prisma.refreshToken.create({
      data: {
        tenantId,
        userId,
        tokenHash: sha256(refreshToken),
        expiresAt,
      },
    });
    return { accessToken, refreshToken, expiresAt: expiresAt.toISOString() };
  }

  private publicUser(
    user: { id: string; email: string; name: string; role: string; createdAt: Date; updatedAt: Date; tenantId: string },
    tenant: { id: string; slug: string; name: string },
  ) {
    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantSlug: tenant.slug,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
