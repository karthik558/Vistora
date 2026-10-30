"use client";
import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { AppShell, WorkspaceUser } from "./Dashboard";
import { FeedbackShellContext } from "./FeedbackShellContext";
import { canOpenTeam, canOpenSettings, canOpenProperties, canOpenWorkspace } from "../lib/auth/administration";
import WorkspacePage from "./WorkspacePage";
import UserManagementPage from "./UserManagementPage";
import SystemSettingsPage from "./SystemSettingsPage";
import PropertiesPage from "./PropertiesPage";
import RoleMappingPage from "./RoleMappingPage";

const labels: Record<string,string> = {workspace:"Workspace",users:"Team & users",settings:"Settings",properties:"Properties","role-mapping":"Role mapping"};
export default function AdministrationWorkspace({ user, initialSection }: { user: WorkspaceUser; initialSection: string }) {
  const params = useSearchParams(), pathname = usePathname();
  const section = params.get("adminSection") || initialSection;
  const permissions: Record<string,boolean> = {workspace:canOpenWorkspace(user),users:canOpenTeam(user),settings:canOpenSettings(user),properties:canOpenProperties(user),"role-mapping":!!user.isOrganizationAdmin};
  const allowed = (name: string) => Object.hasOwn(permissions,name) && permissions[name] === true;
  const [visited, setVisited] = useState<string[]>([section]);
  // Keep visited forms mounted, but do not fetch every administration screen on entry.
  const visible = visited.includes(section) ? visited : [...visited, section];
  if (!visited.includes(section)) setVisited(visible);
  return <div onClickCapture={event => {
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const link=(event.target as Element).closest<HTMLAnchorElement>("a[href]");
    if(!link||link.target||link.hasAttribute("download"))return;
    const url=new URL(link.href,window.location.href), next=url.searchParams.get("adminSection");
    if(url.origin!==window.location.origin||url.pathname!==pathname||!next||!allowed(next))return;
    event.preventDefault();
    if(url.href!==window.location.href)window.history.pushState(null,"",url.pathname+url.search);
  }}>
    <AppShell active={labels[section]||"Administration"} user={user}>
      <FeedbackShellContext.Provider value={true}>
        {!allowed(section)&&<div className="content-wrap"><h1>Access restricted</h1><p>This section is not assigned to your account.</p></div>}
        {visible.filter(allowed).map(name=><div key={name} hidden={name!==section}>
          {name==="workspace"?<WorkspacePage user={user}/>:name==="users"?<UserManagementPage initialUser={user}/>:name==="settings"?<SystemSettingsPage initialUser={user}/>:name==="properties"?<PropertiesPage initialUser={user}/>:<RoleMappingPage initialUser={user}/>}
        </div>)}
      </FeedbackShellContext.Provider>
    </AppShell>
  </div>;
}