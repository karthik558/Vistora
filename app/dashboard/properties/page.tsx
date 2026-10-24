import { cookies } from "next/headers";
import PropertiesPage from "../../../components/PropertiesPage";
import { WorkspaceUser } from "../../../components/Dashboard";

export const dynamic = "force-dynamic";

export default async function PropertiesRoute() {
  let initialUser: WorkspaceUser | null = null;
  try {
    const cookieStore = await cookies();
    const userCookie = cookieStore.get("vistora-user")?.value;
    if (userCookie) {
      initialUser = JSON.parse(userCookie);
    }
  } catch {}

  return <PropertiesPage initialUser={initialUser} />;
}
