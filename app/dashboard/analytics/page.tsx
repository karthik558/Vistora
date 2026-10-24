import OperationsPage from "../../../components/OperationsPage";
import { getDashboardData } from "../../../lib/services/guestExperienceService";
export const dynamic = "force-dynamic";
export default async function AnalyticsPage() { return <OperationsPage section="analytics" data={await getDashboardData("all")} />; }