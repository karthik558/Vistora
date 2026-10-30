"use client";

import { createContext, useContext, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Dashboard, { AppShell, WorkspaceUser } from "./Dashboard";
import OperationsPage from "./OperationsPage";
import type { DashboardData } from "../types/experience";
import { FeedbackShellContext } from "./FeedbackShellContext";
import GuestInvitationsPage from "./GuestInvitationsPage";
import AuditLogPage from "./AuditLogPage";
import WorkspacePage from "./WorkspacePage";

const FeedbackContext = createContext<{ data: DashboardData; user: WorkspaceUser } | null>(null);

const labels: Record<string, string> = {
  overview: "Dashboard", feedback: "All feedback", analytics: "Analytics",
  complaints: "Complaints & SLA", directory: "Guest directory", forms: "Feedback forms",
  questionnaire: "Questionnaire", "qr-codes": "QR codes",
  invitations: "Guest invitations", "audit-log": "Audit log", reports: "Reports",
};

export function FeedbackWorkspace({ data, user, children }: {
  data: DashboardData; user: WorkspaceUser; children: React.ReactNode;
}) {
  const section = usePathname().split("/")[2];
  const router = useRouter();
  useEffect(() => {
    // Refresh in the background, not on every sidebar click. Mutations already
    // use router.refresh(), which also refreshes this shared server layout.
    const refresh = () => { if (!document.hidden) router.refresh(); };
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [router]);
  return (
    <FeedbackContext.Provider value={{ data, user }}>
      <AppShell active={labels[section] || "Feedback"} complaints={Number(data.metrics.openComplaints.value)} user={user}>
        <FeedbackShellContext.Provider value={true}>{children}</FeedbackShellContext.Provider>
      </AppShell>
    </FeedbackContext.Provider>
  );
}

export default function FeedbackWorkspacePage({ section }: { section: string }) {
  const workspace = useContext(FeedbackContext);
  if (!workspace) throw new Error("Feedback pages require the feedback workspace layout.");
  if (section === "invitations") return <GuestInvitationsPage initialUser={workspace.user} properties={workspace.data.properties} />;
  if (section === "audit-log") return <AuditLogPage initialUser={workspace.user} />;
  if (section === "reports") return <WorkspacePage user={workspace.user} initialTab="Reports" />;
  return section === "overview"
    ? <Dashboard initialData={workspace.data} initialUser={workspace.user} />
    : <OperationsPage section={section} data={workspace.data} initialUser={workspace.user} />;
}