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

export async function GET() {
  try {
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Fetch workspace members from public.profiles with associated property details
    const { data: profiles, error } = await adminClient
      .from("profiles")
      .select("id, email, full_name, role, property_id, properties(id, name, code), created_at, updated_at")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, users: profiles || [] });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch users" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { email, fullName, role = "visitor", password, propertyId } = await request.json();

    if (!email || !email.trim()) {
      return NextResponse.json({ success: false, error: "Email is required." }, { status: 400 });
    }

    if (!fullName || !fullName.trim()) {
      return NextResponse.json({ success: false, error: "Full name is required." }, { status: 400 });
    }

    if (!password || password.trim().length < 6) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    if (!["admin", "staff", "visitor"].includes(role)) {
      return NextResponse.json(
        { success: false, error: "Role must be 'admin', 'staff', or 'visitor'." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullName.trim();
    const passwordHash = hashPassword(password.trim());

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Check if user already exists in profiles
    const { data: existingProfile } = await adminClient
      .from("profiles")
      .select("id")
      .ilike("email", cleanEmail)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json(
        { success: false, error: "A workspace member with this email already exists." },
        { status: 400 }
      );
    }

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: cleanEmail,
      password: password.trim(),
      email_confirm: true,
      user_metadata: {
        full_name: cleanName,
        role,
      },
    });

    if (authError || !authData?.user) {
      return NextResponse.json(
        { success: false, error: authError?.message || "Failed to create user in authentication system." },
        { status: 500 }
      );
    }

    const newUserId = authData.user.id;

    // Upsert into public.profiles with optional property_id assignment
    const { data: profileInsert, error: profileError } = await adminClient
      .from("profiles")
      .upsert({
        id: newUserId,
        email: cleanEmail,
        full_name: cleanName,
        role,
        property_id: propertyId || null,
        avatar_url: passwordHash,
        updated_at: new Date().toISOString(),
      })
      .select("id, email, full_name, role, property_id, properties(id, name, code), created_at")
      .single();

    if (profileError) {
      return NextResponse.json({ success: false, error: profileError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, user: profileInsert });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to create user" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { userId, role, propertyId } = await request.json();

    if (!userId) {
      return NextResponse.json({ success: false, error: "User ID is required." }, { status: 400 });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (role && ["admin", "staff", "visitor"].includes(role)) {
      updatePayload.role = role;
    }

    if (propertyId !== undefined) {
      updatePayload.property_id = propertyId || null;
    }

    const { data, error } = await adminClient
      .from("profiles")
      .update(updatePayload)
      .eq("id", userId)
      .select("id, email, full_name, role, property_id, properties(id, name, code)")
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, user: data });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update user" },
      { status: 500 }
    );
  }
}
