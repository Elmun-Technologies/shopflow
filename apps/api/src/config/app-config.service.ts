import { Injectable } from "@nestjs/common";
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().default(30),

  /** 32-byte hex key used to encrypt MoySklad / Telegram tokens at rest. */
  SECRETS_ENCRYPTION_KEY: z.string().length(64),

  /** Public base URL of the API (used to build webhook URLs). */
  PUBLIC_API_URL: z.string().url().default("http://localhost:4000"),
  PUBLIC_ADMIN_URL: z.string().url().default("http://localhost:5173"),
  PUBLIC_MINIAPP_URL: z.string().url().default("http://localhost:5174"),

  CORS_ORIGINS: z.string().default("http://localhost:5173,http://localhost:5174,http://localhost:3000"),
});

export type AppEnv = z.infer<typeof EnvSchema>;

@Injectable()
export class AppConfigService {
  readonly env: AppEnv;

  constructor() {
    const parsed = EnvSchema.safeParse(process.env);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
      throw new Error(`Invalid environment variables:\n${issues}`);
    }
    this.env = parsed.data;
  }

  get port() {
    return this.env.PORT;
  }
  get isProd() {
    return this.env.NODE_ENV === "production";
  }
  get databaseUrl() {
    return this.env.DATABASE_URL;
  }
  get redisUrl() {
    return this.env.REDIS_URL;
  }
  get jwtAccessSecret() {
    return this.env.JWT_ACCESS_SECRET;
  }
  get jwtRefreshSecret() {
    return this.env.JWT_REFRESH_SECRET;
  }
  get jwtAccessTtl() {
    return this.env.JWT_ACCESS_TTL;
  }
  get jwtRefreshTtlDays() {
    return this.env.JWT_REFRESH_TTL_DAYS;
  }
  get encryptionKey() {
    return Buffer.from(this.env.SECRETS_ENCRYPTION_KEY, "hex");
  }
  get publicApiUrl() {
    return this.env.PUBLIC_API_URL.replace(/\/$/, "");
  }
  get publicAdminUrl() {
    return this.env.PUBLIC_ADMIN_URL.replace(/\/$/, "");
  }
  get publicMiniappUrl() {
    return this.env.PUBLIC_MINIAPP_URL.replace(/\/$/, "");
  }
  get corsOrigins(): string[] {
    return this.env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
  }
}
