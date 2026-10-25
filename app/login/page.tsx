import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import LoginForm from "../../components/LoginForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In | Vistora Operations Workspace",
  description: "Sign in with your workspace credentials to access the Vistora operations dashboard.",
};

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const cookieStore = await cookies();
  const userCookie = cookieStore.get("vistora-user")?.value;
  if (userCookie) {
    try {
      const parsed = JSON.parse(decodeURIComponent(userCookie));
      if (parsed?.email) {
        redirect("/dashboard");
      }
    } catch {}
  }

  return <LoginForm />;
}
