import {redirect} from "next/navigation";
import {serverUser} from "../../lib/platform/server-session";
import {headers} from "next/headers";
import AppearanceProvider from "../../components/AppearanceProvider";
import {companyAppearance} from "../../lib/hospitality/server";
import {hasModuleAccess} from "../../lib/auth/modules";
import {feedbackSectionRights} from "../../lib/feedback/sections";
import {canOpenSettings,canOpenProperties,canOpenTeam,canOpenRoleMapping,canOpenAuditLog} from "../../lib/auth/administration";

export default async function DashboardLayout({children}:{children:React.ReactNode}) {
 const user=await serverUser();if(!user)redirect("/login");
 const path=(await headers()).get("x-vistora-path")||"";
 const section=path.split("/")[2];
  if(["overview","analytics","feedback","complaints","directory","invitations","forms","questionnaire","qr-codes"].includes(section)&&!hasModuleAccess(user,"feedback"))redirect("/dashboard");
 if(["hospitality","properties"].includes(section)&&!hasModuleAccess(user,"hospitality"))redirect("/dashboard");
  if(section==="settings"&&!canOpenSettings(user))redirect("/dashboard");
  if(section==="properties"&&!canOpenProperties(user))redirect("/dashboard");
  if(section==="users"&&!canOpenTeam(user))redirect("/dashboard");
  if(section==="role-mapping"&&!canOpenRoleMapping(user))redirect("/dashboard");
  if(section==="audit-log"&&!canOpenAuditLog(user))redirect("/dashboard");
  const rules:Record<string,string>={questionnaire:"manage_questionnaire",forms:"manage_questionnaire","qr-codes":"manage_questionnaire",invitations:"manage_questionnaire",complaints:"manage_complaints",feedback:"view_feedback",directory:"view_feedback",analytics:"view_feedback"};
 const right=path.split("/")[2]==="overview"?"view_feedback":rules[path.split("/")[2]];
  // Feedback pages authorize their own section, including query-driven entry.
  if(right&&!Object.hasOwn(feedbackSectionRights,section)&&!user.isOrganizationAdmin&&!user.rights.includes(right))redirect("/dashboard");
 return (
  <AppearanceProvider initial={await companyAppearance(user.organizationId)}>
    {children}
  </AppearanceProvider>
 );
}
