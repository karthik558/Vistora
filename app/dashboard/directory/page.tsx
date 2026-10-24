import OperationsPage from "../../../components/OperationsPage";
import { getDashboardData } from "../../../lib/services/guestExperienceService";
export const dynamic = "force-dynamic";
export default async function DirectoryPage() { return <OperationsPage section="directory" data={await getDashboardData("all")} />; }