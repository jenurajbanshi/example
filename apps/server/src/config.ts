import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default("0.0.0.0"),
  CORS_ORIGIN: z.string().default("*"),
  REDIS_URL: z.string().url().optional(),
  REDIS_KEY_PREFIX: z.string().default("orbital-estates"),
  GAME_TTL_SECONDS: z.coerce.number().int().min(300).default(86_400),
  TRUST_PROXY: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true")
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return envSchema.parse(env);
}

export function parseCorsOrigin(origin: string): string | string[] | boolean {
  if (origin === "*") {
    return true;
  }

  return origin
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}
