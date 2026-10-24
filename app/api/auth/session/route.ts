import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("sb-access-token")?.value;
    if (!token) {
      return NextResponse.json({ success: true, user: null });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    });

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return NextResponse.json({ success: true, user: null });
    }

    const rawRole = data.user.user_metadata?.role;
    const role =
      rawRole === "admin" || rawRole === "General Manager" || !rawRole
        ? "admin"
        : rawRole === "visitor"
        ? "visitor"
        : "staff";

    return NextResponse.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        fullName: data.user.user_metadata?.full_name || "Rhea Menon",
        role,
      },
    });
  } catch {
    return NextResponse.json({ success: true, user: null });
  }
}
