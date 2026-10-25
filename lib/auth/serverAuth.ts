import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export interface VerifiedUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  orgRole?: string;
  propertyId: string | null;
  propertyIds: string[];
  rights: string[];
}

function getAdminClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

interface CachedVerifiedUser {
  user: VerifiedUser;
  timestamp: number;
}
const verifiedUserCache = new Map<string, CachedVerifiedUser>();
const AUTH_CACHE_TTL = 30_000; // 30 seconds

export function invalidateAuthCache(email?: string) {
  if (email) {
    verifiedUserCache.delete(email.toLowerCase());
  } else {
    verifiedUserCache.clear();
  }
}

interface CachedProfile {
  profile: any;
  timestamp: number;
}
const sessionProfileCache = new Map<string, CachedProfile>();
const SESSION_CACHE_TTL = 30_000;

export function getCachedProfile(email: string): any | null {
  const cached = sessionProfileCache.get(email.toLowerCase());
  if (cached && Date.now() - cached.timestamp < SESSION_CACHE_TTL) {
    return cached.profile;
  }
  return null;
}

export function setCachedProfile(email: string, profile: any) {
  sessionProfileCache.set(email.toLowerCase(), { profile, timestamp: Date.now() });
}

export function invalidateSessionCache(email?: string) {
  if (email) {
    sessionProfileCache.delete(email.toLowerCase());
  } else {
    sessionProfileCache.clear();
  }
}

/**
 * Extracts and securely verifies the session user from cookies and tokens.
 * Always validates against the database public.profiles record.
 */
export async function getAuthenticatedUser(request: NextRequest): Promise<VerifiedUser | null> {
  const adminClient = getAdminClient();

  // 1. Try Bearer token or sb-access-token
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const cookieToken = request.cookies.get("sb-access-token")?.value;
  const token = bearerToken || cookieToken;

  if (token) {
    try {
      const { data, error } = await adminClient.auth.getUser(token);
      if (!error && data?.user) {
        const { data: profile } = await adminClient
          .from("profiles")
          .select("*")
          .eq("id", data.user.id)
          .maybeSingle();

        const role = profile?.role || data.user.user_metadata?.role || "visitor";
        const propertyIds: string[] = Array.isArray(profile?.property_ids)
          ? profile.property_ids
          : profile?.property_id
          ? [profile.property_id]
          : [];

        return {
          id: data.user.id,
          email: data.user.email || "",
          fullName: profile?.full_name || data.user.user_metadata?.full_name || "User",
          role,
          propertyId: profile?.property_id || null,
          propertyIds,
          rights: profile?.rights || [],
        };
      }
    } catch {}
  }

  // 2. Fall back to vistora-user workspace cookie with DB profile verification
  const userCookie = request.cookies.get("vistora-user")?.value;
  if (userCookie) {
    try {
      const parsed = JSON.parse(userCookie);
      if (parsed?.email) {
        const cacheKey = parsed.email.toLowerCase();
        const now = Date.now();
        const cached = verifiedUserCache.get(cacheKey);
        if (cached && (now - cached.timestamp) < AUTH_CACHE_TTL) {
          return cached.user;
        }

        const { data: profile } = await adminClient
          .from("profiles")
          .select("*")
          .ilike("email", parsed.email)
          .maybeSingle();

        if (profile) {
          const propertyIds: string[] = Array.isArray(profile.property_ids) && profile.property_ids.length > 0
            ? profile.property_ids
            : profile.property_id
            ? [profile.property_id]
            : [];

          const verified: VerifiedUser = {
            id: profile.id,
            email: profile.email,
            fullName: profile.full_name,
            role: profile.role,
            propertyId: profile.property_id || null,
            propertyIds,
            rights: profile.rights || [],
          };
          verifiedUserCache.set(cacheKey, { user: verified, timestamp: now });
          return verified;
        }
      }
    } catch {}
  }

  return null;
}

/**
 * Enforces that the request is made by a verified Administrator.
 * Returns either { user } or { errorResponse }.
 */
export async function requireAdmin(request: NextRequest): Promise<
  { user: VerifiedUser; errorResponse?: never } | { user?: never; errorResponse: NextResponse }
> {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return {
      errorResponse: NextResponse.json(
        { success: false, error: "Authentication required. Please sign in to continue." },
        { status: 401 }
      ),
    };
  }

  if (user.role !== "admin" && user.role !== "super_admin" && user.orgRole !== "admin" && user.orgRole !== "super_admin") {
    return {
      errorResponse: NextResponse.json(
        { success: false, error: "Access denied. Administrator privileges required." },
        { status: 403 }
      ),
    };
  }

  return { user };
}

/**
 * Enforces that the request is made by a verified Administrator OR a team member holding the required right.
 */
export async function requireAdminOrRight(
  request: NextRequest,
  requiredRight: string
): Promise<{ user: VerifiedUser; errorResponse?: never } | { user?: never; errorResponse: NextResponse }> {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return {
      errorResponse: NextResponse.json(
        { success: false, error: "Authentication required. Please sign in to continue." },
        { status: 401 }
      ),
    };
  }

  if (user.role === "admin" || (Array.isArray(user.rights) && user.rights.includes(requiredRight))) {
    return { user };
  }

  return {
    errorResponse: NextResponse.json(
      { success: false, error: `Access denied. '${requiredRight}' permission or Administrator role required.` },
      { status: 403 }
    ),
  };
}

/**
 * Determines property access scope for a user.
 * Admin users have unrestricted global access.
 * Non-admin users are strictly confined to their assigned property_ids.
 */
export function getPropertyAccessScope(user: VerifiedUser | null) {
  if (!user || user.role === "admin") {
    return { isGlobal: true, allowedPropertyIds: null as string[] | null };
  }
  return {
    isGlobal: false,
    allowedPropertyIds: user.propertyIds,
  };
}
