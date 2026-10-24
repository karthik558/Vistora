import { cookies } from "next/headers";
import UserManagementPage from "../../../components/UserManagementPage";
import { WorkspaceUser } from "../../../components/Dashboard";

export const dynamic = "force-dynamic";

export default async function UsersRoute() {
  let initialUser: WorkspaceUser | null = null;
  try {
    const cookieStore = await cookies();
    const userCookie = cookieStore.get("vistora-user")?.value;
    if (userCookie) {
      initialUser = JSON.parse(userCookie);
    }
  } catch {}

  return <UserManagementPage initialUser={initialUser} />;
}
