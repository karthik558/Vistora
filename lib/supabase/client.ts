import { createClient } from "@supabase/supabase-js";
import { Database } from "../../types/database";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== "https://your-project-id.supabase.co" &&
  !supabaseUrl.includes("placeholder")
);

// Fallback dummy client if credentials are not yet supplied so imports never throw
export const supabase = createClient<Database>(
  supabaseUrl || "https://placeholder-vistora.supabase.co",
  supabaseAnonKey || "placeholder-anon-key"
);
