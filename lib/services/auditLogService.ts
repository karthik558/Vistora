export interface AuditLogItem {
  id: string;
  timestamp: string;
  actorName: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  resource: string;
  details?: string;
  ip?: string;
  status: "success" | "warning" | "alert";
}

let auditLogStore: AuditLogItem[] = [
  {
    id: "log-1",
    timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    actorName: "Super Administrator",
    actorEmail: "admin@vistora.app",
    actorRole: "super_admin",
    action: "System Settings Updated",
    resource: "Application Global Configuration",
    details: "Adjusted critical SLA response threshold to 15 minutes.",
    ip: "10.0.4.12",
    status: "success",
  },
  {
    id: "log-2",
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    actorName: "Elena Rostova",
    actorEmail: "erostova@vistora.app",
    actorRole: "department_head",
    action: "Complaint SLA Resolved",
    resource: "Complaint: Suite 402 (Housekeeping)",
    details: "Assigned duty supervisor and provided complimentary champagne recovery.",
    ip: "10.0.4.19",
    status: "success",
  },
  {
    id: "log-3",
    timestamp: new Date(Date.now() - 1000 * 3600 * 2).toISOString(),
    actorName: "Karthik Raja",
    actorEmail: "operations@vistora.app",
    actorRole: "admin",
    action: "User Role Modified",
    resource: "User: Sarah Jenkins (sjenkins@vistora.app)",
    details: "Upgraded organizational role from front_office_staff to department_head.",
    ip: "192.168.1.84",
    status: "warning",
  },
  {
    id: "log-4",
    timestamp: new Date(Date.now() - 1000 * 3600 * 4).toISOString(),
    actorName: "Front Desk Concierge",
    actorEmail: "frontdesk.bangkok@vistora.app",
    actorRole: "front_office_staff",
    action: "Guest Invitation Generated",
    resource: "Guest: Lady Caroline Montagu (Suite 408)",
    details: "Created tracked hash invitation link inv_9f82d1c3.",
    ip: "10.0.1.55",
    status: "success",
  },
  {
    id: "log-5",
    timestamp: new Date(Date.now() - 1000 * 3600 * 9).toISOString(),
    actorName: "Data Analyst",
    actorEmail: "analyst@vistora.app",
    actorRole: "analyst",
    action: "Executive Report Exported",
    resource: "Report: Q4 Cross-Property CSAT Scorecard",
    details: "Exported 1,480 rows to formatted Microsoft Excel CSV.",
    ip: "192.168.1.102",
    status: "success",
  },
  {
    id: "log-6",
    timestamp: new Date(Date.now() - 1000 * 3600 * 22).toISOString(),
    actorName: "Super Administrator",
    actorEmail: "admin@vistora.app",
    actorRole: "super_admin",
    action: "Property Status Changed",
    resource: "Property: Vistora Chiang Mai Resort (VCM)",
    details: "Verified property active status and synchronized guest feedback channel.",
    ip: "10.0.4.12",
    status: "success",
  },
];

export function listAuditLogs(limit = 100): AuditLogItem[] {
  return [...auditLogStore].slice(0, limit);
}

export function logAuditEvent(entry: {
  actorName: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  resource: string;
  details?: string;
  ip?: string;
  status?: "success" | "warning" | "alert";
}): AuditLogItem {
  const newLog: AuditLogItem = {
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    actorName: entry.actorName,
    actorEmail: entry.actorEmail,
    actorRole: entry.actorRole,
    action: entry.action,
    resource: entry.resource,
    details: entry.details,
    ip: entry.ip || "127.0.0.1",
    status: entry.status || "success",
  };

  auditLogStore.unshift(newLog);
  if (auditLogStore.length > 500) {
    auditLogStore.pop();
  }
  return newLog;
}
