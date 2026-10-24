import OperationsPage from "../../../components/OperationsPage";
import { getDashboardData } from "../../../lib/services/guestExperienceService";

export const dynamic = "force-dynamic";

export default async function QuestionnaireRoute() {
  const data = await getDashboardData("all");
  return <OperationsPage section="questionnaire" data={data} />;
}
