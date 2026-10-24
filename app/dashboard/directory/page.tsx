import { cookies } from "next/headers";
import OperationsPage from "../../../components/OperationsPage";
import { getDashboardData } from "../../../lib/services/guestExperienceService";
import { WorkspaceUser } from "../../../components/Dashboard";

export const dynamic = "force-dynamic";

export default async function DirectoryPage() {
  let initialUser: WorkspaceUser | null = null;
  try {
    const cookieStore = await cookies();
    const userCookie = cookieStore.get("vistora-user")?.value;
    if (userCookie) initialUser = JSON.parse(userCookie);
  } catch {}

  const isGlobal = !initialUser || initialUser.role === "admin";
  const allowedPropertyIds = isGlobal
    ? null
    : initialUser?.propertyIds || (initialUser?.propertyId ? [initialUser.propertyId] : []);
  const defaultProperty = !isGlobal && allowedPropertyIds && allowedPropertyIds.length === 1
    ? allowedPropertyIds[0]
    : "all";

  const data = await getDashboardData(defaultProperty, allowedPropertyIds);
  return <OperationsPage section="directory" data={data} initialUser={initialUser} />;
}