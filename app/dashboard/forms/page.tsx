import OperationsPage from "../../../components/OperationsPage";
import { getDashboardData } from "../../../lib/services/guestExperienceService";
export const dynamic = "force-dynamic";
export default async function FormsPage() { return <OperationsPage section="forms" data={await getDashboardData("all")} />; }