import { serverUser } from "../../../lib/platform/server-session";
import AdministrationWorkspace from "../../../components/AdministrationWorkspace";
import {redirect} from "next/navigation";
import { canOpenSettings } from "../../../lib/auth/administration";

export const dynamic = "force-dynamic";

export default async function SettingsPageRoute() {
  const initialUser = await serverUser();
  if(!initialUser||!canOpenSettings(initialUser))redirect("/dashboard");


  return <AdministrationWorkspace user={initialUser} initialSection="settings" />;
}
