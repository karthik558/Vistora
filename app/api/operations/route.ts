import { NextRequest, NextResponse } from "next/server";
import { createHmac, createHash } from "node:crypto";
import { withWorkspace, text } from "../../../lib/platform/http";
import {
  workspaceDb,
  workspaceUser,
  checked,
  PlatformError,
} from "../../../lib/platform/db";
import { hasModuleAccess } from "../../../lib/auth/modules";
import { hospitalityConfig } from "../../../lib/hospitality/config";

export const dynamic = "force-dynamic";
import { uuid } from "../../../lib/omniops/validation";

async function access() {
  if (!hasModuleAccess(workspaceUser(), "hospitality"))
    throw new PlatformError("Hotel operations access required.", 403);
  const ready = await workspaceDb().rpc("omniops_ready");
  if (ready.error || ready.data !== true)
    throw new PlatformError(
      workspaceUser().isOrganizationAdmin
        ? "The operations extension is not installed. Apply supabase/migrations/20261029_omniops.sql after schema section 27."
        : "The operations upgrade is pending. Contact your workspace administrator.",
      503,
    );
}
export const GET = withWorkspace(async (request: NextRequest) => {
  await access();
  const db = workspaceDb(),
    user = workspaceUser(),
    pid = request.nextUrl.searchParams.get("property") || "all";
  if (pid !== "all")
    checked(
      await db
        .from("properties")
        .select("id")
        .eq("id", uuid(pid, "Property"))
        .single(),
    );
  const scope = (q: any) => (pid === "all" ? q : q.eq("property_id", pid));
  const config = hospitalityConfig(checked(await db.rpc("omniops_config")));
  if (!config.modules.operations)
    throw new PlatformError("Operations are disabled in Settings.", 403);
  const tables: Record<string, string> = {
    assets: "ops_assets",
    maintenance: "maintenance_tasks",
    luggage: "luggage_logs",
    valet: "valet_tickets",
    breakfast: "breakfast_attendance",
    catalog: "minibar_catalog",
    cleaning: "room_cleaning_runs",
    templates: "inspection_templates",
    inspections: "room_inspections",
    evidence: "inspection_evidence",
    telephony: "telephony_events",
    audit: "audit_trails",
    ...(user.isOrganizationAdmin
      ? {
          folios: "folio_entries",
          compensations: "incident_compensations",
          webhooks: "ops_breakfast_webhooks",
        }
      : {}),
  };
  const result: Record<string, unknown> = {
    ready: true,
    currency: config.currency,
    defaultChecklist: config.inspectionChecklist,
    callRateMinor: config.callRateMinor || 0,
    folios: [],
    compensations: [],
  };
  let truncated = false;
  const activeStates: Record<string, string[]> = {
    luggage: ["stored", "requested", "in_transit"],
    valet: ["parked", "requested", "retrieving"],
    telephony: ["scheduled", "due"],
    folios: ["pending", "approved"],
  };
  const recentHistory = new Set([
    "audit",
    "inspections",
    "evidence",
    "cleaning",
    "breakfast",
    "compensations",
  ]);
  await Promise.all(
    Object.entries(tables).map(async ([key, table]) => {
      if (activeStates[key]) {
        const states = activeStates[key];
        const [active, closed] = await Promise.all([
          scope(
            db
              .from(table)
              .select("*")
              .in("status", states)
              .order("created_at")
              .limit(251),
          ),
          scope(
            db
              .from(table)
              .select("*")
              .not("status", "in", `(${states.join(",")})`)
              .order("created_at", { ascending: false })
              .limit(50),
          ),
        ]);
        const rows = checked<any[]>(active);
        if (rows.length > 250) truncated = true;
        result[key] = [...rows.slice(0, 250), ...checked<any[]>(closed)];
      } else {
        const rows = checked<any[]>(
          await scope(
            db
              .from(table)
              .select("*")
              .order("created_at", { ascending: false })
              .limit(251),
          ),
        );
        if (rows.length > 250 && !recentHistory.has(key)) truncated = true;
        result[key] = rows.slice(0, 250);
      }
    }),
  );
  const [rooms, stays, jobs, closed, summary, trend] = await Promise.all([
    scope(
      db
        .from("hotel_rooms")
        .select("id,property_id,room_number,room_type,status,floor,notes")
        .order("room_number")
        .limit(501),
    ),
    scope(
      db
        .from("stays")
        .select(
          "id,property_id,room_id,room_number,guest_count,status,check_in_date,check_out_date",
        )
        .in("status", ["active", "reserved"])
        .order("check_in_date")
        .limit(501),
    ),
    scope(
      db
        .from("service_jobs")
        .select("*,assignee:profiles!assigned_to(full_name)")
        .in("status", ["open", "in_progress"])
        .order("due_at")
        .limit(501),
    ),
    scope(
      db
        .from("service_jobs")
        .select("*,assignee:profiles!assigned_to(full_name)")
        .in("status", ["completed", "cancelled"])
        .order("updated_at", { ascending: false })
        .limit(100),
    ),
    db.rpc("omniops_summary", { p_property: pid === "all" ? null : pid }),
    db.rpc("omniops_trend", { p_property: pid === "all" ? null : pid }),
  ]);
  for (const [key, res] of Object.entries({ rooms, stays, jobs })) {
    const rows = checked<any[]>(res);
    if (rows.length > 500) truncated = true;
    result[key] = rows.slice(0, 500);
  }
  result.jobs = [...(result.jobs as any[]), ...checked<any[]>(closed)];
  result.summary = checked(summary);
  result.trend = checked(trend);
  result.feedback =
    user.isOrganizationAdmin ||
    (hasModuleAccess(user, "feedback") && user.rights.includes("view_feedback"))
      ? checked(
          await scope(
            db
              .from("feedback")
              .select("id,property_id,room_number,department,rating")
              .neq("status", "resolved")
              .order("created_at", { ascending: false })
              .limit(100),
          ),
        )
      : [];
  result.webhookEndpoints = user.isOrganizationAdmin
    ? checked(
        await db
          .from("webhook_endpoints")
          .select("id,url,is_active")
          .eq("is_active", true),
      )
    : [];
  result.team = [];
  if (user.isOrganizationAdmin) {
    const members = checked(
      await db
        .from("organization_members")
        .select("user_id,role")
        .eq("is_active", true),
    );
    if (members.length)
      result.team = checked(
        await db
          .from("profiles")
          .select("id,full_name,property_id,property_ids")
          .in(
            "id",
            members.map((m) => m.user_id),
          ),
      ).map((p) => ({
        ...p,
        isAdmin: members.some(
          (m) => m.user_id === p.id && ["owner", "admin"].includes(m.role),
        ),
      }));
  }
  return NextResponse.json(
    { ...result, truncated },
    { headers: { "Cache-Control": "private, no-store" } },
  );
});
export const POST = withWorkspace(async (request: NextRequest) => {
  await access();
  const body = await request.json();
  if (!body || typeof body !== "object" || JSON.stringify(body).length > 30000)
    throw new PlatformError("Invalid operation payload.");
  const action = text(body.action, "Action", 40),
    data = body.data;
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new PlatformError("Operation data is required.");
  uuid(data.property_id, "Property");
  const requestId = uuid(body.requestId, "Request identifier");
  for (const field of [
    "id",
    "room_id",
    "stay_id",
    "job_id",
    "asset_id",
    "template_id",
    "feedback_id",
    "assigned_to",
    "endpoint_id",
  ])
    if (data[field]) uuid(data[field], field);
  for (const [field, max] of Object.entries({
    notes: 2000,
    reason: 1000,
    name: 160,
    title: 160,
    location: 100,
    verification: 160,
    external_reference: 160,
  }))
    if (data[field] !== undefined && data[field] !== null)
      text(data[field], field, max, false);
  let token: string | undefined;
  if (action === "guest_link") {
    const secret =
      process.env.GUEST_LINK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!secret)
      throw new PlatformError("Guest link signing is not configured.", 503);
    token = createHmac("sha256", secret)
      .update(
        `${workspaceUser().organizationId}:${workspaceUser().id}:${requestId}`,
      )
      .digest("base64url");
    data.token_hash = createHash("sha256").update(token).digest("hex");
  }
  const result = checked(
    await workspaceDb().rpc("omniops_command", {
      p_action: action,
      p_data: data,
      p_request_id: requestId,
    }),
  );
  return NextResponse.json(
    {
      success: true,
      result,
      ...(token ? { path: "/guest-services/" + token } : {}),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
});
