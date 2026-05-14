import { pino, type Logger } from "pino";

/**
 * Shared Pino logger factory. Pretty-prints in dev, JSON in prod. Redacts
 * sensitive headers and known secret fields by default so we don't leak tokens
 * via stdout.
 */
export function createLogger(opts: { name: string; level?: string }): Logger {
  const isProd = process.env.NODE_ENV === "production";
  return pino({
    name: opts.name,
    level: opts.level ?? process.env.LOG_LEVEL ?? (isProd ? "info" : "debug"),
    formatters: {
      level(label) {
        return { level: label };
      },
    },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["x-revalidate-secret"]',
        'req.headers["x-telegram-bot-api-secret-token"]',
        'req.headers["x-telegram-init-data"]',
        "password",
        "passwordHash",
        "accessToken",
        "refreshToken",
        "encryptedToken",
        "encryptedSecret",
        "secret",
        "secretKey",
        "*.password",
        "*.token",
        "*.secret",
      ],
      remove: true,
    },
    transport: isProd
      ? undefined
      : { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } },
  });
}

export type { Logger } from "pino";
