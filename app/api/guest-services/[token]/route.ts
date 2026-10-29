import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { serviceDb, PlatformError } from "../../../../lib/platform/db";
import { errorResponse } from "../../../../lib/platform/http";
import { uuid } from "../../../../lib/omniops/validation";
const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
};
async function context(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token))
    throw new PlatformError("This guest service link is unavailable.", 404);
  const db = serviceDb(),
    hash = createHash("sha256").update(token).digest("hex");
  const link = await db
    .from("guest_service_links")
    .select("id,organization_id,property_id,stay_id")
    .eq("token_hash", hash)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (link.error)
    throw new PlatformError("Guest services are temporarily unavailable.", 503);
  if (!link.data)
    throw new PlatformError(
      "This service link has expired. Contact reception for a new link.",
      404,
    );
  const stay = await db
    .from("stays")
    .select("id,room_number,status")
    .eq("id", link.data.stay_id)
    .eq("organization_id", link.data.organization_id)
    .eq("property_id", link.data.property_id)
    .eq("status", "active")
    .maybeSingle();
  const property = await db
    .from("properties")
    .select("name")
    .eq("id", link.data.property_id)
    .eq("is_active", true)
    .maybeSingle();
  if (stay.error || property.error || !stay.data || !property.data)
    throw new PlatformError(
      "This stay is no longer active. Contact reception.",
      404,
    );
  return {
    db,
    hash,
    link: link.data,
    stay: stay.data,
    property: property.data,
  };
}
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params,
      { db, link, stay, property } = await context(token);
    const requests = await db
      .from("guest_service_requests")
      .select("id,service,created_at,service_jobs(status)")
      .eq("link_id", link.id)
      .order("created_at", { ascending: false })
      .limit(10);
    if (requests.error)
      throw new PlatformError("Could not load service requests.", 503);
    return NextResponse.json(
      {
        room: stay.room_number,
        property: property.name,
        requests: requests.data,
      },
      { headers },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const origin = request.headers.get("origin");
    if (
      origin &&
      (origin === "null" || new URL(origin).host !== request.nextUrl.host)
    )
      throw new PlatformError("Cross-origin requests are not allowed.", 403);
    const { token } = await params,
      { db, hash } = await context(token),
      body = await request.json();
    const id = uuid(body.requestId, "Request identifier");
    if (
      !["towels", "toiletries", "room_service", "baggage", "valet"].includes(
        body.service,
      )
    )
      throw new PlatformError("Choose an available service.");
    const result = await db.rpc("ops_guest_request", {
      p_hash: hash,
      p_service: body.service,
      p_request_id: id,
    });
    if (result.error) throw new PlatformError(result.error.message, 400);
    return NextResponse.json({ success: true }, { headers });
  } catch (e) {
    return errorResponse(e);
  }
}
