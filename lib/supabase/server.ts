import { cookies } from "next/headers";
import { Database } from "../../types/database";
import { SupabaseClient } from "@supabase/supabase-js";
import { sessionDb, workspaceContext } from "../platform/db";

// Ordinary server queries always carry the caller's JWT and therefore enforce RLS.
export async function createServerSupabaseClient(): Promise<SupabaseClient<Database> | null> {
  const context = workspaceContext.getStore();
  if (context) return context.client as unknown as SupabaseClient<Database>;
  const token = (await cookies()).get("sb-access-token")?.value;
  if (!token) return null;
  return sessionDb(token) as unknown as SupabaseClient<Database>;
}
