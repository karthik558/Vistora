import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const SALT = "vistora_secret_salt";

function hashPassword(password: string): string {
  return "pwd:" + crypto.createHash("sha256").update(password + SALT).digest("hex");
}

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

    const newHash = hashPassword(newPassword.trim());

    // 1. Update in Supabase auth.users if userId is present
    try {
      if (userId) {
        await adminClient.auth.admin.updateUserById(userId, { password: newPassword.trim() });
      }
    } catch (e) {
      console.warn("Could not update auth.users password:", e);
    }

    // 2. Fetch profile to ensure target exists
    let profileQuery = adminClient.from("profiles").select("id, email, full_name, role, avatar_url");
    if (userId) {
      profileQuery = profileQuery.eq("id", userId);
    } else {
      profileQuery = profileQuery.ilike("email", email.trim().toLowerCase());
    }

    const { data: updatedProfile, error: profileErr } = await profileQuery.maybeSingle();

    if (profileErr || !updatedProfile) {
      return NextResponse.json(
        { success: false, error: profileErr?.message || "User profile not found in Supabase." },
        { status: 404 }
      );
    }

    const targetUserId = updatedProfile.id;

    // 3. Store password hash in dedicated user_credentials table
    try {
      await adminClient.from("user_credentials").upsert({
        user_id: targetUserId,
        password_hash: newHash,
        updated_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn("Could not upsert into user_credentials:", e);
    }

    // 4. Clean avatar_url if it had legacy password hash or JSON
    if (
      updatedProfile.avatar_url &&
      (updatedProfile.avatar_url.startsWith("pwd:") || updatedProfile.avatar_url.startsWith("{"))
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
      message: "Password updated successfully.",
      user: {
        id: updatedProfile.id,
        email: updatedProfile.email,
        full_name: updatedProfile.full_name,
        role: updatedProfile.role,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update password." },
      { status: 500 }
    );
  }
}
