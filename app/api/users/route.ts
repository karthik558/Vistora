import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin, requireAdminOrRight, getAuthenticatedUser, invalidateAuthCache, invalidateSessionCache } from "../../../lib/auth/serverAuth";
import { sanitizeString, sanitizeEmail } from "../../../lib/security/sanitize";

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

export async function GET(request: NextRequest) {
  try {
    // Authenticate caller
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentication required to view users." },
        { status: 401 }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const { data: profiles, error } = await adminClient
      .from("profiles")
      .select("id, email, full_name, role, property_id, property_ids, properties(id, name, code), rights, avatar_url, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const usersWithRights = (profiles || []).map((p: any) => {
      let rights = p.role === "admin"
        ? DEFAULT_RIGHTS.admin
        : Array.isArray(p.rights) && p.rights.length > 0
        ? p.rights
        : DEFAULT_RIGHTS[p.role as keyof typeof DEFAULT_RIGHTS] || [];

      const cleanAvatar = p.avatar_url && (p.avatar_url.startsWith("{") || p.avatar_url.startsWith("pwd:"))
        ? null
        : p.avatar_url;

      const propertyIds = Array.isArray(p.property_ids) && p.property_ids.length > 0
        ? p.property_ids
        : p.property_id
        ? [p.property_id]
        : [];

      return {
        id: p.id,
        email: p.email,
        full_name: p.full_name,
        role: p.role,
        property_id: p.property_id,
        property_ids: propertyIds,
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
    // Strict authorization check: Admin role or manage_users permission required
    const authCheck = await requireAdminOrRight(request, "manage_users");
    if (authCheck.errorResponse) return authCheck.errorResponse;

    const body = await request.json();
    const { email, fullName, role = "visitor", password, propertyId, propertyIds, rights } = body;

    const cleanEmail = sanitizeEmail(email);
    const cleanName = sanitizeString(fullName, 100);

    if (!cleanEmail) {
      return NextResponse.json({ success: false, error: "A valid email address is required." }, { status: 400 });
    }

    if (!cleanName) {
      return NextResponse.json({ success: false, error: "Full name is required." }, { status: 400 });
    }

    if (!password || typeof password !== "string" || password.trim().length < 6) {
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

    const assignedRights = role === "admin"
      ? DEFAULT_RIGHTS.admin
      : Array.isArray(rights)
      ? rights
      : DEFAULT_RIGHTS[role as keyof typeof DEFAULT_RIGHTS] || [];

    // Parse multi-property access
    let resolvedPropertyIds: string[] = [];
    if (role === "admin") {
      resolvedPropertyIds = [];
    } else if (Array.isArray(propertyIds)) {
      resolvedPropertyIds = propertyIds.filter((id) => typeof id === "string" && id.trim().length > 0);
    } else if (propertyId && typeof propertyId === "string" && propertyId.trim().length > 0) {
      resolvedPropertyIds = [propertyId.trim()];
    }

    const primaryPropertyId = resolvedPropertyIds.length === 1 ? resolvedPropertyIds[0] : null;

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

    // 1. Create user in Supabase Auth
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: cleanEmail,
      password: password.trim(),
      email_confirm: true,
      user_metadata: {
        full_name: cleanName,
        role,
        rights: assignedRights,
        property_id: primaryPropertyId,
        property_ids: resolvedPropertyIds,
      },
    });

    if (authError || !authData?.user) {
      return NextResponse.json(
        { success: false, error: authError?.message || "Failed to create user in authentication system." },
        { status: 500 }
      );
    }

    const newUserId = authData.user.id;

    // 2. Insert into public.profiles
    const profilePayload: Record<string, any> = {
      id: newUserId,
      email: cleanEmail,
      full_name: cleanName,
      role,
      property_id: primaryPropertyId,
      property_ids: resolvedPropertyIds,
      avatar_url: null,
      rights: assignedRights,
      updated_at: new Date().toISOString(),
    };

    const { data: profileInsert, error: profileError } = await adminClient
      .from("profiles")
      .upsert(profilePayload)
      .select("id, email, full_name, role, property_id, property_ids, properties(id, name, code), rights, created_at")
      .single();

    if (profileError) {
      return NextResponse.json({ success: false, error: profileError.message }, { status: 500 });
    }

    invalidateAuthCache(cleanEmail);
    invalidateSessionCache(cleanEmail);

    return NextResponse.json({
      success: true,
      user: {
        ...profileInsert,
        rights: assignedRights,
        property_ids: resolvedPropertyIds,
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
    // Strict authorization check: Admin role or manage_users permission required
    const authCheck = await requireAdminOrRight(request, "manage_users");
    if (authCheck.errorResponse) return authCheck.errorResponse;

    const body = await request.json();
    const { userId, role, propertyId, propertyIds, rights, fullName } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: "User ID is required" }, { status: 400 });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const { data: currentProfile } = await adminClient
      .from("profiles")
      .select("avatar_url, role, property_id, property_ids")
      .eq("id", userId)
      .single();

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (fullName !== undefined && typeof fullName === "string" && fullName.trim().length > 0) {
      updatePayload.full_name = sanitizeString(fullName, 100);
    }

    const effectiveRole = role && ["admin", "staff", "visitor"].includes(role) ? role : currentProfile?.role;
    if (role && ["admin", "staff", "visitor"].includes(role)) {
      updatePayload.role = role;
    }

    // Resolve property access
    if (effectiveRole === "admin") {
      updatePayload.property_id = null;
      updatePayload.property_ids = [];
      updatePayload.rights = DEFAULT_RIGHTS.admin;
    } else {
      let resolvedPropertyIds: string[] | undefined = undefined;
      if (Array.isArray(propertyIds)) {
        resolvedPropertyIds = propertyIds.filter((id) => typeof id === "string" && id.trim().length > 0);
      } else if (propertyId !== undefined) {
        resolvedPropertyIds = propertyId ? [propertyId] : [];
      }

      if (resolvedPropertyIds !== undefined) {
        updatePayload.property_ids = resolvedPropertyIds;
        updatePayload.property_id = resolvedPropertyIds.length === 1 ? resolvedPropertyIds[0] : null;
      }

      if (Array.isArray(rights)) {
        updatePayload.rights = rights;
      }
    }

    // Clean legacy avatar artifacts
    if (
      currentProfile?.avatar_url &&
      (currentProfile.avatar_url.startsWith("{") || currentProfile.avatar_url.startsWith("pwd:"))
    ) {
      updatePayload.avatar_url = null;
    }

    const { data, error } = await adminClient
      .from("profiles")
      .update(updatePayload)
      .eq("id", userId)
      .select("id, email, full_name, role, property_id, property_ids, properties(id, name, code), rights")
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Sync metadata to Supabase Auth
    try {
      await adminClient.auth.admin.updateUserById(userId, {
        user_metadata: {
          full_name: updatePayload.full_name || undefined,
          role: updatePayload.role || currentProfile?.role,
          rights: updatePayload.rights || rights || [],
          property_id: updatePayload.property_id !== undefined ? updatePayload.property_id : currentProfile?.property_id,
          property_ids: updatePayload.property_ids !== undefined ? updatePayload.property_ids : currentProfile?.property_ids,
        },
      });
    } catch {}

    if (data?.email) {
      invalidateAuthCache(data.email);
      invalidateSessionCache(data.email);
    }

    return NextResponse.json({
      success: true,
      user: {
        ...data,
        rights: data?.rights || rights || [],
        property_ids: data?.property_ids || updatePayload.property_ids || [],
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update user" },
      { status: 500 }
    );
  }
}
