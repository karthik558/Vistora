import { NextRequest, NextResponse } from "next/server";
import { checked, PlatformError, serviceDb, sessionDb, workspaceContext } from "../platform/db";
import {effectiveModuleRights} from "./modules";

export interface VerifiedUser {
  id: string; email: string; fullName: string; role: string; orgRole?: string;
  organizationId: string; isOrganizationAdmin: boolean; accessToken: string;
  propertyId: string | null; propertyIds: string[]; rights: string[];
}
interface CachedUserEntry {
  user: VerifiedUser;
  expiresAt: number;
}
const userAuthCache = new Map<string, CachedUserEntry>();

// Fast session-level auth cache prevents redundant Supabase auth/profile queries on every page transition.
export function invalidateAuthCache(identifier?: string) {
  if (identifier) {
    for (const [token, entry] of userAuthCache.entries()) {
      if (entry.user.email === identifier || entry.user.id === identifier || token === identifier) {
        userAuthCache.delete(token);
      }
    }
  } else {
    userAuthCache.clear();
  }
}
export function invalidateSessionCache(email?: string) {
  invalidateAuthCache(email);
}
export function getCachedProfile(_email: string): any | null { return null; }
export function setCachedProfile(_email: string, _profile: any) {}

export async function getAuthenticatedUser(request: NextRequest): Promise<VerifiedUser | null> {
  const existing = workspaceContext.getStore();
  if (existing) return existing.user;
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : request.cookies.get("sb-access-token")?.value;
  if (!token) return null;

  const now = Date.now();
  const cached = userAuthCache.get(token);
  if (cached && cached.expiresAt > now) {
    return cached.user;
  }

  const { data, error } = await sessionDb(token).auth.getUser(token);
  if (error || !data.user) {
    userAuthCache.delete(token);
    return null;
  }
  const db = serviceDb();
  const { data: profile, error: profileError } = await db.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
  if (profileError) checked({data: profile, error: profileError});
  if (!profile) return null;
  const memberResult = await db.from("organization_members").select("organization_id, role").eq("user_id", data.user.id).eq("is_active", true).maybeSingle();
  if(memberResult.error)checked(memberResult);
  const membership=memberResult.data;
  if(!membership)return null;
  if (!membership.organization_id || membership.organization_id !== profile.organization_id) throw new PlatformError("Your workspace membership is not configured.", 403);
  const rights = Array.isArray(profile.rights) ? profile.rights.filter((r: unknown) => typeof r === "string") : [];
  const isAdmin = ["owner", "admin"].includes(membership.role);
  const { data: properties, error: propError } = await sessionDb(token).from("properties").select("id");
  if (propError) checked({data: properties, error: propError});
  const verified: VerifiedUser = {
    id: data.user.id, email: data.user.email || "", fullName: profile.full_name,
    role: isAdmin ? "admin" : profile.role, orgRole: rights.find((r: string) => r.startsWith("org_role:"))?.slice(9) || profile.role,
    organizationId: membership.organization_id, isOrganizationAdmin: isAdmin, accessToken: token,
    propertyId: profile.property_id, propertyIds: (properties || []).map(p => p.id), rights:effectiveModuleRights(rights,isAdmin)
  };
  userAuthCache.set(token, { user: verified, expiresAt: now + 15_000 });
  return verified;
}
export function publicUser(user: VerifiedUser) {
  const { accessToken: _token, ...safe } = user;
  return safe;
}
export async function requireAdmin(request: NextRequest): Promise<{user: VerifiedUser; errorResponse?: never} | {user?: never; errorResponse: NextResponse}> {
  const user = await getAuthenticatedUser(request);
  if (!user) return { errorResponse: NextResponse.json({success:false,error:"Authentication required."},{status:401}) };
  if (!user.isOrganizationAdmin) return { errorResponse: NextResponse.json({success:false,error:"Workspace administrator access required."},{status:403}) };
  return {user};
}
export async function requireAdminOrRight(request: NextRequest, right: string): ReturnType<typeof requireAdmin> {
  const user = await getAuthenticatedUser(request);
  if (!user) return { errorResponse: NextResponse.json({success:false,error:"Authentication required."},{status:401}) };
  if (!user.isOrganizationAdmin && !user.rights.includes(right)) return { errorResponse: NextResponse.json({success:false,error:"Permission required: "+right},{status:403}) };
  return {user};
}
export function getPropertyAccessScope(user: VerifiedUser | null) {
  return { isGlobal: false, allowedPropertyIds: user?.propertyIds || [] };
}
