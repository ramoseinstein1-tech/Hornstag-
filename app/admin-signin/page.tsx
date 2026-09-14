import type { Metadata } from "next";
import AuthShell from "@/components/auth/AuthShell";
import AuthForm from "@/components/auth/AuthForm";

export const metadata: Metadata = {
  title: "Admin sign in — Hornstag",
  description: "Sign in to the Hornstag admin console.",
};

export default function AdminSignInPage() {
  return (
    <AuthShell
      eyebrow="ADMIN SIGN IN"
      title="Welcome"
      titleAccent="back."
      subtitle="Sign in to manage users and oversee projects."
      footer={null}
    >
      <AuthForm mode="signin" />
    </AuthShell>
  );
}
