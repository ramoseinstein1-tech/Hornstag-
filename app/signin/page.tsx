import type { Metadata } from "next";
import Link from "next/link";
import AuthShell from "@/components/auth/AuthShell";
import AuthForm from "@/components/auth/AuthForm";

export const metadata: Metadata = {
  title: "Sign in — Hornstag",
  description: "Sign in to your Hornstag basketball intelligence workspace.",
};

export default function SignInPage() {
  return (
    <AuthShell
      eyebrow="SIGN IN"
      title="Welcome"
      titleAccent="back."
      subtitle="Sign in to pick up where the game left off."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-medium text-orange-bright transition-colors hover:text-orange"
          >
            Create one
          </Link>
        </>
      }
    >
      <AuthForm mode="signin" />
    </AuthShell>
  );
}
