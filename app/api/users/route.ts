import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const DEFAULT_RIGHTS = {
  admin: [
    "view_feedback",
    "manage_complaints",
    "reassign_property",
    "manage_properties",
    "manage_questionnaire",
    "export_reports",
    "manage_users",
  ],
  staff: ["view_feedback", "manage_complaints", "manage_questionnaire", "export_reports"],
  visitor: ["view_feedback"],
};

export async function GET() {
  try {
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const { data: profiles, error } = await adminClient
      .from("profiles")
      .select("id, email, full_name, role, property_id, properties(id, name, code), rights, avatar_url, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const usersWithRights = (profiles || []).map((p: any) => {
      let rights = Array.isArray(p.rights) && p.rights.length > 0
        ? p.rights
        : DEFAULT_RIGHTS[p.role as keyof typeof DEFAULT_RIGHTS] || [];

      // Clean avatar_url: if it ever contained legacy JSON or password hashes, return null
      const cleanAvatar = p.avatar_url && (p.avatar_url.startsWith("{") || p.avatar_url.startsWith("pwd:"))
        ? null
        : p.avatar_url;

      return {
        id: p.id,
        email: p.email,
        full_name: p.full_name,
        role: p.role,
        property_id: p.property_id,
        properties: p.properties,
        rights,
        avatar_url: cleanAvatar,
        created_at: p.created_at,
        updated_at: p.updated_at,
      };
    });

    return NextResponse.json({ success: true, users: usersWithRights });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch users" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { email, fullName, role = "visitor", password, propertyId, rights } = await request.json();

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
    const assignedRights = Array.isArray(rights)
      ? rights
      : DEFAULT_RIGHTS[role as keyof typeof DEFAULT_RIGHTS] || [];

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

    // 1. Create user natively in Supabase Auth (auth.users manages encrypted passwords securely)
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: cleanEmail,
      password: password.trim(),
      email_confirm: true,
      user_metadata: {
        full_name: cleanName,
        role,
        rights: assignedRights,
        property_id: propertyId || null,
      },
    });

    if (authError || !authData?.user) {
      return NextResponse.json(
        { success: false, error: authError?.message || "Failed to create user in authentication system." },
        { status: 500 }
      );
    }

    const newUserId = authData.user.id;

    // 2. Insert user directly into public.profiles (all operational user data in one clean table)
    const { data: profileInsert, error: profileError } = await adminClient
      .from("profiles")
      .upsert({
        id: newUserId,
        email: cleanEmail,
        full_name: cleanName,
        role,
        property_id: propertyId || null,
        avatar_url: null,
        rights: assignedRights,
        updated_at: new Date().toISOString(),
      })
      .select("id, email, full_name, role, property_id, properties(id, name, code), rights, created_at")
      .single();

    if (profileError) {
      return NextResponse.json({ success: false, error: profileError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      user: {
        ...profileInsert,
        rights: assignedRights,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to create user" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { userId, role, propertyId, rights } = await request.json();

    if (!userId) {
      return NextResponse.json({ success: false, error: "User ID is required" }, { status: 400 });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Retrieve existing profile
    const { data: currentProfile } = await adminClient
      .from("profiles")
      .select("avatar_url, role, property_id")
      .eq("id", userId)
      .single();

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (role && ["admin", "staff", "visitor"].includes(role)) {
      updatePayload.role = role;
    }

    if (propertyId !== undefined) {
      updatePayload.property_id = propertyId || null;
    }

    if (Array.isArray(rights)) {
      updatePayload.rights = rights;
    }

    // Clean avatar_url if it had legacy artifacts
    if (
      currentProfile?.avatar_url &&
      (currentProfile.avatar_url.startsWith("{") || currentProfile.avatar_url.startsWith("pwd:"))
    ) {
      updatePayload.avatar_url = null;
    }

    // Update single profiles table
    const { data, error } = await adminClient
      .from("profiles")
      .update(updatePayload)
      .eq("id", userId)
      .select("id, email, full_name, role, property_id, properties(id, name, code), rights")
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Sync metadata in Supabase Auth
    try {
      await adminClient.auth.admin.updateUserById(userId, {
        user_metadata: {
          role: updatePayload.role || currentProfile?.role,
          rights: rights || [],
          property_id: updatePayload.property_id !== undefined ? updatePayload.property_id : currentProfile?.property_id,
        },
      });
    } catch {}

    return NextResponse.json({
      success: true,
      user: {
        ...data,
        rights: data?.rights || rights || [],
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update user" },
      { status: 500 }
    );
  }
}
