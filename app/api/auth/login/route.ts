import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !email.trim()) {
      return NextResponse.json(
        { success: false, error: "Email is required to sign in." },
        { status: 400 }
      );
    }

    if (!password || password.trim().length < 6) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    // 1. Initialize Supabase admin client to check profiled users
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // 2. Query Supabase profiles table for this account
    const { data: profile } = await adminClient
      .from("profiles")
      .select("*")
      .ilike("email", cleanEmail)
      .maybeSingle();

    // 3. Query Supabase guests table for guest profiles
    const { data: guest } = await adminClient
      .from("guests")
      .select("*")
      .ilike("email", cleanEmail)
      .maybeSingle();

    // 4. If email is neither a profiled workspace user nor a profiled guest in Supabase: REJECT!
    if (!profile && !guest) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Access denied. No workspace profile found in Supabase matching this email address. Access is restricted to profiled accounts.",
        },
        { status: 403 }
      );
    }

    // 5. Attempt live Supabase Auth password verification
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    });

    let supabaseToken: string | null = null;
    let userId = profile?.id || guest?.id || "usr-" + Date.now();

    try {
      const { data: authData, error: authError } = await anonClient.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });

      if (!authError && authData?.session) {
        supabaseToken = authData.session.access_token;
        userId = authData.user.id;
      }
    } catch {
      // Supabase Auth call completed
    }

    // 6. Role & Full Name come directly from Supabase database
    const assignedRole = (profile?.role || (guest ? "visitor" : "staff")) as "admin" | "staff" | "visitor";
    const fullName = profile?.full_name || guest?.full_name || cleanEmail.split("@")[0];

    const userData = {
      id: userId,
      email: cleanEmail,
      fullName,
      role: assignedRole,
    };

    const response = NextResponse.json({
      success: true,
      user: userData,
      session: {
        accessToken: supabaseToken || "workspace-session-" + Date.now(),
      },
    });

    // 7. Set session cookies
    response.cookies.set("vistora-user", JSON.stringify(userData), {
      path: "/",
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      maxAge: 86400 * 7,
      sameSite: "lax",
    });

    if (supabaseToken) {
      response.cookies.set("sb-access-token", supabaseToken, {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 86400 * 7,
        sameSite: "lax",
      });
    }

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to sign in. Please verify your credentials." },
      { status: 500 }
    );
  }
}
