import FeedbackWorkspacePage from "../../../../components/FeedbackWorkspace";
import { requireFeedbackPage } from "../../../../lib/feedback/page-access";

export default async function Page() {
  await requireFeedbackPage("view_audit_log");
  return <FeedbackWorkspacePage section="audit-log" />;
}
