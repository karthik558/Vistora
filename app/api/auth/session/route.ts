import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(request: NextRequest) {
  try {
    // 1. Check workspace session cookie
    const userCookie = request.cookies.get("vistora-user")?.value;
    if (userCookie) {
      try {
        const parsed = JSON.parse(userCookie);
        if (parsed && parsed.email) {
          // Query Supabase profiles table for latest role and name
          try {
            const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
              auth: { persistSession: false },
            });
            const { data: profile } = await adminClient
              .from("profiles")
              .select("*")
              .ilike("email", parsed.email)
              .maybeSingle();

            if (profile) {
              parsed.fullName = profile.full_name;
              parsed.role = profile.role;
              parsed.propertyId = profile.property_id || null;
              parsed.propertyIds = Array.isArray(profile.property_ids) && profile.property_ids.length > 0
                ? profile.property_ids
                : profile.property_id
                ? [profile.property_id]
                : [];
              parsed.rights = profile.rights || [];
            }
          } catch {}

          const response = NextResponse.json({
            success: true,
            user: parsed,
          });
          response.cookies.set("vistora-user", JSON.stringify(parsed), {
            httpOnly: false,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 7,
            path: "/",
          });
          return response;
        }
      } catch {
        // Fall through to token check
      }
    }

    // 2. Check Supabase access token
    const token = request.cookies.get("sb-access-token")?.value;
    if (token) {
      try {
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
          auth: { persistSession: false },
        });
        const { data, error } = await supabase.auth.getUser(token);
        if (!error && data?.user) {
          // Look up profile in Supabase
          const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { persistSession: false },
          });
          const { data: profile } = await adminClient
            .from("profiles")
            .select("*")
            .eq("id", data.user.id)
            .maybeSingle();

          const role = profile?.role || data.user.user_metadata?.role || "admin";
          const fullName = profile?.full_name || data.user.user_metadata?.full_name || data.user.email?.split("@")[0];

          const propertyIds = Array.isArray(profile?.property_ids) && profile.property_ids.length > 0
            ? profile.property_ids
            : profile?.property_id
            ? [profile.property_id]
            : [];

          const userData = {
            id: data.user.id,
            email: data.user.email,
            fullName,
            role,
            propertyId: profile?.property_id || null,
            propertyIds,
            rights: profile?.rights || data.user.user_metadata?.rights || [],
          };
          const response = NextResponse.json({
            success: true,
            user: userData,
          });
          response.cookies.set("vistora-user", JSON.stringify(userData), {
            httpOnly: false,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 7,
            path: "/",
          });
          return response;
        }
      } catch {
        // Return null session
      }
    }

    return NextResponse.json({
      success: false,
      user: null,
    });
  } catch {
    return NextResponse.json({
      success: false,
      user: null,
    });
  }
}
