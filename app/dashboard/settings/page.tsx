import { serverUser } from "../../../lib/platform/server-session";
import AdministrationWorkspace from "../../../components/AdministrationWorkspace";
import {redirect} from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SettingsPageRoute() {
  const initialUser = await serverUser();
  if(!initialUser?.isOrganizationAdmin)redirect("/dashboard");


  return <AdministrationWorkspace user={initialUser} initialSection="settings" />;
}
