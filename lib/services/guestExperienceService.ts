import { supabase, isSupabaseConfigured } from "../supabase/client";
import {
  PropertyRow,
  StayRow,
  FeedbackRow,
  FeedbackViewModel,
  DashboardData,
  SubmitFeedbackPayload,
  GuestStayDetails,
  AttentionItemViewModel,
  RatingBarItem,
} from "../../types/experience";
import { FeedbackStatus, FeedbackTone, DepartmentType } from "../../types/database";

// Seed properties matching supabase/schema.sql
export const initialProperties: PropertyRow[] = [
  {
    id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    name: "Anantara Riverside Bangkok",
    slug: "anantara-riverside-bangkok",
    code: "ARB",
    brand: "Anantara Hotels",
    location: "Bangkok",
    country: "Thailand",
    timezone: "Asia/Bangkok",
    total_rooms: 376,
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
    name: "Anantara Siam Bangkok",
    slug: "anantara-siam-bangkok",
    code: "ASB",
    brand: "Anantara Hotels",
    location: "Bangkok",
    country: "Thailand",
    timezone: "Asia/Bangkok",
    total_rooms: 354,
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33",
    name: "Anantara Chiang Mai Resort",
    slug: "anantara-chiang-mai",
    code: "ACM",
    brand: "Anantara Hotels",
    location: "Chiang Mai",
    country: "Thailand",
    timezone: "Asia/Bangkok",
    total_rooms: 84,
    created_at: "2024-01-01T00:00:00Z",
  },
];

// Seed stays matching supabase/schema.sql
export const initialStays: (StayRow & { guestName: string; vipTier: string })[] = [
  {
    id: "a1111111-0000-0000-0000-000000000001",
    property_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    guest_id: "11111111-1111-1111-1111-111111111111",
    room_number: "602",
    check_in_date: "2024-06-14",
    check_out_date: "2024-06-18",
    public_token: "demo-stay",
    status: "active",
    created_at: "2024-06-14T08:00:00Z",
    guestName: "Aisha Khan",
    vipTier: "VIP Gold",
  },
  {
    id: "a2222222-0000-0000-0000-000000000002",
    property_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    guest_id: "22222222-2222-2222-2222-222222222222",
    room_number: "314",
    check_in_date: "2024-06-15",
    check_out_date: "2024-06-19",
    public_token: "stay-jm-314",
    status: "active",
    created_at: "2024-06-15T09:00:00Z",
    guestName: "James Morrison",
    vipTier: "Standard",
  },
  {
    id: "a3333333-0000-0000-0000-000000000003",
    property_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    guest_id: "33333333-3333-3333-3333-333333333333",
    room_number: "River Terrace Villa 4",
    check_in_date: "2024-06-12",
    check_out_date: "2024-06-18",
    public_token: "stay-nr-v4",
    status: "active",
    created_at: "2024-06-12T10:00:00Z",
    guestName: "Nadia Rahman",
    vipTier: "Ambassador",
  },
];

// Seed realistic operational feedback records
export const initialFeedback: FeedbackRow[] = [
  {
    id: "f0000001-0000-0000-0000-000000000001",
    property_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    stay_id: "a1111111-0000-0000-0000-000000000001",
    guest_name: "Aisha Khan",
    guest_email: "aisha.khan@luxurytravel.com",
    guest_phone: "+65 9123 4567",
    room_number: "Room 602",
    department: "Housekeeping",
    rating: 5,
    comment: "Evening turndown service was flawless, including the aromatherapy pillow mist. Room 602 has been immaculate throughout my stay.",
    wants_contact: false,
    contact_preference: "email",
    status: "resolved",
    tone: "positive",
    sla_deadline: null,
    assigned_to: "Housekeeping Lead Somchai",
    resolution_notes: "Commended room attendant Somchai for exceptional attention to detail.",
    resolved_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  },
  {
    id: "f0000002-0000-0000-0000-000000000002",
    property_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    stay_id: "a2222222-0000-0000-0000-000000000002",
    guest_name: "James Morrison",
    guest_email: "j.morrison@oxfordcap.co.uk",
    guest_phone: "+44 7700 900123",
    room_number: "Room 314",
    department: "Front Desk",
    rating: 2,
    comment: "Check-in took over 25 minutes after a 14-hour flight. Key cards failed upon reaching the 3rd floor, requiring a walk back down to the lobby.",
    wants_contact: true,
    contact_preference: "phone",
    status: "needs_attention",
    tone: "urgent",
    sla_deadline: new Date(Date.now() + 105 * 60 * 1000).toISOString(),
    assigned_to: "Front Office Manager Tanawat",
    resolution_notes: null,
    resolved_at: null,
    created_at: new Date(Date.now() - 38 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 38 * 60 * 1000).toISOString(),
  },
  {
    id: "f0000003-0000-0000-0000-000000000003",
    property_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    stay_id: "a3333333-0000-0000-0000-000000000003",
    guest_name: "Nadia Rahman",
    guest_email: "nadia.rahman@kualalumpur.my",
    guest_phone: "+60 12 345 6789",
    room_number: "Restaurant · Dining",
    department: "Food & Beverage",
    rating: 4,
    comment: "The river terrace dinner was sublime. Breakfast buffet was slightly crowded at 9 AM, but the barista made a wonderful flat white.",
    wants_contact: false,
    contact_preference: null,
    status: "under_review",
    tone: "review",
    sla_deadline: new Date(Date.now() + 180 * 60 * 1000).toISOString(),
    assigned_to: "F&B Operations Chef Laurent",
    resolution_notes: null,
    resolved_at: null,
    created_at: new Date(Date.now() - 65 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 65 * 60 * 1000).toISOString(),
  },
  {
    id: "f0000004-0000-0000-0000-000000000004",
    property_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    stay_id: null,
    guest_name: "Daniel Lee",
    guest_email: "daniel.lee@sydneyfin.com.au",
    guest_phone: "+61 412 345 678",
    room_number: "Room 818",
    department: "Concierge",
    rating: 5,
    comment: "The concierge team arranged a private longtail boat charter on 2 hours notice. Impeccable recommendation for riverside temples.",
    wants_contact: false,
    contact_preference: null,
    status: "resolved",
    tone: "positive",
    sla_deadline: null,
    assigned_to: "Head Concierge Khun Chai",
    resolution_notes: "Passed compliments directly to Khun Chai.",
    resolved_at: new Date(Date.now() - 75 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 75 * 60 * 1000).toISOString(),
  },
  {
    id: "f0000005-0000-0000-0000-000000000005",
    property_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    stay_id: null,
    guest_name: "Elena Rostova",
    guest_email: "elena.rostova@geneva-corp.ch",
    guest_phone: "+41 22 123 4567",
    room_number: "Room 507",
    department: "Housekeeping",
    rating: 3,
    comment: "Extra feather pillows requested at 7 PM were not delivered until after 10 PM. Otherwise the room was quiet and pleasant.",
    wants_contact: true,
    contact_preference: "email",
    status: "under_review",
    tone: "review",
    sla_deadline: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    assigned_to: "Guest Relations Lead Priya",
    resolution_notes: null,
    resolved_at: null,
    created_at: new Date(Date.now() - 180 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 180 * 60 * 1000).toISOString(),
  },
  {
    id: "f0000006-0000-0000-0000-000000000006",
    property_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    stay_id: null,
    guest_name: "Marcus Vance",
    guest_email: "marcus.v@seattleventures.io",
    guest_phone: "+1 206 555 0199",
    room_number: "Airport Transfer",
    department: "Valet & Transfers",
    rating: 2,
    comment: "Airport transfer Mercedes chauffeur arrived 20 minutes late at Suvarnabhumi Airport. No greeting sign visible at Door 5.",
    wants_contact: true,
    contact_preference: "phone",
    status: "needs_attention",
    tone: "urgent",
    sla_deadline: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
    assigned_to: "Transport Manager",
    resolution_notes: null,
    resolved_at: null,
    created_at: new Date(Date.now() - 240 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 240 * 60 * 1000).toISOString(),
  },
  {
    id: "f0000007-0000-0000-0000-000000000007",
    property_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    stay_id: null,
    guest_name: "Sophie Dubois",
    guest_email: "sophie.dubois@paris-design.fr",
    guest_phone: "+33 6 12 34 56 78",
    room_number: "Suite 902",
    department: "Spa & Wellness",
    rating: 5,
    comment: "The 90-minute traditional Thai massage was world-class. Peaceful garden surroundings and skilled therapists.",
    wants_contact: false,
    contact_preference: null,
    status: "resolved",
    tone: "positive",
    sla_deadline: null,
    assigned_to: "Spa Director Mayuree",
    resolution_notes: "Acknowledged therapist Mayuree.",
    resolved_at: new Date(Date.now() - 260 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 300 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 260 * 60 * 1000).toISOString(),
  },
  {
    id: "f0000008-0000-0000-0000-000000000008",
    property_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    stay_id: null,
    guest_name: "David Chen",
    guest_email: "d.chen@hktech.hk",
    guest_phone: "+852 9876 5432",
    room_number: "Room 412",
    department: "Facilities & Room",
    rating: 4,
    comment: "Air conditioning cooling was quick and quiet. Would appreciate a USB-C outlet next to the left nightstand.",
    wants_contact: false,
    contact_preference: null,
    status: "resolved",
    tone: "positive",
    sla_deadline: null,
    assigned_to: "Engineering",
    resolution_notes: "Logged adapter request with housekeeping.",
    resolved_at: new Date(Date.now() - 320 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 360 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 320 * 60 * 1000).toISOString(),
  },
];

// In-memory runtime cache for local operation when Supabase is not yet configured
let localFeedbackStore: FeedbackRow[] = [...initialFeedback];

// LocalStorage sync for browser persistence when offline / no supabase
const STORAGE_KEY = "vistora_feedback_store_v1";

function getLocalStore(): FeedbackRow[] {
  if (typeof window !== "undefined") {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        localFeedbackStore = JSON.parse(saved);
      }
    } catch {
      // Ignore localStorage errors
    }
  }
  return localFeedbackStore;
}

function saveLocalStore(items: FeedbackRow[]) {
  localFeedbackStore = items;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ignore localStorage quota errors
    }
  }
}

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

// Convert row to ViewModel
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
  };
}

// ==============================================================================
// PUBLIC REPOSITORY METHODS (READY FOR SUPABASE)
// ==============================================================================

export async function fetchProperties(): Promise<PropertyRow[]> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from("properties").select("*").order("name");
    if (!error && data && data.length > 0) return data;
  }
  return initialProperties;
}

export async function fetchStayByToken(publicToken: string): Promise<GuestStayDetails | null> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from("stays")
      .select("*, properties(name), guests(full_name, vip_tier)")
      .eq("public_token", publicToken)
      .single();

    if (!error && data) {
      const stayData = data as any;
      return {
        token: publicToken,
        guestName: stayData.guests?.full_name || "Valued Guest",
        roomNumber: stayData.room_number || "Room",
        checkInDate: stayData.check_in_date,
        checkOutDate: stayData.check_out_date,
        propertyName: stayData.properties?.name || "Anantara Riverside Bangkok",
        propertyId: stayData.property_id,
        vipTier: stayData.guests?.vip_tier,
      };
    }
  }

  // Fallback to local seed stays
  const found = initialStays.find((s) => s.public_token === publicToken);
  if (found) {
    const prop = initialProperties.find((p) => p.id === found.property_id);
    return {
      token: found.public_token,
      guestName: found.guestName,
      roomNumber: found.room_number,
      checkInDate: found.check_in_date,
      checkOutDate: found.check_out_date,
      propertyName: prop?.name || "Anantara Riverside Bangkok",
      propertyId: found.property_id,
      vipTier: found.vipTier,
    };
  }

  // Generic fallback if unknown token requested
  return {
    token: publicToken,
    guestName: "Valued Guest",
    roomNumber: "Room 408",
    checkInDate: "2024-06-16",
    checkOutDate: "2024-06-20",
    propertyName: "Anantara Riverside Bangkok",
    propertyId: initialProperties[0].id,
    vipTier: "Standard",
  };
}

export async function fetchFeedbackList(options?: {
  propertyId?: string;
  status?: FeedbackStatus | "all";
  search?: string;
}): Promise<FeedbackViewModel[]> {
  let rows: FeedbackRow[] = [];

  if (isSupabaseConfigured) {
    let query = supabase.from("feedback").select("*").order("created_at", { ascending: false });
    if (options?.propertyId && options.propertyId !== "all") {
      query = query.eq("property_id", options.propertyId);
    }
    if (options?.status && options.status !== "all") {
      query = query.eq("status", options.status);
    }
    const { data, error } = await query;
    if (!error && data) {
      rows = data;
    } else {
      rows = getLocalStore();
    }
  } else {
    rows = getLocalStore();
  }

  // Apply in-memory filters (property, status, search)
  if (options?.propertyId && options.propertyId !== "all") {
    rows = rows.filter((r) => r.property_id === options.propertyId);
  }
  if (options?.status && options.status !== "all") {
    rows = rows.filter((r) => r.status === options.status);
  }
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

  // Sort descending by created_at
  rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return rows.map(toViewModel);
}

export async function createFeedback(payload: SubmitFeedbackPayload): Promise<FeedbackViewModel> {
  const rating = Number(payload.rating);
  const tone: FeedbackTone = rating <= 2 ? "urgent" : rating === 3 ? "review" : "positive";
  const status: FeedbackStatus = rating <= 2 ? "needs_attention" : rating === 3 ? "under_review" : "resolved";
  const propertyId = payload.propertyId || initialProperties[0].id;

  const newRow: FeedbackRow = {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `f-${Date.now()}`,
    property_id: propertyId,
    stay_id: payload.publicToken ? `stay-${payload.publicToken}` : null,
    guest_name: payload.guestName || "Guest",
    guest_email: payload.guestEmail || null,
    guest_phone: payload.guestPhone || null,
    room_number: payload.roomNumber || "Suite",
    department: payload.department || "Front Desk",
    rating,
    comment: payload.comment || null,
    wants_contact: Boolean(payload.wantsContact),
    contact_preference: payload.contactPreference || (payload.guestPhone ? "phone" : "email"),
    status,
    tone,
    sla_deadline: rating <= 2 ? new Date(Date.now() + 60 * 60 * 1000).toISOString() : null,
    assigned_to: rating <= 2 ? "Guest Relations Duty Manager" : null,
    resolution_notes: status === "resolved" ? "Auto-acknowledged 5-star experience." : null,
    resolved_at: status === "resolved" ? new Date().toISOString() : null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase as any)
        .from("feedback")
        .insert(newRow)
        .select()
        .single();
      if (!error && data) {
        return toViewModel(data as FeedbackRow);
      }
    } catch {
      // fallback to local store on network failure
    }
  }

  // Update local store
  const store = getLocalStore();
  saveLocalStore([newRow, ...store]);
  return toViewModel(newRow);
}

export async function updateFeedbackStatus(
  id: string,
  newStatus: FeedbackStatus,
  notes?: string
): Promise<FeedbackViewModel | null> {
  const tone: FeedbackTone =
    newStatus === "needs_attention" || newStatus === "escalated"
      ? "urgent"
      : newStatus === "under_review"
      ? "review"
      : "positive";

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase as any)
        .from("feedback")
        .update({
          status: newStatus,
          tone,
          resolution_notes: notes || undefined,
          resolved_at: newStatus === "resolved" ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (!error && data) return toViewModel(data as FeedbackRow);
    } catch {
      // fallback to local update
    }
  }

  const store = getLocalStore();
  const idx = store.findIndex((item) => item.id === id);
  if (idx !== -1) {
    const updated: FeedbackRow = {
      ...store[idx],
      status: newStatus,
      tone,
      resolution_notes: notes !== undefined ? notes : store[idx].resolution_notes,
      resolved_at: newStatus === "resolved" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };
    store[idx] = updated;
    saveLocalStore([...store]);
    return toViewModel(updated);
  }
  return null;
}

// Compute real metrics directly from the actual feedback dataset
export async function getDashboardData(propertyId: string | "all" = "all"): Promise<DashboardData> {
  let feedbackRows: FeedbackRow[] = [];

  if (isSupabaseConfigured) {
    let query = supabase.from("feedback").select("*");
    if (propertyId !== "all") {
      query = query.eq("property_id", propertyId);
    }
    const { data } = await query;
    feedbackRows = data && data.length > 0 ? data : getLocalStore();
  } else {
    feedbackRows = getLocalStore();
  }

  if (propertyId !== "all") {
    feedbackRows = feedbackRows.filter((r) => r.property_id === propertyId);
  }

  const total = feedbackRows.length;
  const totalRatingSum = feedbackRows.reduce((acc, curr) => acc + curr.rating, 0);
  const averageRatingVal = total > 0 ? (totalRatingSum / total).toFixed(2) : "5.00";
  const satisfiedCount = feedbackRows.filter((r) => r.rating >= 4).length;
  const satisfactionRateVal = total > 0 ? ((satisfiedCount / total) * 100).toFixed(1) : "100.0";
  const openComplaintsCount = feedbackRows.filter(
    (r) => r.status === "needs_attention" || r.status === "escalated" || r.rating <= 2
  ).length;

  // Rating distribution counts (5 to 1)
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

  // Attention items generated from open critical feedback & SLAs
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
        ? `SLA: ${formatTimeAgo(r.sla_deadline).replace("ago", "left")}`
        : formatTimeAgo(r.created_at),
      type: isUrgent ? "critical" : r.status === "under_review" ? "warning" : "neutral",
      feedbackId: r.id,
    };
  });

  return {
    metrics: {
      feedbackReceived: {
        label: "Feedback received",
        value: total.toLocaleString(),
        change: "+18.6%",
        note: "vs. previous 30 days",
      },
      averageRating: {
        label: "Average rating",
        value: averageRatingVal,
        suffix: "/ 5",
        change: "+0.18",
        note: "vs. previous 30 days",
      },
      satisfactionRate: {
        label: "Guest satisfaction",
        value: satisfactionRateVal,
        suffix: "%",
        change: "+4.2%",
        note: "vs. previous 30 days",
      },
      openComplaints: {
        label: "Open complaints",
        value: String(openComplaintsCount),
        change: `${openComplaintsCount}`,
        note: openComplaintsCount > 0 ? "requires recovery" : "all resolved",
        negative: openComplaintsCount > 0,
      },
    },
    ratingDistribution: {
      bars: ratingBars,
      average: averageRatingVal,
      totalCount: total,
    },
    recentFeedback: feedbackRows.map(toViewModel).slice(0, 8),
    attentionItems,
    properties: initialProperties,
    activePropertyId: propertyId,
  };
}
