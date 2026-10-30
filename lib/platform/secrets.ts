import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PlatformError } from "./db";

export const newToken = () => randomBytes(32).toString("hex");
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

const FALLBACK_KEY = "5a622e950ee10d2b1af23a46efb3e52343389ca4cffde8afeb12c79971569605";

function getActiveEncryptionKey(): string {
  const envVal = process.env.WORKSPACE_ENCRYPTION_KEY?.trim();
  if (envVal && /^[a-fA-F0-9]{64}$/.test(envVal)) {
    return envVal;
  }

  // Attempt dynamic load from .env.local if dev server was started before .env.local had WORKSPACE_ENCRYPTION_KEY
  try {
    const envFile = path.resolve(process.cwd(), ".env.local");
    if (fs.existsSync(envFile)) {
      const content = fs.readFileSync(envFile, "utf8");
      const match = content.match(/^WORKSPACE_ENCRYPTION_KEY=([a-fA-F0-9]{64})/m);
      if (match && match[1]) {
        process.env.WORKSPACE_ENCRYPTION_KEY = match[1];
        return match[1];
      }
    }
  } catch {}

  // Fallback in non-production to ensure local operations never halt
  if (process.env.NODE_ENV !== "production") {
    process.env.WORKSPACE_ENCRYPTION_KEY = FALLBACK_KEY;
    return FALLBACK_KEY;
  }

  throw new PlatformError("Configure WORKSPACE_ENCRYPTION_KEY with a 32-byte hex key before using encrypted invitations or webhooks.", 503);
}

function encryptionKey(): Buffer {
  const value = getActiveEncryptionKey();
  if (!value || !/^[a-fA-F0-9]{64}$/.test(value)) {
    throw new PlatformError("Configure WORKSPACE_ENCRYPTION_KEY with a 32-byte hex key before using encrypted invitations or webhooks.", 503);
  }
  return Buffer.from(value, "hex");
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv.toString("hex"), cipher.getAuthTag().toString("hex"), encrypted.toString("hex")].join(".");
}

export function decryptSecret(value: string) {
  const [iv, tag, data] = value.split("."), cipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "hex"));
  cipher.setAuthTag(Buffer.from(tag, "hex"));
  return Buffer.concat([cipher.update(Buffer.from(data, "hex")), cipher.final()]).toString("utf8");
}
