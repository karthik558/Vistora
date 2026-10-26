import { serverUser } from "../../../lib/platform/server-session";
import SystemSettingsPage from "../../../components/SystemSettingsPage";
import { fetchProperties } from "../../../lib/services/guestExperienceService";
import { WorkspaceUser } from "../../../components/Dashboard";
import {redirect} from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SettingsPageRoute() {
  const initialUser = await serverUser();
  if(!initialUser?.isOrganizationAdmin)redirect("/dashboard");

  const properties = await fetchProperties();

  return <SystemSettingsPage initialUser={initialUser} properties={properties} />;
}
