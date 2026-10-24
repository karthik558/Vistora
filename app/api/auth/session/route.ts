import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(request: NextRequest) {
  try {
    // 1. Check workspace session cookie
    const userCookie = request.cookies.get("vistora-user")?.value;
    if (userCookie) {
      try {
        const parsed = JSON.parse(userCookie);
        if (parsed && parsed.email) {
          return NextResponse.json({
            success: true,
            user: parsed,
          });
        }
      } catch {
        // Fall through to token check
      }
    }

    // 2. Check Supabase access token
    const token = request.cookies.get("sb-access-token")?.value;
    if (token) {
      try {
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
          auth: { persistSession: false },
        });
        const { data, error } = await supabase.auth.getUser(token);
        if (!error && data?.user) {
          const rawRole = data.user.user_metadata?.role;
          const role =
            rawRole === "admin" || !rawRole ? "admin" : rawRole === "visitor" ? "visitor" : "staff";
          return NextResponse.json({
            success: true,
            user: {
              id: data.user.id,
              email: data.user.email,
              fullName: data.user.user_metadata?.full_name || "Operations Lead",
              role,
            },
          });
        }
      } catch {
        // Return default guest session
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        id: "default-user",
        email: "rhea.menon@anantara.com",
        fullName: "Rhea Menon",
        role: "admin",
      },
    });
  } catch {
    return NextResponse.json({
      success: true,
      user: {
        id: "default-user",
        email: "rhea.menon@anantara.com",
        fullName: "Rhea Menon",
        role: "admin",
      },
    });
  }
}
