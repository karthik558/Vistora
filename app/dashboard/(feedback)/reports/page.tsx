import FeedbackWorkspacePage from "../../../../components/FeedbackWorkspace";
import { requireFeedbackPage } from "../../../../lib/feedback/page-access";

// Reports integrated inside Feedback workspace (replacing legacy adminSection=reports redirect)
export default async function Page() {
  await requireFeedbackPage("export_reports");
  return <FeedbackWorkspacePage section="reports" />;
}
