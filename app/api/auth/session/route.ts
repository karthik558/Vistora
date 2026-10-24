import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function formatUserDisplayName(email: string): string {
  const clean = email.trim();
  const [localPart, domainPart = ""] = clean.toLowerCase().split("@");
  if (clean.toLowerCase() === "dev@karthiklal.in" || domainPart.includes("karthiklal")) {
    return "Karthik Lal";
  }
  const parts = localPart
    .replace(/[._\-+]/g, " ")
    .split(/\s+/)
    .map((p) => p.replace(/\d+/g, "").trim())
    .filter(Boolean);
  if (parts.length > 0) {
    return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(" ");
  }
  return localPart.charAt(0).toUpperCase() + localPart.slice(1);
}

export async function GET(request: NextRequest) {
  try {
    // 1. Check workspace session cookie
    const userCookie = request.cookies.get("vistora-user")?.value;
    if (userCookie) {
      try {
        const parsed = JSON.parse(userCookie);
        if (parsed && parsed.email) {
          if (!parsed.fullName || parsed.fullName === "Operations User") {
            parsed.fullName = formatUserDisplayName(parsed.email);
          }
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
          const fullName =
            data.user.user_metadata?.full_name ||
            data.user.user_metadata?.name ||
            (data.user.email ? formatUserDisplayName(data.user.email) : "Operations User");
          return NextResponse.json({
            success: true,
            user: {
              id: data.user.id,
              email: data.user.email,
              fullName,
              role,
            },
          });
        }
      } catch {
        // Return default guest session
      }
    }

    return NextResponse.json({
      success: false,
      user: null,
    });
  } catch {
    return NextResponse.json({
      success: false,
      user: null,
    });
  }
}
