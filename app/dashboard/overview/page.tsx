import {serverUser} from "../../../lib/platform/server-session";
import Dashboard from "../../../components/Dashboard";
import {getDashboardData} from "../../../lib/services/guestExperienceService";

export const dynamic="force-dynamic";
export default async function FeedbackOverview(){
 const user=await serverUser();
 let initialData=null;
 try{
  const allowed=user?.isOrganizationAdmin?null:user?.propertyIds||(user?.propertyId?[user.propertyId]:[]);
  initialData=await getDashboardData(allowed?.length===1?allowed[0]:"all",allowed);
 }catch(error){console.error("Feedback overview could not load:",error);}
 return <Dashboard initialData={initialData} initialUser={user}/>;
}
