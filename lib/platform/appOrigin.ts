import { PlatformError } from "./db";

export function appOrigin(requestOrigin: string) {
 const configured = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
 const actual = new URL(requestOrigin);
 const local = (url: URL) => ["localhost","127.0.0.1","[::1]"].includes(url.hostname);
 // Share the deployment actually being used, including Vercel previews.
 if (!local(actual) && actual.protocol === "https:") return actual.origin;
 if (configured) {
  let url: URL;
  try { url = new URL(configured); } catch { throw new PlatformError("Configure APP_URL with your website address.",503); }
  if (!['http:','https:'].includes(url.protocol) || url.username || url.password) throw new PlatformError("Configure a valid website address.",503);
  // A copied development setting must never turn a live site's links into localhost links.
  if (!local(url) && (process.env.NODE_ENV !== "production" || url.protocol === "https:")) return url.origin;
 }
 if (process.env.NODE_ENV === "production" && (local(actual) || actual.protocol !== "https:")) throw new PlatformError("Configure APP_URL with the public HTTPS website address.",503);
 return actual.origin;
}
