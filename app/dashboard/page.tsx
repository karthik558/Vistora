import { serverUser } from "../../lib/platform/server-session";
import ModuleLauncher from "../../components/ModuleLauncher";
import {redirect} from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const initialUser = await serverUser();

  if(!initialUser)redirect("/login");
  return <ModuleLauncher user={initialUser}/>;
}
