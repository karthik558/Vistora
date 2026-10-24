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

    // 1. Try updating in profiles table
    let profileQuery = adminClient.from("profiles").update({
      avatar_url: newHash,
      updated_at: new Date().toISOString(),
    });

    if (userId) {
      profileQuery = profileQuery.eq("id", userId);
    } else {
      profileQuery = profileQuery.ilike("email", email.trim().toLowerCase());
    }

    const { data: updatedProfile } = await profileQuery.select("id, email, full_name, role").maybeSingle();

    // 2. Try updating in guests table
    let guestQuery = adminClient.from("guests").update({
      phone: newHash,
    });

    if (userId) {
      guestQuery = guestQuery.eq("id", userId);
    } else {
      guestQuery = guestQuery.ilike("email", email.trim().toLowerCase());
    }

    const { data: updatedGuest } = await guestQuery.select("id, email, full_name, vip_tier").maybeSingle();

    if (!updatedProfile && !updatedGuest) {
      return NextResponse.json(
        { success: false, error: "User not found to update password." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Password updated successfully in Supabase.",
      user: updatedProfile || updatedGuest,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update password." },
      { status: 500 }
    );
  }
}
