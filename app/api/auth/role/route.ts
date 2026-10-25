import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY!;

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

export async function POST(request: NextRequest) {
  try {
    const { role, email } = await request.json();

    if (!["admin", "staff", "visitor"].includes(role)) {
      return NextResponse.json(
        { success: false, error: "Invalid role. Must be 'admin', 'staff', or 'visitor'." },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email is required to switch role." },
        { status: 400 }
      );
    }

    const targetEmail = email.trim();
    let userName = formatUserDisplayName(targetEmail);

    // Try finding & updating in Supabase if possible
    try {
      const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false },
      });
      const { data: usersData } = await adminClient.auth.admin.listUsers();
      const targetUser = usersData?.users.find((u) => u.email === targetEmail);
      if (targetUser) {
        if (targetUser.user_metadata?.full_name) {
          userName = targetUser.user_metadata.full_name;
        }
        await adminClient.auth.admin.updateUserById(targetUser.id, {
          user_metadata: { ...targetUser.user_metadata, role },
        });
      }
    } catch {
      // Ignore background errors
    }

    const updatedUser = {
      id: "usr-" + targetEmail,
      email: targetEmail,
      fullName: userName,
      role,
    };

    const response = NextResponse.json({
      success: true,
      role,
      user: updatedUser,
    });

    response.cookies.set("vistora-user", JSON.stringify(updatedUser), {
      path: "/",
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      maxAge: 86400 * 7,
      sameSite: "lax",
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
