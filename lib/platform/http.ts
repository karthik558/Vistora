import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "../auth/serverAuth";
import { PlatformError, sessionDb, workspaceContext } from "./db";

export function errorResponse(error: unknown) {
  const status = error instanceof PlatformError ? error.status : 500;
  return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Request failed." }, { status });
}
export function withWorkspace<H extends (request: NextRequest, ...args: any[]) => Promise<Response>>(handler: H, right?: string): H {
  return (async (request: NextRequest, ...args: any[]) => {
    try {
      const origin=request.headers.get("origin");
      if (!["GET","HEAD","OPTIONS"].includes(request.method) && origin && (origin==="null"||new URL(origin).host!==(request.headers.get("host")||request.nextUrl.host))) throw new PlatformError("Cross-origin requests are not allowed.",403);
      const user = await getAuthenticatedUser(request);
      if (!user) throw new PlatformError("Authentication required.", 401);
      if (right && !user.isOrganizationAdmin && !user.rights.includes(right)) throw new PlatformError("You do not have permission for this operation.", 403);
      return await workspaceContext.run({ user, client: sessionDb(user.accessToken) }, () => handler(request, ...args));
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
