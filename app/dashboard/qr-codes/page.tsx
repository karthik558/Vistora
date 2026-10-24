import OperationsPage from "../../../components/OperationsPage";
import { getDashboardData } from "../../../lib/services/guestExperienceService";
export const dynamic = "force-dynamic";
export default async function QrCodesPage() { return <OperationsPage section="qr-codes" data={await getDashboardData("all")} />; }