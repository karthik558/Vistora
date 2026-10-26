import { serverUser } from "../../lib/platform/server-session";
import Dashboard, { WorkspaceUser } from "../../components/Dashboard";
import { getDashboardData } from "../../lib/services/guestExperienceService";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const initialUser = await serverUser();

  let initialData = null;
  try {
    const isGlobal = !initialUser || initialUser.role === "admin";
    const allowedPropertyIds = isGlobal
      ? null
      : initialUser?.propertyIds || (initialUser?.propertyId ? [initialUser.propertyId] : []);

    const defaultProperty = !isGlobal && allowedPropertyIds && allowedPropertyIds.length === 1
      ? allowedPropertyIds[0]
      : "all";

    initialData = await getDashboardData(defaultProperty, allowedPropertyIds);
  } catch (err) {
    console.error("Server-side fetch error:", err);
  }

  return <Dashboard initialData={initialData} initialUser={initialUser} />;
}
