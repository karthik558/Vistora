import { serverUser } from "../../../lib/platform/server-session";
import UserManagementPage from "../../../components/UserManagementPage";
import { WorkspaceUser } from "../../../components/Dashboard";

export const dynamic = "force-dynamic";

export default async function UsersRoute() {
  const initialUser = await serverUser();

  return <UserManagementPage initialUser={initialUser} />;
}
