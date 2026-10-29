export const operationTabs = [
  "Overview",
  "Guests",
  "Rooms",
  "Cleaning",
  "Complaints",
  "Service jobs",
  "Maintenance",
  "Concierge",
  "Breakfast",
  "Inspections",
  "Guest services",
  "Cost controls",
] as const;
export type OperationTab = (typeof operationTabs)[number];
export const departments = [
  "Housekeeping",
  "Engineering",
  "Front Desk",
  "Concierge",
  "Food & Beverage",
  "Valet & Transfers",
  "IT",
] as const;
export const guestServices = [
  { value: "towels", label: "Extra towels" },
  { value: "toiletries", label: "Toiletries" },
  { value: "room_service", label: "Room service assistance" },
  { value: "baggage", label: "Baggage pickup" },
  { value: "valet", label: "Retrieve vehicle" },
];
export type Job = {
  id: string;
  property_id: string;
  room_id: string | null;
  kind: string;
  title: string;
  description: string;
  department: string;
  location: string;
  guest_name?: string;
  resolution_notes?: string;
  priority: string;
  status: string;
  assigned_to: string | null;
  acknowledged_at: string | null;
  due_at: string;
  escalation_due_at?: string | null;
  escalation_level?: number;
  created_at: string;
  updated_at?: string;
  completed_at?: string | null;
  issue_type?: string | null;
  assignee?: { full_name: string } | null;
};
export type OpsRow = { id: string; property_id: string; [key: string]: any };
export type OperationsData = {
  ready: boolean;
  rooms: OpsRow[];
  stays: OpsRow[];
  jobs: Job[];
  team: OpsRow[];
  assets: OpsRow[];
  maintenance: OpsRow[];
  luggage: OpsRow[];
  valet: OpsRow[];
  breakfast: OpsRow[];
  catalog: OpsRow[];
  cleaning: OpsRow[];
  folios: OpsRow[];
  compensations: OpsRow[];
  templates: OpsRow[];
  inspections: OpsRow[];
  evidence: OpsRow[];
  telephony: OpsRow[];
  audit: OpsRow[];
  webhooks?: OpsRow[];
  webhookEndpoints?: OpsRow[];
  feedback?: OpsRow[];
  trend: { date: string; created: number; completed: number }[];
  summary?: {
    activeJobs: number;
    overdue: number;
    readyRooms: number;
    inHouse: number;
  };
  truncated: boolean;
  currency: string;
  defaultChecklist: string[];
  callRateMinor: number;
};
