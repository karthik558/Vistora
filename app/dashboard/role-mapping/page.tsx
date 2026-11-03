import {redirect} from "next/navigation";
import {serverUser} from "../../../lib/platform/server-session";
import AdministrationWorkspace from "../../../components/AdministrationWorkspace";
import {canOpenRoleMapping} from "../../../lib/auth/administration";
export const dynamic="force-dynamic";
export default async function Page(){
  const user=await serverUser();
  if(!user||!canOpenRoleMapping(user))redirect("/dashboard");
  return <AdministrationWorkspace user={user} initialSection="role-mapping"/>;
}
