import {redirect} from "next/navigation";
import {serverUser} from "../../lib/platform/server-session";
import {headers} from "next/headers";
export default async function DashboardLayout({children}:{children:React.ReactNode}) {
 const user=await serverUser();if(!user)redirect("/login");
 const path=(await headers()).get("x-vistora-path")||"";
 const rules:Record<string,string>={users:"manage_users",properties:"manage_properties",reports:"export_reports",settings:"manage_settings",questionnaire:"manage_questionnaire",forms:"manage_questionnaire","qr-codes":"manage_questionnaire",invitations:"manage_questionnaire",complaints:"manage_complaints",feedback:"view_feedback",directory:"view_feedback",analytics:"view_feedback","audit-log":"view_audit_log"};
 const right=rules[path.split("/")[2]];
 if(right&&!user.isOrganizationAdmin&&!user.rights.includes(right))redirect("/dashboard");
 return children;
}
