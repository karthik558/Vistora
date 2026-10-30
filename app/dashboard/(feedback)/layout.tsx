import { redirect } from "next/navigation";
import { serverUser } from "../../../lib/platform/server-session";
import { hasModuleAccess } from "../../../lib/auth/modules";
import { getDashboardData } from "../../../lib/services/guestExperienceService";
import { FeedbackWorkspace } from "../../../components/FeedbackWorkspace";

export default async function FeedbackLayout({ children }: { children: React.ReactNode }) {
  const user = await serverUser();
  if (!user) redirect("/login");
  if (!hasModuleAccess(user, "feedback")) redirect("/dashboard");
  const allowed = user.isOrganizationAdmin ? null : user.propertyIds;
  const data = await getDashboardData("all", allowed);
  return <FeedbackWorkspace data={data} user={user}>{children}</FeedbackWorkspace>;
}