import {redirect} from "next/navigation";
import {serverUser} from "../../../lib/platform/server-session";
import HospitalityPage from "../../../components/HospitalityPage";
export default async function Page(){
 const user=await serverUser();if(!user?.isOrganizationAdmin)redirect("/dashboard");
 return <HospitalityPage user={user}/>;
}
