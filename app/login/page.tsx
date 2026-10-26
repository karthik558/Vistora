import { serverUser } from "../../lib/platform/server-session";
import { redirect } from "next/navigation";
import LoginForm from "../../components/LoginForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In | Vistora Operations Workspace",
  description: "Sign in with your workspace credentials to access the Vistora operations dashboard.",
};

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if(await serverUser())redirect("/dashboard");
  return <LoginForm />;
}
