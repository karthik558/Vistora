import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "../auth/serverAuth";
import { PlatformError, sessionDb, workspaceContext } from "./db";

import { isAllowedMutation } from "../security/requestPolicy";

export function errorResponse(error: unknown) {
  const status = error instanceof PlatformError ? error.status : error instanceof SyntaxError ? 400 : 500;
  return NextResponse.json({ success: false, error: status >= 500 && !(error instanceof PlatformError) ? "The request could not be completed. Please try again." : error instanceof Error ? error.message : "Invalid request." }, { status, headers: { "Cache-Control": "private, no-store" } });
}
export function withWorkspace<H extends (request: NextRequest, ...args: any[]) => Promise<Response>>(handler: H, right?: string): H {
  return (async (request: NextRequest, ...args: any[]) => {
    try {
      if (!isAllowedMutation(request)) throw new PlatformError("Cross-origin requests are not allowed.",403);
      const user = await getAuthenticatedUser(request);
      if (!user) throw new PlatformError("Authentication required.", 401);
      if (right && !user.isOrganizationAdmin && !user.rights.includes(right)) throw new PlatformError("You do not have permission for this operation.", 403);
      const response = await workspaceContext.run({ user, client: sessionDb(user.accessToken) }, () => handler(request, ...args));
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    } catch (error) { return errorResponse(error); }
  }) as H;
}
export function text(value: unknown, name: string, max = 200, required = true): string {
  if (typeof value !== "string" || !value.trim()) {
    if (!required) return "";
    throw new PlatformError(`${name} is required.`);
  }
  if (value.trim().length > max) throw new PlatformError(`${name} must be at most ${max} characters.`);
  return value.trim();
}
export function number(value: unknown, name: string, min: number, max: number) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) throw new PlatformError(`${name} must be an integer from ${min} to ${max}.`);
  return value;
}
export function email(value: unknown) {
  const clean = text(value, "Email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) throw new PlatformError("Enter a valid email address.");
  return clean;
}

export async function readJson(request: Request, maxBytes = 1024 * 1024): Promise<any> {
  if (!isAllowedMutation({ method: request.method, headers: request.headers, nextUrl: new URL(request.url) })) throw new PlatformError("Cross-origin requests are not allowed.", 403);
  if (!(request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() === "application/json")) throw new PlatformError("Send an application/json request.", 415);
  const bytes = await readLimitedBody(request, maxBytes);
  let body;
  try { body = JSON.parse(bytes.toString("utf8")); }
  catch { throw new PlatformError("Send valid JSON."); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new PlatformError("A JSON object is required.");
  return body;
}

async function readLimitedBody(request: Request, maxBytes: number) {
  if (Number(request.headers.get("content-length")) > maxBytes) throw new PlatformError("Request body is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new PlatformError("A request body is required.");
  const chunks: Uint8Array[] = []; let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel(); throw new PlatformError("Request body is too large.", 413); }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export async function readFormData(request: Request, maxBytes = 6 * 1024 * 1024) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) throw new PlatformError("Send a multipart form.", 415);
  const bytes = await readLimitedBody(request, maxBytes);
  try { return await new Response(bytes, { headers: { "Content-Type": contentType } }).formData(); }
  catch { throw new PlatformError("Send a valid multipart form."); }
}
