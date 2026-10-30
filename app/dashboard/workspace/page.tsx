import AdministrationWorkspace from "../../../components/AdministrationWorkspace";
import {serverUser} from "../../../lib/platform/server-session";
import {redirect} from "next/navigation";
export default async function Page(){
 const user=await serverUser();
 if(!user?.isOrganizationAdmin)redirect("/dashboard");
 return <AdministrationWorkspace user={user} initialSection="workspace"/>;
}
