import { NextResponse } from "next/server";
import { withWorkspace } from "../../../../lib/platform/http";
import { workspaceUser, PlatformError } from "../../../../lib/platform/db";
import { hasModuleAccess } from "../../../../lib/auth/modules";
// The verified user's short-lived JWT is used only in memory for RLS-protected WebSockets.
// Refresh tokens and the service-role key never enter the browser.
export const GET = withWorkspace(async () => {
  const user = workspaceUser();
  if (!hasModuleAccess(user, "hospitality"))
    throw new PlatformError("Hotel operations access required.", 403);
  return NextResponse.json(
    {
      token: user.accessToken,
      url: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
      key:
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.SUPABASE_ANON_KEY,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
});
