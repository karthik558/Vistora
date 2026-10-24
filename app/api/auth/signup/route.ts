import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request: NextRequest) {
  try {
    const { email, password, fullName, role } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    let createdUser: any = null;

    // Use admin client if service key exists to automatically confirm email
    if (supabaseServiceKey) {
      const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false },
      });
      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName || "Operations Manager",
          role: role || "Staff Member",
        },
      });

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
      }
      createdUser = data.user;
    } else {
      const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
      });
      const { data, error } = await anonClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName || "Operations Manager",
            role: role || "Staff Member",
          },
        },
      });
      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
      }
      createdUser = data.user;
    }

    // Now sign in to retrieve session
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    });
    const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !signInData.session) {
      return NextResponse.json({
        success: true,
        message: "Account created successfully. Please sign in.",
        user: createdUser,
      });
    }

    const response = NextResponse.json({
      success: true,
      user: {
        id: signInData.user.id,
        email: signInData.user.email,
        fullName: signInData.user.user_metadata?.full_name || fullName || "Operations Manager",
        role: signInData.user.user_metadata?.role || "Staff Member",
      },
      session: {
        accessToken: signInData.session.access_token,
        expiresAt: signInData.session.expires_at,
      },
    });

    response.cookies.set("sb-access-token", signInData.session.access_token, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: signInData.session.expires_in,
      sameSite: "lax",
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to create account" },
      { status: 500 }
    );
  }
}
