import OperationsPage from "../../../components/OperationsPage";
import { getDashboardData } from "../../../lib/services/guestExperienceService";
export const dynamic = "force-dynamic";
export default async function ComplaintsPage() { return <OperationsPage section="complaints" data={await getDashboardData("all")} />; }