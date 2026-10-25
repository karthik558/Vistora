import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin, requireAdminOrRight, getAuthenticatedUser, invalidateAuthCache, invalidateSessionCache } from "../../../lib/auth/serverAuth";
import { sanitizeString, sanitizeEmail } from "../../../lib/security/sanitize";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY!;

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

    // Synchronize with dedicated property_access table if populated
    let propertyAccessMap: Record<string, string[]> = {};
    try {
      const { data: accessRows } = await adminClient
        .from("property_access")
        .select("user_id, property_id");
      if (Array.isArray(accessRows)) {
        for (const row of accessRows) {
          if (!propertyAccessMap[row.user_id]) propertyAccessMap[row.user_id] = [];
          if (!propertyAccessMap[row.user_id].includes(row.property_id)) {
            propertyAccessMap[row.user_id].push(row.property_id);
          }
        }
      }
    } catch {}

    const usersWithRights = (profiles || []).map((p: any) => {
      let rights = Array.isArray(p.rights) && p.rights.length > 0
        ? p.rights
        : p.role === "admin"
        ? DEFAULT_RIGHTS.admin
        : DEFAULT_RIGHTS[p.role as keyof typeof DEFAULT_RIGHTS] || [];

      const cleanAvatar = p.avatar_url && (p.avatar_url.startsWith("{") || p.avatar_url.startsWith("pwd:"))
        ? null
        : p.avatar_url;

      const accessPropIds = propertyAccessMap[p.id] || [];
      const propertyIds = accessPropIds.length > 0
        ? accessPropIds
        : Array.isArray(p.property_ids) && p.property_ids.length > 0
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

    const VALID_ORG_ROLES = [
      "super_admin",
      "admin",
      "general_manager",
      "department_head",
      "executive",
      "front_office_staff",
      "feedback",
      "analyst",
      "report",
      "staff",
      "visitor",
    ];

    if (!VALID_ORG_ROLES.includes(role)) {
      return NextResponse.json(
        { success: false, error: "Please select a valid organizational role." },
        { status: 400 }
      );
    }

    const dbRole: "admin" | "staff" | "visitor" =
      role === "super_admin" || role === "admin" ? "admin" : "staff";

    const baseRights = Array.isArray(rights) ? rights : [];
    const assignedRights = [
      ...baseRights.filter((r: string) => !r.startsWith("org_role:")),
      `org_role:${role}`,
    ];

    // Parse multi-property access: only super_admin has global access across all properties
    let resolvedPropertyIds: string[] = [];
    if (role === "super_admin") {
      resolvedPropertyIds = [];
    } else if (Array.isArray(propertyIds)) {
      resolvedPropertyIds = propertyIds.filter((id) => typeof id === "string" && id.trim().length > 0);
    } else if (propertyId && typeof propertyId === "string" && propertyId.trim().length > 0) {
      resolvedPropertyIds = [propertyId.trim()];
    }

    const primaryPropertyId = resolvedPropertyIds.length > 0 ? resolvedPropertyIds[0] : null;

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

    // 3. Synchronize with dedicated property_access table if present
    if (resolvedPropertyIds.length > 0) {
      try {
        const accessRows = resolvedPropertyIds.map((pId) => ({
          user_id: newUserId,
          property_id: pId,
          role,
        }));
        await adminClient.from("property_access").insert(accessRows);
      } catch {}
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

    const VALID_ORG_ROLES = [
      "super_admin",
      "admin",
      "general_manager",
      "department_head",
      "executive",
      "front_office_staff",
      "feedback",
      "analyst",
      "report",
      "staff",
      "visitor",
    ];

    const chosenRole = role && VALID_ORG_ROLES.includes(role) ? role : undefined;
    const dbRole: "admin" | "staff" | "visitor" | undefined = chosenRole
      ? (chosenRole === "super_admin" || chosenRole === "admin" ? "admin" : "staff")
      : undefined;

    if (dbRole) {
      updatePayload.role = dbRole;
    }

    const effectiveRole = chosenRole || currentProfile?.role;
    let resolvedPropertyIds: string[] | undefined = undefined;

    // Resolve property access: only super_admin has global access across all properties
    if (effectiveRole === "super_admin") {
      resolvedPropertyIds = [];
      updatePayload.property_id = null;
      updatePayload.property_ids = [];
      updatePayload.rights = [
        ...DEFAULT_RIGHTS.admin,
        "view_guest_pii",
        "manage_settings",
        "view_audit_log",
        `org_role:super_admin`,
        `dept_scope:All Departments`,
      ];
    } else {
      if (Array.isArray(propertyIds)) {
        resolvedPropertyIds = propertyIds.filter((id) => typeof id === "string" && id.trim().length > 0);
      } else if (propertyId !== undefined) {
        resolvedPropertyIds = propertyId ? [propertyId] : [];
      }

      if (resolvedPropertyIds !== undefined) {
        updatePayload.property_ids = resolvedPropertyIds;
        updatePayload.property_id = resolvedPropertyIds.length > 0 ? resolvedPropertyIds[0] : null;
      }

      if (Array.isArray(rights)) {
        const rightsWithoutOrg = rights.filter((r) => !r.startsWith("org_role:"));
        updatePayload.rights = chosenRole
          ? [...rightsWithoutOrg, `org_role:${chosenRole}`]
          : rights;
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

    // Synchronize with dedicated property_access table if present
    if (resolvedPropertyIds !== undefined) {
      try {
        await adminClient.from("property_access").delete().eq("user_id", userId);
        if (resolvedPropertyIds.length > 0) {
          const accessRows = resolvedPropertyIds.map((pId) => ({
            user_id: userId,
            property_id: pId,
            role: effectiveRole || "staff",
          }));
          await adminClient.from("property_access").insert(accessRows);
        }
      } catch {}
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
