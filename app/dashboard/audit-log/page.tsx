import { cookies } from "next/headers";
import AuditLogPage from "../../../components/AuditLogPage";
import { WorkspaceUser } from "../../../components/Dashboard";

export const dynamic = "force-dynamic";

export default async function AuditLogPageRoute() {
  let initialUser: WorkspaceUser | null = null;
  try {
    const cookieStore = await cookies();
    const userCookie = cookieStore.get("vistora-user")?.value;
    if (userCookie) initialUser = JSON.parse(userCookie);
  } catch {}

  return <AuditLogPage initialUser={initialUser} />;
}
