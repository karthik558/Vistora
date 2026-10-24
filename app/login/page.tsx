import LoginForm from "../../components/LoginForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In | Vistora Operations Workspace",
  description: "Authenticate with your Supabase credentials to access the Vistora operations workspace.",
};

export default function LoginPage() {
  return <LoginForm />;
}
