import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  BASE_URL: z.string().url(),
  APP_SECRET: z.string().min(24),
  ADMIN_TOKEN: z.string().min(12).optional(),
  SPOTIFY_CLIENT_ID: z.string().min(1),
  SPOTIFY_CLIENT_SECRET: z.string().min(1),
  APPLE_TEAM_ID: z.string().min(1),
  APPLE_KEY_ID: z.string().min(1),
  APPLE_PRIVATE_KEY: z.string().optional().default(""),
  APPLE_PRIVATE_KEY_BASE64: z.string().optional().default(""),
  PORT: z.coerce.number().int().positive().default(3000)
});

export type AppConfig = z.infer<typeof envSchema> & {
  applePrivateKey: string;
};

export function loadConfig(): AppConfig {
  const parsed = envSchema.parse(process.env);
  const applePrivateKey = parsed.APPLE_PRIVATE_KEY_BASE64
    ? Buffer.from(parsed.APPLE_PRIVATE_KEY_BASE64, "base64").toString("utf8")
    : parsed.APPLE_PRIVATE_KEY.replaceAll("\\n", "\n");

  if (!applePrivateKey.includes("PRIVATE KEY")) {
    throw new Error("APPLE_PRIVATE_KEY or APPLE_PRIVATE_KEY_BASE64 must contain a valid PEM private key.");
  }

  return {
    ...parsed,
    applePrivateKey
  };
}
