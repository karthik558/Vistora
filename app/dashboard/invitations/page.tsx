import { serverUser } from "../../../lib/platform/server-session";
import GuestInvitationsPage from "../../../components/GuestInvitationsPage";
import { fetchProperties } from "../../../lib/services/guestExperienceService";
import { WorkspaceUser } from "../../../components/Dashboard";

export const dynamic = "force-dynamic";

export default async function InvitationsPageRoute() {
  const initialUser = await serverUser();

  const properties = await fetchProperties();

  return <GuestInvitationsPage initialUser={initialUser} properties={properties} />;
}
