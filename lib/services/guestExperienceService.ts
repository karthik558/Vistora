import { serviceDb, workspaceContext } from "../platform/db";
import { createServerSupabaseClient } from "../supabase/server";
import {
  PropertyRow,
  FeedbackRow,
  FeedbackViewModel,
  DashboardData,
  SubmitFeedbackPayload,
  GuestStayDetails,
  AttentionItemViewModel,
  RatingBarItem,
} from "../../types/experience";
import { FeedbackStatus, FeedbackTone, DepartmentType } from "../../types/database";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY;

export const isSupabaseLive = Boolean(
  supabaseUrl &&
  supabaseKey &&
  !supabaseUrl.includes("your-project-id") &&
  !supabaseUrl.includes("placeholder")
);

async function getSupabase() {
  const client = await createServerSupabaseClient();
  if (!client) {
    throw new Error("Supabase client is not configured. Please check .env.local");
  }
  return client as any;
}

// Fallback seed properties ONLY used if Supabase credentials are completely missing
const fallbackProperties: PropertyRow[] = [
  {
    id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    name: "Vistora Riverside Bangkok",
    slug: "vistora-riverside-bangkok",
    code: "VRB",
    brand: "Vistora Hotels & Resorts",
    location: "Bangkok",
    country: "Thailand",
    timezone: "Asia/Bangkok",
    total_rooms: 376,
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
    name: "Vistora Siam Bangkok",
    slug: "vistora-siam-bangkok",
    code: "VSB",
    brand: "Vistora Hotels & Resorts",
    location: "Bangkok",
    country: "Thailand",
    timezone: "Asia/Bangkok",
    total_rooms: 354,
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33",
    name: "Vistora Chiang Mai Resort",
    slug: "vistora-chiang-mai",
    code: "VCM",
    brand: "Vistora Hotels & Resorts",
    location: "Chiang Mai",
    country: "Thailand",
    timezone: "Asia/Bangkok",
    total_rooms: 84,
    created_at: "2024-01-01T00:00:00Z",
  },
];

let memoryFeedbackStore: FeedbackRow[] = [];

// Helper: generate initials
export function getInitials(name: string): string {
  if (!name) return "G";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
}

// Helper: relative time formatting
export function formatTimeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours > 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

// Helper: status label
export function getStatusLabel(status: FeedbackStatus): string {
  switch (status) {
    case "needs_attention":
      return "Needs attention";
    case "under_review":
      return "Under review";
    case "resolved":
      return "Resolved";
    case "escalated":
      return "Escalated";
    default:
      return "Received";
  }
}

// Convert Supabase row to ViewModel
export function toViewModel(row: FeedbackRow): FeedbackViewModel {
  return {
    id: row.id,
    initials: getInitials(row.guest_name),
    name: row.guest_name,
    roomNumber: row.room_number,
    department: row.department,
    detail: `${row.room_number} · ${row.department}`,
    rating: row.rating,
    comment: row.comment,
    status: row.status,
    statusLabel: getStatusLabel(row.status),
    timeAgo: formatTimeAgo(row.created_at),
    tone: row.tone,
    wantsContact: row.wants_contact,
    contactPreference: row.contact_preference,
    guestEmail: row.guest_email,
    guestPhone: row.guest_phone,
    assignedTo: row.assigned_to,
    resolutionNotes: row.resolution_notes,
    createdAt: row.created_at,
    propertyId: row.property_id,
    recommendationScore: row.recommendation_score ?? null,
    priority: row.priority || "normal",
    deadline: row.sla_deadline,
    firstResponseAt: row.first_response_at ?? null,
    resolvedAt: row.resolved_at,
    category: row.category || "general",
  };
}

// ==============================================================================
// SUPABASE-FIRST SERVICE METHODS
// ==============================================================================

export async function fetchProperties(): Promise<PropertyRow[]> {
  if (isSupabaseLive) {
    const supabase = await getSupabase();
    const { data, error } = await supabase.from("properties").select("*").order("name");
    if (error) {
      console.error("[Supabase Error] fetchProperties failed:", error);
      throw new Error(`Supabase query failed: ${error.message}`);
    }
    return data || [];
  }
  return fallbackProperties;
}

export async function fetchStayByToken(publicToken: string): Promise<GuestStayDetails | null> {
  if (isSupabaseLive) {
    const supabase = serviceDb();
    const { data, error } = await supabase
      .from("stays")
      .select("*, properties(name), guests(full_name, vip_tier)")
      .eq("public_token", publicToken)
      .single();

    if (error || !data) {
      return null;
    }

    const stayData = data as any;
    return {
      token: publicToken,
      guestName: stayData.guests?.full_name || "",
      roomNumber: stayData.room_number || "",
      checkInDate: stayData.check_in_date,
      checkOutDate: stayData.check_out_date,
      propertyName: stayData.properties?.name || "Vistora Partner Property",
      propertyId: stayData.property_id,
      vipTier: stayData.guests?.vip_tier,
    };
  }

  return null;
}

export async function fetchFeedbackList(options?: {
  propertyId?: string;
  status?: FeedbackStatus | "all";
  search?: string;
}): Promise<FeedbackViewModel[]> {
  if (isSupabaseLive) {
    const supabase = await getSupabase();
    let query = supabase.from("feedback").select("*").order("created_at", { ascending: false });

    if (options?.propertyId && options.propertyId !== "all") {
      query = query.eq("property_id", options.propertyId);
    }
    if (options?.status && options.status !== "all") {
      query = query.eq("status", options.status);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[Supabase Error] fetchFeedbackList failed:", error);
      throw new Error(`Supabase query failed: ${error.message}`);
    }

    let rows: FeedbackRow[] = data || [];

    if (options?.search && options.search.trim()) {
      const s = options.search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.guest_name.toLowerCase().includes(s) ||
          r.room_number.toLowerCase().includes(s) ||
          r.department.toLowerCase().includes(s) ||
          (r.comment && r.comment.toLowerCase().includes(s))
      );
    }

    return rows.map(toViewModel);
  }

  return memoryFeedbackStore.map(toViewModel);
}

export async function createFeedback(payload: SubmitFeedbackPayload): Promise<FeedbackViewModel> {
  const rating = Number(payload.rating);
  const tone: FeedbackTone = rating <= 2 ? "urgent" : rating === 3 ? "review" : "positive";
  const status: FeedbackStatus = rating <= 2 ? "needs_attention" : rating === 3 ? "under_review" : "resolved";

  // Assemble questionnaire answers into formatted comment if present
  let finalComment = payload.comment?.trim() || "";
  if (payload.answers && payload.answers.length > 0) {
    const answersSummary = payload.answers
      .filter((a) => a.answerValue && a.answerValue.trim())
      .map((a) => `• ${a.questionText}: ${a.answerValue}`)
      .join("\n");
    if (answersSummary) {
      finalComment = finalComment
        ? `${finalComment}\n\n[Guest Questionnaire]\n${answersSummary}`
        : `[Guest Questionnaire]\n${answersSummary}`;
    }
  }

  if (isSupabaseLive) {
    const supabase = serviceDb();

    // Public submission has already validated the selected property and invitation.
    let propertyId = payload.propertyId;
    if (!propertyId) {
      const { data: prop } = await supabase.from("properties").select("id").limit(1).single();
      propertyId = prop?.id || "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
    }

    const newRecord = {
      property_id: propertyId,
      organization_id: payload.organizationId,
      invitation_id: payload.invitationId || null,
      stay_id:payload.stayId||null,
      recommendation_score: payload.recommendationScore ?? null,
      guest_name: payload.guestName || "Guest",
      guest_email: payload.guestEmail || null,
      guest_phone: payload.guestPhone || null,
      room_number: payload.roomNumber || "Suite",
      department: payload.department || "Front Desk",
      rating,
      comment: finalComment || null,
      wants_contact: Boolean(payload.wantsContact),
      contact_preference: payload.contactPreference || (payload.guestPhone ? "phone" : "email"),
      status,
      tone,
      sla_deadline: null,
      assigned_to: null,
      resolution_notes: status === "resolved" ? "Auto-acknowledged." : null,
      resolved_at: status === "resolved" ? new Date().toISOString() : null,
    };

    const {data,error}=await supabase.rpc("submit_guest_feedback",{p_feedback:newRecord,p_answers:payload.answers||[]});
    if(error)throw new Error("Failed to save guest feedback: "+error.message);
    return toViewModel(data);
  }

  const fallbackRecord: FeedbackRow = {
    id: `local-${Date.now()}`,
    property_id: fallbackProperties[0].id,
    stay_id: null,
    guest_name: payload.guestName || "Guest",
    guest_email: payload.guestEmail || null,
    guest_phone: payload.guestPhone || null,
    room_number: payload.roomNumber || "Suite",
    department: payload.department || "Front Desk",
    rating,
    comment: finalComment || null,
    wants_contact: Boolean(payload.wantsContact),
    contact_preference: payload.contactPreference || null,
    status,
    tone,
    sla_deadline: null,
    assigned_to: null,
    resolution_notes: null,
    resolved_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  memoryFeedbackStore.unshift(fallbackRecord);
  invalidateDashboardCache();
  return toViewModel(fallbackRecord);
}

export async function updateFeedbackProperty(id: string, propertyId: string): Promise<boolean> {
  if (isSupabaseLive) {
    const supabase = await getSupabase();
    const { error } = await supabase
      .from("feedback")
      .update({ property_id: propertyId, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[Supabase Error] updateFeedbackProperty failed:", error);
      throw new Error(`Failed to assign property: ${error.message}`);
    }
    invalidateDashboardCache();
    return true;
  }
  const item = memoryFeedbackStore.find((f) => f.id === id);
  if (item) {
    item.property_id = propertyId;
  }
  invalidateDashboardCache();
  return true;
}

export async function updateFeedbackStatus(
  id: string,
  newStatus: FeedbackStatus,
  notes?: string,
  assignedTo?: string | null
): Promise<FeedbackViewModel | null> {
  const tone: FeedbackTone =
    newStatus === "needs_attention" || newStatus === "escalated"
      ? "urgent"
      : newStatus === "under_review"
      ? "review"
      : "positive";

  if (isSupabaseLive) {
    const supabase = await getSupabase();
    const updatePayload: any = {
      status: newStatus,
      tone,
      resolved_at: newStatus === "resolved" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };
    if (notes !== undefined) {
      updatePayload.resolution_notes = notes;
    }
    if (assignedTo !== undefined) {
      updatePayload.assigned_to = assignedTo && assignedTo.trim() ? assignedTo.trim() : null;
    }

    const { data, error } = await supabase
      .from("feedback")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[Supabase Error] updateFeedbackStatus failed:", error);
      throw new Error(`Failed to update feedback status in Supabase: ${error.message}`);
    }
    invalidateDashboardCache();
    return toViewModel(data);
  }

  const idx = memoryFeedbackStore.findIndex((f) => f.id === id);
  if (idx !== -1) {
    memoryFeedbackStore[idx].status = newStatus;
    memoryFeedbackStore[idx].tone = tone;
    if (notes !== undefined) memoryFeedbackStore[idx].resolution_notes = notes;
    if (assignedTo !== undefined) {
      memoryFeedbackStore[idx].assigned_to = assignedTo && assignedTo.trim() ? assignedTo.trim() : null;
    }
    memoryFeedbackStore[idx].resolved_at = newStatus === "resolved" ? new Date().toISOString() : null;
    invalidateDashboardCache();
    return toViewModel(memoryFeedbackStore[idx]);
  }
  return null;
}
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const DASHBOARD_CACHE_TTL_MS = 60_000; // 60 seconds fast in-memory cache for instant navigation
const dashboardCache = new Map<string, CacheEntry<DashboardData>>();

export function invalidateDashboardCache(): void {
  dashboardCache.clear();
}

// Compute real metrics exclusively from the Supabase database
export async function getDashboardData(
  propertyId: string | "all" = "all",
  allowedPropertyIds?: string[] | null
): Promise<DashboardData> {
  const cacheKey = `${propertyId}:${allowedPropertyIds ? [...allowedPropertyIds].sort().join(",") : "all"}`;
  const now = Date.now();
  const cached = undefined;
  // Results are scoped by the caller JWT; do not reuse data across sessions.

  let feedbackRows: FeedbackRow[] = [];
  let propertiesList: PropertyRow[] = [];

  if (isSupabaseLive) {
    const supabase = await getSupabase();

    // 1. Fetch properties concurrently
    const propPromise = supabase.from("properties").select("*").order("name");

    // 2. Fetch feedback concurrently with strict multi-tenant isolation
    let feedPromise: Promise<any>;
    if (allowedPropertyIds !== null && allowedPropertyIds !== undefined) {
      if (allowedPropertyIds.length === 0) {
        feedPromise = Promise.resolve({ data: [], error: null });
      } else if (propertyId !== "all") {
        if (!allowedPropertyIds.includes(propertyId)) {
          feedPromise = Promise.resolve({ data: [], error: null });
        } else {
          feedPromise = supabase
            .from("feedback")
            .select("*")
            .eq("property_id", propertyId)
            .order("created_at", { ascending: false });
        }
      } else {
        feedPromise = supabase
          .from("feedback")
          .select("*")
          .in("property_id", allowedPropertyIds)
          .order("created_at", { ascending: false });
      }
    } else {
      let query = supabase.from("feedback").select("*").order("created_at", { ascending: false });
      if (propertyId !== "all") {
        query = query.eq("property_id", propertyId);
      }
      feedPromise = query;
    }

    const [propRes, feedRes] = await Promise.all([propPromise, feedPromise]);

    if (propRes.error) {
      console.error("[Supabase Error] Properties query failed:", propRes.error);
      throw new Error(`Failed to fetch properties from Supabase: ${propRes.error.message}`);
    }
    if (feedRes.error) {
      console.error("[Supabase Error] Feedback query failed:", feedRes.error);
      throw new Error(`Failed to fetch feedback from Supabase: ${feedRes.error.message}`);
    }

    // Filter properties strictly to allowedPropertyIds if restricted
    if (allowedPropertyIds !== null && allowedPropertyIds !== undefined) {
      propertiesList = (propRes.data || []).filter((p: any) => allowedPropertyIds.includes(p.id));
    } else {
      propertiesList = propRes.data || [];
    }

    feedbackRows = feedRes.data || [];
  } else {
    if (allowedPropertyIds !== null && allowedPropertyIds !== undefined) {
      propertiesList = fallbackProperties.filter((p) => allowedPropertyIds.includes(p.id));
      if (allowedPropertyIds.length === 0) {
        feedbackRows = [];
      } else if (propertyId !== "all") {
        feedbackRows = allowedPropertyIds.includes(propertyId)
          ? memoryFeedbackStore.filter((r) => r.property_id === propertyId)
          : [];
      } else {
        feedbackRows = memoryFeedbackStore.filter((r) => allowedPropertyIds.includes(r.property_id));
      }
    } else {
      propertiesList = fallbackProperties;
      feedbackRows =
        propertyId !== "all"
          ? memoryFeedbackStore.filter((r) => r.property_id === propertyId)
          : memoryFeedbackStore;
    }
  }

  const total = feedbackRows.length;
  const totalRatingSum = feedbackRows.reduce((acc, curr) => acc + curr.rating, 0);
  const averageRatingVal = total > 0 ? (totalRatingSum / total).toFixed(2) : "0.0";
  const satisfiedCount = feedbackRows.filter((r) => r.rating >= 4).length;
  const satisfactionRateVal = total > 0 ? ((satisfiedCount / total) * 100).toFixed(1) : "0.0";
  const openComplaintsCount = feedbackRows.filter(
    (r) => r.status === "needs_attention" || r.status === "escalated" || r.rating <= 2
  ).length;

  // Rating distribution counts (5 down to 1)
  const distributionCounts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  for (const row of feedbackRows) {
    if (row.rating >= 1 && row.rating <= 5) {
      distributionCounts[row.rating] = (distributionCounts[row.rating] || 0) + 1;
    }
  }

  const ratingBars: RatingBarItem[] = [5, 4, 3, 2, 1].map((stars) => {
    const count = distributionCounts[stars] || 0;
    const percentage = total > 0 ? `${Math.round((count / total) * 100)}%` : "0%";
    return {
      stars: String(stars),
      percentage,
      count,
    };
  });

  // Attention items generated from live Supabase complaints & open items
  const attentionRows = feedbackRows
    .filter((r) => r.status === "needs_attention" || r.status === "under_review" || r.wants_contact)
    .slice(0, 4);

  const attentionItems: AttentionItemViewModel[] = attentionRows.map((r) => {
    const isUrgent = r.tone === "urgent" || r.rating <= 2;
    return {
      id: `att-${r.id}`,
      title: isUrgent ? "Guest complaint" : r.wants_contact ? "Contact requested" : "Under review",
      detail: `${r.guest_name} · ${r.room_number}`,
      meta: r.sla_deadline
        ? `SLA: ${formatTimeAgo(r.sla_deadline).replace("ago", "remaining")}`
        : formatTimeAgo(r.created_at),
      type: isUrgent ? "critical" : r.status === "under_review" ? "warning" : "neutral",
      feedbackId: r.id,
    };
  });

  const result: DashboardData = {
    metrics: {
      feedbackReceived: {
        label: "Feedback received",
        value: total.toLocaleString(),
        change: total > 0 ? `${total} verified` : "0",
        note: "all recorded stays",
      },
      averageRating: {
        label: "Average rating",
        value: averageRatingVal,
        suffix: "/ 5",
        change: `${averageRatingVal}`,
        note: total > 0 ? `from ${total} reviews` : "no reviews recorded",
      },
      satisfactionRate: {
        label: "Guest satisfaction",
        value: satisfactionRateVal,
        suffix: "%",
        change: `${satisfiedCount} satisfied`,
        note: total > 0 ? "rated 4★ or 5★" : "no ratings logged",
      },
      openComplaints: {
        label: "Open complaints",
        value: String(openComplaintsCount),
        change: `${openComplaintsCount}`,
        note: openComplaintsCount > 0 ? "requires follow-up" : "all resolved",
        negative: openComplaintsCount > 0,
      },
    },
    ratingDistribution: {
      bars: ratingBars,
      average: averageRatingVal,
      totalCount: total,
    },
    recentFeedback: feedbackRows.map(toViewModel),
    attentionItems,
    properties: propertiesList,
    activePropertyId: propertyId,
    source: isSupabaseLive ? "supabase" : "local",
  };

  // No process-global cache of tenant records.
  return result;
}

export async function deleteFeedback(ids: string[]): Promise<{ count: number }> {
  if (!ids || ids.length === 0) return { count: 0 };

  if (isSupabaseLive) {
    const supabase = await getSupabase();
    const { error } = await supabase
      .from("feedback")
      .delete()
      .in("id", ids);

    if (error) {
      console.error("[Supabase Error] deleteFeedback failed:", error);
      throw new Error(`Failed to delete feedback from Supabase: ${error.message}`);
    }
    invalidateDashboardCache();
    return { count: ids.length };
  }

  const initialCount = memoryFeedbackStore.length;
  memoryFeedbackStore = memoryFeedbackStore.filter((f) => !ids.includes(f.id));
  invalidateDashboardCache();
  return { count: initialCount - memoryFeedbackStore.length };
}
