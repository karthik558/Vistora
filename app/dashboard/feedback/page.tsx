import OperationsPage from "../../../components/OperationsPage";
import { getDashboardData } from "../../../lib/services/guestExperienceService";
export const dynamic = "force-dynamic";
export default async function FeedbackPage() { return <OperationsPage section="feedback" data={await getDashboardData("all")} />; }