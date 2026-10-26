import { serverUser } from "../../../lib/platform/server-session";
import SystemSettingsPage from "../../../components/SystemSettingsPage";
import { fetchProperties } from "../../../lib/services/guestExperienceService";
import { WorkspaceUser } from "../../../components/Dashboard";

export const dynamic = "force-dynamic";

export default async function SettingsPageRoute() {
  const initialUser = await serverUser();

  const properties = await fetchProperties();

  return <SystemSettingsPage initialUser={initialUser} properties={properties} />;
}
