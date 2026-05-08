import crypto from "node:crypto";
import type { FastifyRequest } from "fastify";
import type { AppConfig } from "./config.js";

export function createSignedState(config: AppConfig, purpose: string): string {
  const payload = JSON.stringify({ purpose, ts: Date.now() });
  const encoded = Buffer.from(payload).toString("base64url");
  const signature = crypto.createHmac("sha256", config.APP_SECRET).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifySignedState(config: AppConfig, state: string, purpose: string): boolean {
  const [encoded, signature] = state.split(".");
  if (!encoded || !signature) return false;

  const expected = crypto.createHmac("sha256", config.APP_SECRET).update(encoded).digest("base64url");
  if (signature.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;

  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as { purpose: string; ts: number };
  const ageMs = Date.now() - payload.ts;
  return payload.purpose === purpose && ageMs >= 0 && ageMs < 10 * 60 * 1000;
}

export function assertAdmin(request: FastifyRequest, config: AppConfig): void {
  if (!config.ADMIN_TOKEN) return;

  const queryToken = (request.query as { token?: string } | undefined)?.token;
  const headerToken = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  const token = queryToken ?? headerToken;

  if (token !== config.ADMIN_TOKEN) {
    const error = new Error("Unauthorized");
    (error as Error & { statusCode: number }).statusCode = 401;
    throw error;
  }
}
