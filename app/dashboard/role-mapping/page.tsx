import {redirect} from "next/navigation";
import {serverUser} from "../../../lib/platform/server-session";
import RoleMappingPage from "../../../components/RoleMappingPage";
export const dynamic="force-dynamic";
export default async function Page(){const user=await serverUser();if(!user?.isOrganizationAdmin)redirect("/dashboard");return <RoleMappingPage initialUser={user}/>;}
