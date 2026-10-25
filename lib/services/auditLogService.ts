import crypto from "crypto";

export type AuditCategory =
  | "pii_access"
  | "export"
  | "sla_status"
  | "permission"
  | "security"
  | "system";

export interface AuditLogItem {
  id: string;
  timestamp: string;
  actorName: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  category: AuditCategory;
  resource: string;
  details?: string;
  ip?: string;
  hash: string;
  status: "success" | "warning" | "alert";
  complianceTag?: string;
}

let latestHash = "000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f";

function computeAuditHash(entry: Partial<AuditLogItem>, prevHash: string): string {
  const content = `${prevHash}|${entry.timestamp}|${entry.actorEmail}|${entry.action}|${entry.resource}|${entry.details || ""}`;
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 32);
}

// Initial realistic enterprise compliance & GDPR seed log entries
let auditLogStore: AuditLogItem[] = [
  {
    id: "log-1",
    timestamp: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    actorName: "Sarah Jenkins",
    actorEmail: "sjenkins@vistora.app",
    actorRole: "department_head",
    action: "Guest PII Revealed (GDPR Article 15)",
    category: "pii_access",
    resource: "Guest Feedback #FB-104 (Suite 402 · Alexander Wright)",
    details: "Unmasked phone +1 (555) 234-5678 and email a.wright@luxuryhotel.com for immediate in-stay service recovery dispatch.",
    ip: "10.0.4.18 (On-Premises VLAN)",
    hash: "a4f91b72e90c812d7c5a31ef90b83210",
    status: "warning",
    complianceTag: "GDPR Consent Audit",
  },
  {
    id: "log-2",
    timestamp: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    actorName: "Elena Rostova",
    actorEmail: "erostova@vistora.app",
    actorRole: "department_head",
    action: "SLA Recovery Target Resolved",
    category: "sla_status",
    resource: "Complaint: Suite 402 (Housekeeping)",
    details: "Service recovery approved: Turndown VIP amenities credited. Target SLA achieved in 8.2 mins (Standard: 15 mins).",
    ip: "10.0.4.19",
    hash: "68c091d37e51ba0e981f4a9b231908ef",
    status: "success",
    complianceTag: "SLA Benchmark",
  },
  {
    id: "log-3",
    timestamp: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
    actorName: "Marco Rossi",
    actorEmail: "mrossi@vistora.app",
    actorRole: "department_head",
    action: "Department Scoped Feedback Access",
    category: "permission",
    resource: "Division Queue: Food & Beverage (18 records)",
    details: "Scoped session access restricted to Restaurant & Rooftop Lounge incidents only (Cross-division access blocked).",
    ip: "192.168.1.52",
    hash: "c2098b184f73a90d81b4e98f01b38421",
    status: "success",
    complianceTag: "RBAC Scoping",
  },
  {
    id: "log-4",
    timestamp: new Date(Date.now() - 1000 * 3600 * 1.5).toISOString(),
    actorName: "Data Analyst",
    actorEmail: "analyst@vistora.app",
    actorRole: "analyst",
    action: "Executive Feedback Export (CSV)",
    category: "export",
    resource: "Feedback Directory · Grand Heritage Hotel",
    details: "Exported 84 rows with masked guest contact details for Q4 CSAT Board Scorecard presentation.",
    ip: "192.168.1.102",
    hash: "93f0b284e719ac0b81f3d9a1029482bf",
    status: "warning",
    complianceTag: "Data Egress Log",
  },
  {
    id: "log-5",
    timestamp: new Date(Date.now() - 1000 * 3600 * 3.2).toISOString(),
    actorName: "Super Administrator",
    actorEmail: "admin@vistora.app",
    actorRole: "super_admin",
    action: "Granular Role Scope Modified",
    category: "permission",
    resource: "User: Marco Rossi (F&B Director)",
    details: "Updated permissions: Enabled PII unmasking right; restricted operational scope strictly to Food & Beverage division.",
    ip: "10.0.4.12",
    hash: "82bc194a0f38b1d972c4e09a3182b401",
    status: "warning",
    complianceTag: "Privilege Escalation",
  },
  {
    id: "log-6",
    timestamp: new Date(Date.now() - 1000 * 3600 * 5.8).toISOString(),
    actorName: "Front Desk Concierge",
    actorEmail: "frontdesk.bangkok@vistora.app",
    actorRole: "front_office_staff",
    action: "Guest PII Revealed (GDPR Article 15)",
    category: "pii_access",
    resource: "Guest Feedback #FB-102 (Villa 12 · Charlotte Sterling)",
    details: "Unmasked phone +44 20 7946 0912 for VIP departure transportation arrangement.",
    ip: "10.0.1.55",
    hash: "71da928f0b3419ac82e01b74f9a0182b",
    status: "warning",
    complianceTag: "GDPR Consent Audit",
  },
  {
    id: "log-7",
    timestamp: new Date(Date.now() - 1000 * 3600 * 8.4).toISOString(),
    actorName: "Super Administrator",
    actorEmail: "admin@vistora.app",
    actorRole: "super_admin",
    action: "Platform Security Authentication",
    category: "security",
    resource: "Workspace Authentication Gateway",
    details: "Two-factor administrator session verified via cryptographic key token.",
    ip: "10.0.4.12",
    hash: "51c098df23a019ba71b4e098a1293812",
    status: "success",
    complianceTag: "ISO 27001 Access",
  },
  {
    id: "log-8",
    timestamp: new Date(Date.now() - 1000 * 3600 * 14).toISOString(),
    actorName: "David Kim",
    actorEmail: "dkim@vistora.app",
    actorRole: "department_head",
    action: "SLA Recovery Target Resolved",
    category: "sla_status",
    resource: "Complaint: Room 208 (Facilities & Engineering)",
    details: "Air conditioning thermostat re-calibrated; duty engineer logged completed check in 11 mins.",
    ip: "10.0.4.24",
    hash: "42a90184cb21908d71e4a098b123984a",
    status: "success",
    complianceTag: "SLA Benchmark",
  },
];

export function listAuditLogs(limit = 100, category?: string): AuditLogItem[] {
  let list = [...auditLogStore];
  if (category && category !== "all") {
    list = list.filter((l) => l.category === category);
  }
  return list.slice(0, limit);
}

export function logAuditEvent(entry: {
  actorName: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  category?: AuditCategory;
  resource: string;
  details?: string;
  ip?: string;
  status?: "success" | "warning" | "alert";
  complianceTag?: string;
}): AuditLogItem {
  const timestamp = new Date().toISOString();
  const category = entry.category || "system";
  const status = entry.status || "success";
  
  const hash = computeAuditHash(
    {
      timestamp,
      actorEmail: entry.actorEmail,
      action: entry.action,
      resource: entry.resource,
      details: entry.details,
    },
    latestHash
  );
  latestHash = hash;

  const newLog: AuditLogItem = {
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp,
    actorName: entry.actorName,
    actorEmail: entry.actorEmail,
    actorRole: entry.actorRole,
    action: entry.action,
    category,
    resource: entry.resource,
    details: entry.details,
    ip: entry.ip || "10.0.4.18 (Encrypted VLAN)",
    hash,
    status,
    complianceTag:
      entry.complianceTag ||
      (category === "pii_access"
        ? "GDPR Consent Audit"
        : category === "export"
        ? "Data Egress Log"
        : category === "sla_status"
        ? "SLA Benchmark"
        : category === "permission"
        ? "RBAC Scoping"
        : "Operational Ledger"),
  };

  auditLogStore.unshift(newLog);
  if (auditLogStore.length > 500) {
    auditLogStore.pop();
  }

  // Optional background persistence to Supabase if audit_logs table exists
  try {
    import("../supabase/server").then(({ createServerSupabaseClient }) => {
      const supabase = createServerSupabaseClient();
      if (supabase) {
        (supabase as any)
          .from("audit_logs")
          .insert({
            id: newLog.id,
            actor_name: newLog.actorName,
            actor_email: newLog.actorEmail,
            actor_role: newLog.actorRole,
            action: newLog.action,
            category: newLog.category,
            resource: newLog.resource,
            details: newLog.details,
            ip: newLog.ip,
            hash: newLog.hash,
            status: newLog.status,
            compliance_tag: newLog.complianceTag,
            created_at: newLog.timestamp,
          })
          .then(() => {})
          .catch(() => {});
      }
    }).catch(() => {});
  } catch {}

  return newLog;
}
