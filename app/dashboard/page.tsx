import { cookies } from "next/headers";
import Dashboard, { WorkspaceUser } from "../../components/Dashboard";
import { getDashboardData } from "../../lib/services/guestExperienceService";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let initialUser: WorkspaceUser | null = null;
  try {
    const cookieStore = await cookies();
    const userCookie = cookieStore.get("vistora-user")?.value;
    if (userCookie) {
      initialUser = JSON.parse(userCookie);
    }
  } catch {}

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