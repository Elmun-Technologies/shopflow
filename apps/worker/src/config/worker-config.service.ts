import { Injectable } from "@nestjs/common";
import { z } from "zod";

const Env = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string(),
  SECRETS_ENCRYPTION_KEY: z.string().length(64),
  PUBLIC_API_URL: z.string().url().default("http://localhost:4000"),
});

@Injectable()
export class WorkerConfigService {
  readonly env = Env.parse(process.env);

  get encryptionKey() {
    return Buffer.from(this.env.SECRETS_ENCRYPTION_KEY, "hex");
  }
  get publicApiUrl() {
    return this.env.PUBLIC_API_URL.replace(/\/$/, "");
  }
}
