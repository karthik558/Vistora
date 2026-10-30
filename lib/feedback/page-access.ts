import { redirect } from "next/navigation";
import { serverUser } from "../platform/server-session";
import { hasModuleAccess } from "../auth/modules";

// Layouts persist during soft navigation, so every destination must authorize itself.
export async function requireFeedbackPage(right: string) {
  const user = await serverUser();
  if (!user) redirect("/login");
  if (!hasModuleAccess(user, "feedback") || (!user.isOrganizationAdmin && !user.rights.includes(right))) {
    redirect("/dashboard");
  }
}