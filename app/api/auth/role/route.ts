import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: NextRequest) {
  try {
    const { role, email } = await request.json();

    if (!["admin", "staff", "visitor"].includes(role)) {
      return NextResponse.json({ success: false, error: "Invalid role. Must be 'admin', 'staff', or 'visitor'." }, { status: 400 });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const targetEmail = email || "rhea.menon@anantara.com";

    // Find user in auth
    const { data: usersData } = await adminClient.auth.admin.listUsers();
    const targetUser = usersData?.users.find((u) => u.email === targetEmail);

    if (targetUser) {
      // Update metadata
      await adminClient.auth.admin.updateUserById(targetUser.id, {
        user_metadata: { ...targetUser.user_metadata, role },
      });

      // Try updating public.profiles if table exists
      try {
        await (adminClient as any).from("profiles").upsert({
          id: targetUser.id,
          email: targetUser.email,
          full_name: targetUser.user_metadata?.full_name || "Operations Lead",
          role,
          updated_at: new Date().toISOString(),
        });
      } catch {
        // Ignore if profiles table not yet created
      }
    }

    return NextResponse.json({
      success: true,
      role,
      user: targetUser ? {
        id: targetUser.id,
        email: targetUser.email,
        fullName: targetUser.user_metadata?.full_name || "Operations Lead",
        role,
      } : { role },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
