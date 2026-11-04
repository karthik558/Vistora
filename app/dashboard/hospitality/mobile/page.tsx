import { redirect } from "next/navigation";
import { serverUser } from "../../../../lib/platform/server-session";
import { hasModuleAccess } from "../../../../lib/auth/modules";
import MobileOperationsHome from "../../../../components/MobileOperationsHome";
export default async function MobileHomePage() {
  const user = await serverUser();
  if (!user || !hasModuleAccess(user, "hospitality")) redirect("/dashboard");
  return <MobileOperationsHome user={user}/>;
}
