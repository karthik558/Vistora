import { NextRequest, NextResponse } from "next/server";
import { withWorkspace } from "../../../../lib/platform/http";
import {
  workspaceUser,
  serviceDb,
  PlatformError,
  checked,
} from "../../../../lib/platform/db";
import { canManageServiceJobs } from "../../../../lib/operations/access";
function actor() {
  const user = workspaceUser();
  if (!canManageServiceJobs(user))
    throw new PlatformError("Staff operations permission required.", 403);
  return user;
}
export const GET = withWorkspace(async () => {
  actor();
  return NextResponse.json(
    { publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null },
    { headers: { "Cache-Control": "private, no-store" } },
  );
});
export const POST = withWorkspace(async (request: NextRequest) => {
  const user = actor(),
    sub = await request.json();
  let endpoint: URL;
  try {
    endpoint = new URL(sub.endpoint);
  } catch {
    throw new PlatformError("Invalid push endpoint.");
  }
  // Sending push is a server request. Restrict hosts to browser-vendor push services to prevent SSRF.
  const host = endpoint.hostname,
    allowed =
      host === "fcm.googleapis.com" ||
      host === "updates.push.services.mozilla.com" ||
      host.endsWith(".push.services.mozilla.com") ||
      host === "web.push.apple.com" ||
      host.endsWith(".notify.windows.com");
  if (
    endpoint.protocol !== "https:" ||
    endpoint.port ||
    endpoint.username ||
    endpoint.password ||
    !allowed ||
    sub.endpoint.length > 2048
  )
    throw new PlatformError("Unsupported browser push provider.");
  if (
    !/^[A-Za-z0-9_-]{16,200}$/.test(sub.keys?.auth || "") ||
    !/^[A-Za-z0-9_-]{40,200}$/.test(sub.keys?.p256dh || "")
  )
    throw new PlatformError("Invalid push subscription keys.");
  const db = serviceDb();
  const existing = await db
    .from("ops_push_subscriptions")
    .select("user_id")
    .eq("endpoint", sub.endpoint)
    .maybeSingle();
  if (existing.error)
    throw new PlatformError(
      "Apply the operations migration before enabling push.",
      503,
    );
  // A shared device may be re-registered by its current authenticated operator.
  checked(
    await db
      .from("ops_push_subscriptions")
      .upsert(
        {
          organization_id: user.organizationId,
          user_id: user.id,
          endpoint: sub.endpoint,
          subscription: { endpoint: sub.endpoint, keys: sub.keys },
        },
        { onConflict: "endpoint" },
      )
      .select("id")
      .single(),
  );
  return NextResponse.json({ success: true });
});
export const DELETE = withWorkspace(async () => {
  const user = actor();
  checked(
    await serviceDb()
      .from("ops_push_subscriptions")
      .delete()
      .eq("user_id", user.id)
      .select("id"),
  );
  return NextResponse.json({ success: true });
});
