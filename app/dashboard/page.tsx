import { cookies } from "next/headers";
import Dashboard, { WorkspaceUser } from "../../components/Dashboard";
import { getDashboardData } from "../../lib/services/guestExperienceService";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let initialData = null;
  try {
    initialData = await getDashboardData("all");
  } catch (err) {
    console.error("Server-side fetch error:", err);
  }

  let initialUser: WorkspaceUser | null = null;
  try {
    const cookieStore = await cookies();
    const userCookie = cookieStore.get("vistora-user")?.value;
    if (userCookie) {
      initialUser = JSON.parse(userCookie);
    }
  } catch {}

  return <Dashboard initialData={initialData} initialUser={initialUser} />;
}