import {redirect} from "next/navigation";
import {serverUser} from "../../../lib/platform/server-session";
import HospitalityPage from "../../../components/HospitalityPage";
import {hasModuleAccess} from "../../../lib/auth/modules";
export default async function Page(){
 const user=await serverUser();if(!user||!hasModuleAccess(user,"hospitality"))redirect("/dashboard");
 return <HospitalityPage user={user}/>;
}
