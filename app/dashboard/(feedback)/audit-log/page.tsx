import {redirect} from "next/navigation";
import {serverUser} from "../../../../lib/platform/server-session";
import {canOpenAuditLog} from "../../../../lib/auth/administration";

export default async function Page() {
  const user=await serverUser();
  if(!user)redirect("/login");
  if(!canOpenAuditLog(user))redirect("/dashboard");
  redirect("/dashboard/administration?adminSection=audit-log");
}
