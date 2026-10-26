import { serverUser } from "../../../lib/platform/server-session";
import PropertiesPage from "../../../components/PropertiesPage";
import { WorkspaceUser } from "../../../components/Dashboard";

export const dynamic = "force-dynamic";

export default async function PropertiesRoute() {
  const initialUser = await serverUser();

  return <PropertiesPage initialUser={initialUser} />;
}
