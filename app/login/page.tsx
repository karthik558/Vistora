import LoginForm from "../../components/LoginForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In | Vistora Operations Workspace",
  description: "Sign in with your workspace credentials to access the Vistora operations dashboard.",
};

export default function LoginPage() {
  return <LoginForm />;
}
