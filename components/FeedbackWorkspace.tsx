"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Dashboard, { AppShell, WorkspaceUser } from "./Dashboard";
import OperationsPage from "./OperationsPage";
import type { DashboardData } from "../types/experience";
import { FeedbackShellContext } from "./FeedbackShellContext";
import GuestInvitationsPage from "./GuestInvitationsPage";
import AuditLogPage from "./AuditLogPage";
import WorkspacePage from "./WorkspacePage";
import { feedbackSectionRights } from "../lib/feedback/sections";
import { hasModuleAccess } from "../lib/auth/modules";

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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const section = searchParams.get("section") || pathname.split("/")[2];
  const [queryClient] = useState(() => new QueryClient());
  const [currentData, setCurrentData] = useState(data);
  useEffect(() => { setCurrentData(data); }, [data]);
  useEffect(() => {
    if (!user.isOrganizationAdmin && !user.rights?.includes("view_feedback")) return;
    const controller = new AbortController();
    let pending = false;
    const refresh = async () => {
      if (document.hidden || pending) return;
      pending = true;
      try {
        const response = await fetch("/api/metrics", { signal: controller.signal, cache: "no-store" });
        const body = await response.json();
        if (response.ok && body.success && !controller.signal.aborted) setCurrentData(body.data);
      } catch { /* Retain the current snapshot on a transient background failure. */ }
      finally { pending = false; }
    };
    const timer = window.setInterval(refresh, 60_000);
    return () => { window.clearInterval(timer); controller.abort(); };
  }, [user]);
  return (
    <QueryClientProvider client={queryClient}>
    <FeedbackContext.Provider value={{ data: currentData, user }}>
      <div onClickCapture={event => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const link = (event.target as Element).closest<HTMLAnchorElement>("a[href]");
        if (!link || link.target || link.hasAttribute("download")) return;
        const destination = new URL(link.href, window.location.href);
        const nextSection = destination.searchParams.get("section");
        if (destination.origin !== window.location.origin || destination.pathname !== "/dashboard/overview" || !nextSection || !Object.hasOwn(feedbackSectionRights, nextSection)) return;
        if (!hasModuleAccess(user, "feedback") || (!user.isOrganizationAdmin && !user.rights?.includes(feedbackSectionRights[nextSection]))) return;
        event.preventDefault();
        if (destination.href !== window.location.href) window.history.pushState(null, "", destination.pathname + destination.search);
      }}>
        <AppShell active={labels[section] || "Feedback"} complaints={Number(currentData.metrics.openComplaints.value)} user={user}>
          <FeedbackShellContext.Provider value={true}>{children}</FeedbackShellContext.Provider>
        </AppShell>
      </div>
    </FeedbackContext.Provider>
    </QueryClientProvider>
  );
}

export default function FeedbackWorkspacePage({ section: initialSection }: { section: string }) {
  const searchParams = useSearchParams();
  const section = searchParams.get("section") || initialSection;
  const workspace = useContext(FeedbackContext);
  if (!workspace) throw new Error("Feedback pages require the feedback workspace layout.");
  if (!Object.hasOwn(feedbackSectionRights, section) || !hasModuleAccess(workspace.user, "feedback") || (!workspace.user.isOrganizationAdmin && !workspace.user.rights?.includes(feedbackSectionRights[section]))) {
    return <div className="content-wrap"><h1>Access restricted</h1><p>You do not have permission to open this section.</p></div>;
  }
  if (section === "invitations") return <GuestInvitationsPage initialUser={workspace.user} properties={workspace.data.properties} />;
  if (section === "audit-log") return <AuditLogPage initialUser={workspace.user} />;
  if (section === "reports") return <WorkspacePage user={workspace.user} initialTab="Reports" />;
  return section === "overview"
    ? <Dashboard initialData={workspace.data} initialUser={workspace.user} />
    : <OperationsPage section={section} data={workspace.data} initialUser={workspace.user} />;
}