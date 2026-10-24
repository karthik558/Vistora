import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "../../../../lib/auth/serverAuth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const authCheck = await requireAdmin(request);
    if (authCheck.errorResponse) return authCheck.errorResponse;

    const resolvedParams = await context.params;
    const userId = resolvedParams?.id;

    if (!userId) {
      return NextResponse.json({ success: false, error: "User ID is required." }, { status: 400 });
    }

    // Prevent admin from deleting their own active session
    if (authCheck.user?.id === userId) {
      return NextResponse.json(
        { success: false, error: "Security restriction: You cannot delete your own administrator account." },
        { status: 400 }
      );
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
