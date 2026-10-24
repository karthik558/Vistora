import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getAdminClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

export async function GET() {
  try {
    const supabase = getAdminClient();
    const { data: properties, error } = await supabase
      .from("properties")
      .select("*, profiles:profiles(id, full_name, email, role)")
      .order("name", { ascending: true });

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

export async function POST(request: NextRequest) {
  try {
    // 1. Verify user cookie or authorization (Only Admins can create properties)
    const userCookie = request.cookies.get("vistora-user")?.value;
    let userRole = "visitor";
    if (userCookie) {
      try {
        const u = JSON.parse(userCookie);
        userRole = u?.role || "visitor";
      } catch {}
    }

    if (userRole === "visitor") {
      return NextResponse.json(
        { success: false, error: "Access Restricted: Only workspace administrators can register new properties." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, code, location, country, brand, totalRooms, userIds } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: "Property name is required." }, { status: 400 });
    }

    const cleanName = name.trim();
    const cleanCode = (code || cleanName.replace(/[^a-zA-Z]/g, "").slice(0, 3)).trim().toUpperCase();
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

    // If specific users were selected to have access to this new property, update their profiles
    if (Array.isArray(userIds) && userIds.length > 0) {
      await supabase
        .from("profiles")
        .update({ property_id: property.id, updated_at: new Date().toISOString() })
        .in("id", userIds);
    }

    return NextResponse.json({ success: true, property }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to create property" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userCookie = request.cookies.get("vistora-user")?.value;
    let userRole = "visitor";
    if (userCookie) {
      try {
        const u = JSON.parse(userCookie);
        userRole = u?.role || "visitor";
      } catch {}
    }

    if (userRole === "visitor") {
      return NextResponse.json(
        { success: false, error: "Access Restricted: Only administrators can delete properties." },
        { status: 403 }
      );
    }

    const { propertyId } = await request.json();
    if (!propertyId) {
      return NextResponse.json({ success: false, error: "Property ID is required." }, { status: 400 });
    }

    const supabase = getAdminClient();
    const { error } = await supabase.from("properties").delete().eq("id", propertyId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Property removed successfully." });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to delete property" },
      { status: 500 }
    );
  }
}
