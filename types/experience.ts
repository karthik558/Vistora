import { Database, FeedbackStatus, FeedbackTone, DepartmentType } from "./database";

export type PropertyRow = Database["public"]["Tables"]["properties"]["Row"];
export type StayRow = Database["public"]["Tables"]["stays"]["Row"];
export type GuestRow = Database["public"]["Tables"]["guests"]["Row"];
export type FeedbackRow = Database["public"]["Tables"]["feedback"]["Row"];
export type FeedbackInsert = Database["public"]["Tables"]["feedback"]["Insert"];

export interface FeedbackViewModel {
  id: string;
  initials: string;
  name: string;
  roomNumber: string;
  department: DepartmentType;
  detail: string;
  rating: number;
  comment: string | null;
  status: FeedbackStatus;
  statusLabel: string;
  timeAgo: string;
  tone: FeedbackTone;
  wantsContact: boolean;
  contactPreference: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  assignedTo: string | null;
  resolutionNotes: string | null;
  createdAt: string;
}

export interface MetricSummary {
  label: string;
  value: string;
  suffix?: string;
  change: string;
  note: string;
  negative?: boolean;
}

export interface RatingBarItem {
  stars: string;
  percentage: string;
  count: number;
}

export interface AttentionItemViewModel {
  id: string;
  title: string;
  detail: string;
  meta: string;
  type: "critical" | "warning" | "neutral";
  feedbackId?: string;
}

export interface DashboardData {
  metrics: {
    feedbackReceived: MetricSummary;
    averageRating: MetricSummary;
    satisfactionRate: MetricSummary;
    openComplaints: MetricSummary;
  };
  ratingDistribution: {
    bars: RatingBarItem[];
    average: string;
    totalCount: number;
  };
  recentFeedback: FeedbackViewModel[];
  attentionItems: AttentionItemViewModel[];
  properties: PropertyRow[];
  activePropertyId: string | "all";
  source: "supabase" | "local";
}

export interface SubmitFeedbackPayload {
  publicToken?: string;
  propertyId?: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  roomNumber: string;
  department: DepartmentType;
  rating: number;
  comment?: string;
  wantsContact: boolean;
  contactPreference?: "email" | "phone" | "in_person";
}

export interface GuestStayDetails {
  token: string;
  guestName: string;
  roomNumber: string;
  checkInDate: string;
  checkOutDate: string;
  propertyName: string;
  propertyId: string;
  vipTier?: string;
}
