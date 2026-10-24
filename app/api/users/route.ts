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

export const DEFAULT_RIGHTS = {
  admin: ["manage_feedback", "manage_questionnaire", "export_reports", "manage_properties", "manage_users"],
  staff: ["manage_feedback", "manage_questionnaire", "export_reports"],
  visitor: [],
};

export async function GET() {
  try {
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const { data: profiles, error } = await adminClient
      .from("profiles")
      .select("id, email, full_name, role, property_id, properties(id, name, code), avatar_url, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Parse rights from profile metadata / avatar_url
    const usersWithRights = (profiles || []).map((p: any) => {
      let rights = DEFAULT_RIGHTS[p.role as keyof typeof DEFAULT_RIGHTS] || [];
      if (p.avatar_url && p.avatar_url.startsWith("{")) {
        try {
          const parsed = JSON.parse(p.avatar_url);
          if (Array.isArray(parsed.rights)) {
            rights = parsed.rights;
          }
        } catch {}
      }
      return {
        id: p.id,
        email: p.email,
        full_name: p.full_name,
        role: p.role,
        property_id: p.property_id,
        properties: p.properties,
        rights,
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
    const passwordHash = hashPassword(password.trim());
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

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: cleanEmail,
      password: password.trim(),
      email_confirm: true,
      user_metadata: {
        full_name: cleanName,
        role,
        rights: assignedRights,
      },
    });

    if (authError || !authData?.user) {
      return NextResponse.json(
        { success: false, error: authError?.message || "Failed to create user in authentication system." },
        { status: 500 }
      );
    }

    const newUserId = authData.user.id;

    // Encode password hash and assigned rights together
    const metadataPayload = JSON.stringify({
      pwd: passwordHash,
      rights: assignedRights,
    });

    // Upsert into public.profiles with optional property_id and rights assignment
    const { data: profileInsert, error: profileError } = await adminClient
      .from("profiles")
      .upsert({
        id: newUserId,
        email: cleanEmail,
        full_name: cleanName,
        role,
        property_id: propertyId || null,
        avatar_url: metadataPayload,
        updated_at: new Date().toISOString(),
      })
      .select("id, email, full_name, role, property_id, properties(id, name, code), created_at")
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
      return NextResponse.json({ success: false, error: "User ID is required." }, { status: 400 });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Retrieve existing profile
    const { data: currentProfile } = await adminClient
      .from("profiles")
      .select("avatar_url, role")
      .eq("id", userId)
      .single();

    let existingMeta: Record<string, any> = {};
    if (currentProfile?.avatar_url) {
      if (currentProfile.avatar_url.startsWith("{")) {
        try {
          existingMeta = JSON.parse(currentProfile.avatar_url);
        } catch {}
      } else {
        existingMeta = { pwd: currentProfile.avatar_url };
      }
    }

    if (Array.isArray(rights)) {
      existingMeta.rights = rights;
    }

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
      avatar_url: JSON.stringify(existingMeta),
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

    // Also update Supabase auth metadata
    try {
      await adminClient.auth.admin.updateUserById(userId, {
        user_metadata: {
          role: updatePayload.role || currentProfile?.role,
          rights: existingMeta.rights,
        },
      });
    } catch {}

    return NextResponse.json({
      success: true,
      user: {
        ...data,
        rights: existingMeta.rights || [],
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update user" },
      { status: 500 }
    );
  }
}
