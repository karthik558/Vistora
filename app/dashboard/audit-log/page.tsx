import { serverUser } from "../../../lib/platform/server-session";
import AuditLogPage from "../../../components/AuditLogPage";
import { WorkspaceUser } from "../../../components/Dashboard";

export const dynamic = "force-dynamic";

export default async function AuditLogPageRoute() {
  const initialUser = await serverUser();

  return <AuditLogPage initialUser={initialUser} />;
}
