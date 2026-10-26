import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { PlatformError } from "./db";
export const newToken = () => randomBytes(32).toString("hex");
export const hashToken = (token:string) => createHash("sha256").update(token).digest("hex");
function encryptionKey() {
  const value=process.env.WORKSPACE_ENCRYPTION_KEY;
  if(!value||!/^[a-fA-F0-9]{64}$/.test(value))throw new PlatformError("Configure WORKSPACE_ENCRYPTION_KEY with a 32-byte hex key before using encrypted invitations or webhooks.",503);
  return Buffer.from(value,"hex");
}
export function encryptSecret(value:string) {
  const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",encryptionKey(),iv);
  const encrypted=Buffer.concat([cipher.update(value,"utf8"),cipher.final()]);
  return [iv.toString("hex"),cipher.getAuthTag().toString("hex"),encrypted.toString("hex")].join(".");
}
export function decryptSecret(value:string) {
  const [iv,tag,data]=value.split("."),cipher=createDecipheriv("aes-256-gcm",encryptionKey(),Buffer.from(iv,"hex"));
  cipher.setAuthTag(Buffer.from(tag,"hex"));
  return Buffer.concat([cipher.update(Buffer.from(data,"hex")),cipher.final()]).toString("utf8");
}
