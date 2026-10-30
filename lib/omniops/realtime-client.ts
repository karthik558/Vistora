import { createClient } from "@supabase/supabase-js";

// Use the server-managed JWT without creating a second browser auth session.
export function createOperationsRealtimeClient(url: string, key: string, getToken: () => string | null) {
  return createClient(url, key, { accessToken: async () => getToken() });
}