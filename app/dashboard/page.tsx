import Dashboard from "../../components/Dashboard";
import { getDashboardData } from "../../lib/services/guestExperienceService";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Fetch initial data directly from Supabase on the server
  let initialData = null;
  try {
    initialData = await getDashboardData("all");
  } catch (err) {
    console.error("Server-side fetch error:", err);
  }

  return <Dashboard initialData={initialData} />;
}