import { withWorkspace, errorResponse } from "../../../lib/platform/http";
import { workspaceDb, serviceDb, checked } from "../../../lib/platform/db";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedUser, requireAdmin, requireAdminOrRight } from "../../../lib/auth/serverAuth";
import { sanitizeString } from "../../../lib/security/sanitize";
import { invalidateDashboardCache } from "../../../lib/services/guestExperienceService";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY!;

function getAdminClient() { return workspaceDb(); }

async function GETImpl(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    const supabase = getAdminClient();

    let query = supabase
      .from("properties")
      .select("*, profiles:profiles(id, full_name, email, role)")
      .order("name", { ascending: true });

    // Multi-tenant isolation: Only Super Admins see all properties globally.
    // Hotel Admins and staff only see properties they are assigned to.
    const isSuperAdmin = user?.orgRole === "super_admin" || (user?.rights || []).includes("org_role:super_admin");
    if (user && !isSuperAdmin) {
      const allowed = user.propertyIds?.length
        ? user.propertyIds
        : user.propertyId
        ? [user.propertyId]
        : [];
      if (allowed.length === 0) {
        return NextResponse.json({ success: true, properties: [] });
      }
      query = query.in("id", allowed);
    }

    const { data: properties, error } = await query;

    if (error) {
      console.error("[Supabase Error] properties query failed:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, properties: properties || [] });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch properties" },
      { status: 500 }
    );
  }
}

async function POSTImpl(request: NextRequest) {
  try {
    // Strictly require administrator or manage_properties privileges
    const authCheck = await requireAdminOrRight(request, "manage_properties");
    if (authCheck.errorResponse) return authCheck.errorResponse;

    const body = await request.json();
    const { name, code, location, country, brand, totalRooms, userIds } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: "Property name is required." }, { status: 400 });
    }

    const cleanName = sanitizeString(name, 100);
    const cleanCode = (code || cleanName.replace(/[^a-zA-Z]/g, "").slice(0, 3)).trim().toUpperCase().slice(0, 10);
    const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    const supabase = getAdminClient();

    // Insert new property
    const { data: property, error: insertError } = await supabase
      .from("properties")
      .insert({
        name: cleanName,
        slug,
        code: cleanCode,
        brand: brand?.trim() || "Vistora Hotels & Resorts",
        location: location?.trim() || "Bangkok",
        country: country?.trim() || "Thailand",
        timezone: "Asia/Bangkok",
        total_rooms: Number(totalRooms) || 120,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[Supabase Error] Insert property failed:", insertError);
      return NextResponse.json({ success: false, error: insertError.message }, { status: 500 });
    }

    // Assign to users if provided
    if (Array.isArray(userIds) && userIds.length > 0) {
      for (const uId of userIds) {
        try {
          const { data: p } = await supabase.from("profiles").select("property_ids").eq("id", uId).single();
          const existing = Array.isArray(p?.property_ids) ? p.property_ids : [];
          const nextIds = existing.includes(property.id) ? existing : [...existing, property.id];
          await supabase
            .from("profiles")
            .update({
              property_id: property.id,
              property_ids: nextIds,
              updated_at: new Date().toISOString(),
            })
            .eq("id", uId);

          await supabase
            .from("property_access")
            .upsert({ user_id: uId, property_id: property.id, role: "staff" }, { onConflict: "user_id,property_id" });
        } catch {}
      }
    }

    invalidateDashboardCache();
    return NextResponse.json({ success: true, property }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to create property" },
      { status: 500 }
    );
  }
}

async function PATCHImpl(request: NextRequest) {
  try {
    const authCheck = await requireAdminOrRight(request, "manage_properties");
    if (authCheck.errorResponse) return authCheck.errorResponse;

    const body = await request.json();
    const { propertyId, id, name, code, location, country, brand, totalRooms, isActive, is_active } = body;

    const targetId = propertyId || id;
    if (!targetId) {
      return NextResponse.json({ success: false, error: "Property ID is required." }, { status: 400 });
    }

    const updatePayload: Record<string, any> = {};
    if (name !== undefined) updatePayload.name = sanitizeString(name, 100);
    if (code !== undefined) updatePayload.code = sanitizeString(code, 10).toUpperCase();
    if (location !== undefined) updatePayload.location = sanitizeString(location, 100);
    if (country !== undefined) updatePayload.country = sanitizeString(country, 100);
    if (brand !== undefined) updatePayload.brand = sanitizeString(brand, 100);
    if (totalRooms !== undefined) updatePayload.total_rooms = Number(totalRooms);
    if (isActive !== undefined || is_active !== undefined) {
      updatePayload.is_active = isActive !== undefined ? Boolean(isActive) : Boolean(is_active);
    }

    const supabase = getAdminClient();
    const { data: updated, error } = await supabase
      .from("properties")
      .update(updatePayload)
      .eq("id", targetId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    invalidateDashboardCache();
    return NextResponse.json({ success: true, property: updated });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update property" },
      { status: 500 }
    );
  }
}

async function DELETEImpl(request: NextRequest) {
  try {
    // Strictly require administrator or manage_properties privileges
    const authCheck = await requireAdminOrRight(request, "manage_properties");
    if (authCheck.errorResponse) return authCheck.errorResponse;

    const { propertyId } = await request.json();
    if (!propertyId) {
      return NextResponse.json({ success: false, error: "Property ID is required." }, { status: 400 });
    }

    const supabase = getAdminClient();
    const { error } = await supabase.from("properties").delete().eq("id", propertyId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    invalidateDashboardCache();
    return NextResponse.json({ success: true, message: "Property removed successfully." });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to delete property" },
      { status: 500 }
    );
  }
}
export async function GET(request:NextRequest) {
 if(request.nextUrl.searchParams.get("public")!=="true"&&(request.cookies.get("sb-access-token") || request.headers.get("authorization")))return withWorkspace(GETImpl)(request);
 try {
  const properties=checked(await serviceDb().from("properties").select("id,name,code,location,is_active,organizations(name,logo_url,brand_color,welcome_message)").eq("is_active",true).order("name"));
  return NextResponse.json({success:true,properties});
 }catch(error){return errorResponse(error);}
}
export const POST=withWorkspace(POSTImpl,"manage_properties");
export const PATCH=withWorkspace(PATCHImpl,"manage_properties");
export const DELETE=withWorkspace(DELETEImpl,"manage_properties");
