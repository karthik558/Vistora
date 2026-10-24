import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = params.id;

    if (!userId) {
      return NextResponse.json({ success: false, error: "User ID is required." }, { status: 400 });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Delete user from Supabase Auth (which cascades to profiles)
    try {
      await adminClient.auth.admin.deleteUser(userId);
    } catch (e) {
      console.warn("Could not delete from auth.users:", e);
    }

    // Explicitly delete from profiles table
    await adminClient.from("profiles").delete().eq("id", userId);

    return NextResponse.json({ success: true, message: "User removed successfully." });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to remove user." },
      { status: 500 }
    );
  }
}
