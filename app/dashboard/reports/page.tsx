import OperationsPage from "../../../components/OperationsPage";
import { getDashboardData } from "../../../lib/services/guestExperienceService";
export const dynamic = "force-dynamic";
export default async function ReportsPage() { return <OperationsPage section="reports" data={await getDashboardData("all")} />; }