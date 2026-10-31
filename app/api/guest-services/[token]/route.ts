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
    .select("id,room_id,room_number,status,guest_id")
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

    let guestName = "";
    if (stay.guest_id) {
      const guest = await db
        .from("guests")
        .select("full_name")
        .eq("id", stay.guest_id)
        .maybeSingle();
      if (guest.data?.full_name) {
        guestName = guest.data.full_name;
      }
    }

    return NextResponse.json(
      {
        room: stay.room_number,
        property: property.name,
        guestName,
        requests: requests.data,
        wifi: {
          ssid: "Vistora-Guest-HighSpeed",
          password: "vistora-luxury-stay",
        },
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
      { db, hash, link, stay } = await context(token),
      body = await request.json();

    if (body.action === "pulse") {
      const rating = Number(body.rating);
      if (!rating || rating < 1 || rating > 5) {
        throw new PlatformError("Rating must be between 1 and 5.", 400);
      }
      if (rating <= 3) {
        const issues = Array.isArray(body.issues)
          ? body.issues.slice(0, 5).join(", ")
          : "";
        const comment =
          typeof body.comment === "string" ? body.comment.slice(0, 1000) : "";
        await db.from("service_jobs").insert({
          organization_id: link.organization_id,
          property_id: link.property_id,
          room_id: stay.room_id || null,
          kind: "guest_request",
          title: `In-Stay Concern (Room ${stay.room_number})`,
          description: `Guest Rating: ${rating}/5.${issues ? " Tags: " + issues + "." : ""}${comment ? " Note: " + comment : ""}`,
          department: "Front Desk",
          location: String(stay.room_number),
          priority: rating === 1 ? "critical" : "high",
          intake_channel: "guest_request",
          due_at: new Date(Date.now() + 15 * 60000).toISOString(),
          source_key: `pulse:${stay.id}:${Date.now()}`,
        });
      }
      return NextResponse.json(
        {
          success: true,
          message:
            rating <= 3
              ? "Your concern has been escalated directly to the Duty Manager. A team member will attend to your room promptly."
              : "Thank you for letting us know! We are delighted you are enjoying your stay.",
        },
        { headers },
      );
    }

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
