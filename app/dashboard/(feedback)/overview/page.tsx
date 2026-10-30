import FeedbackWorkspacePage from "../../../../components/FeedbackWorkspace";
import { requireFeedbackPage } from "../../../../lib/feedback/page-access";
import { feedbackSectionRights } from "../../../../lib/feedback/sections";

export default async function Page({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const { section = "overview" } = await searchParams;
  await requireFeedbackPage(Object.hasOwn(feedbackSectionRights, section) ? feedbackSectionRights[section] : "view_feedback");
  return <FeedbackWorkspacePage section="overview" />;
}
