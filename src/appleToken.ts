import jwt from "jsonwebtoken";
import type { AppConfig } from "./config.js";

export function createAppleDeveloperToken(config: AppConfig): string {
  return jwt.sign({}, config.applePrivateKey, {
    algorithm: "ES256",
    issuer: config.APPLE_TEAM_ID,
    header: {
      alg: "ES256",
      kid: config.APPLE_KEY_ID
    },
    expiresIn: "180d"
  });
}
