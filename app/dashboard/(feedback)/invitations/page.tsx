import FeedbackWorkspacePage from "../../../../components/FeedbackWorkspace";
import { requireFeedbackPage } from "../../../../lib/feedback/page-access";

export default async function Page() {
  await requireFeedbackPage("manage_questionnaire");
  return <FeedbackWorkspacePage section="invitations" />;
}
