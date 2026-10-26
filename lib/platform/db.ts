import { AsyncLocalStorage } from "node:async_hooks";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { VerifiedUser } from "../auth/serverAuth";

export const workspaceContext = new AsyncLocalStorage<{ user: VerifiedUser; client: SupabaseClient }>();
export class PlatformError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function serviceDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new PlatformError("The server Supabase service key is not configured.", 503);
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export function sessionDb(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new PlatformError("Supabase is not configured.", 503);
  return createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
}
export function workspaceDb() {
  const context = workspaceContext.getStore();
  if (!context) throw new PlatformError("A verified workspace session is required.", 401);
  return context.client;
}
export function workspaceUser() {
  const context = workspaceContext.getStore();
  if (!context) throw new PlatformError("Sign in to continue.", 401);
  return context.user;
}
export function checked<T>({ data, error }: { data: T; error: any }): NonNullable<T> {
  if (error) {
    if (["PGRST205", "PGRST204", "42P01", "42703", "42883"].includes(error.code)) {
      throw new PlatformError("Workspace setup is pending. Apply section 12 onward in supabase/schema.sql.", 503);
    }
    throw new PlatformError(error.message || "Database operation failed.", error.code === "42501" ? 403 : 400);
  }
  if (data === null || data === undefined) throw new PlatformError("Record not found or access denied.", 404);
  return data as NonNullable<T>;
}
export async function assertProperty(id: string) {
  const row = checked(await workspaceDb().from("properties").select("id, organization_id").eq("id", id).maybeSingle());
  return row;
}
