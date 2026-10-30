import { serverUser } from "../../../lib/platform/server-session";
import AdministrationWorkspace from "../../../components/AdministrationWorkspace";
import {redirect} from "next/navigation";
import {canOpenProperties} from "../../../lib/auth/administration";
import { WorkspaceUser } from "../../../components/Dashboard";

export const dynamic = "force-dynamic";

export default async function PropertiesRoute() {
  const initialUser = await serverUser();

  if(!initialUser||!canOpenProperties(initialUser))redirect("/dashboard");
  return <AdministrationWorkspace user={initialUser} initialSection="properties" />;
}
