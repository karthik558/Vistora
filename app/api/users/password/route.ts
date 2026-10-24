import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: NextRequest) {
  try {
    const { email, userId, newPassword } = await request.json();

    if (!newPassword || newPassword.trim().length < 6) {
      return NextResponse.json(
        { success: false, error: "New password must be at least 6 characters." },
        { status: 400 }
      );
    }

    if (!email && !userId) {
      return NextResponse.json(
        { success: false, error: "User email or ID is required." },
        { status: 400 }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // 1. Fetch profile to ensure target exists
    let profileQuery = adminClient.from("profiles").select("id, email, full_name, role, avatar_url");
    if (userId) {
      profileQuery = profileQuery.eq("id", userId);
    } else {
      profileQuery = profileQuery.ilike("email", email.trim().toLowerCase());
    }

    const { data: targetProfile, error: profileErr } = await profileQuery.maybeSingle();

    if (profileErr || !targetProfile) {
      return NextResponse.json(
        { success: false, error: profileErr?.message || "User profile not found in Supabase." },
        { status: 404 }
      );
    }

    const targetUserId = targetProfile.id;

    // 2. Update password in Supabase Auth (auth.users) with native bcrypt encryption
    const { error: authErr } = await adminClient.auth.admin.updateUserById(targetUserId, {
      password: newPassword.trim(),
    });

    if (authErr) {
      return NextResponse.json(
        { success: false, error: authErr.message || "Failed to update authentication credentials." },
        { status: 500 }
      );
    }

    // 3. Ensure avatar_url is clean if it had legacy artifacts
    if (
      targetProfile.avatar_url &&
      (targetProfile.avatar_url.startsWith("pwd:") || targetProfile.avatar_url.startsWith("{"))
    ) {
      try {
        await adminClient
          .from("profiles")
          .update({ avatar_url: null, updated_at: new Date().toISOString() })
          .eq("id", targetUserId);
      } catch {}
    }

    return NextResponse.json({
      success: true,
      message: "Password updated successfully in Supabase Auth.",
      user: {
        id: targetProfile.id,
        email: targetProfile.email,
        full_name: targetProfile.full_name,
        role: targetProfile.role,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update password." },
      { status: 500 }
    );
  }
}
