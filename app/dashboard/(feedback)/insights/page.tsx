import { redirect } from "next/navigation";
import { requireFeedbackPage } from "../../../../lib/feedback/page-access";

export default async function Page() {
  await requireFeedbackPage("view_feedback");
  redirect("/dashboard/analytics");
}
