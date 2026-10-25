import { cookies } from "next/headers";
import SystemSettingsPage from "../../../components/SystemSettingsPage";
import { fetchProperties } from "../../../lib/services/guestExperienceService";
import { WorkspaceUser } from "../../../components/Dashboard";

export const dynamic = "force-dynamic";

export default async function SettingsPageRoute() {
  let initialUser: WorkspaceUser | null = null;
  try {
    const cookieStore = await cookies();
    const userCookie = cookieStore.get("vistora-user")?.value;
    if (userCookie) initialUser = JSON.parse(userCookie);
  } catch {}

  const properties = await fetchProperties();

  return <SystemSettingsPage initialUser={initialUser} properties={properties} />;
}
