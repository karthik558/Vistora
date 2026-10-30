import {redirect} from "next/navigation";
import {serverUser} from "../../../lib/platform/server-session";
import AdministrationWorkspace from "../../../components/AdministrationWorkspace";
export const dynamic="force-dynamic";
export default async function Page(){const user=await serverUser();if(!user?.isOrganizationAdmin)redirect("/dashboard");return <AdministrationWorkspace user={user} initialSection="role-mapping"/>;}
