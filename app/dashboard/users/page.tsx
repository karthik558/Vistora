import { serverUser } from "../../../lib/platform/server-session";
import AdministrationWorkspace from "../../../components/AdministrationWorkspace";
import {redirect} from "next/navigation";
import {canOpenTeam} from "../../../lib/auth/administration";
import { WorkspaceUser } from "../../../components/Dashboard";

export const dynamic = "force-dynamic";

export default async function UsersRoute() {
  const initialUser = await serverUser();

  if(!initialUser||!canOpenTeam(initialUser))redirect("/dashboard");
  return <AdministrationWorkspace user={initialUser} initialSection="users" />;
}
