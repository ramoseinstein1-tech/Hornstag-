import type { Metadata } from "next";
import Link from "next/link";
import AuthShell from "@/components/auth/AuthShell";
import AuthForm from "@/components/auth/AuthForm";

export const metadata: Metadata = {
  title: "Create account — Hornstag",
  description:
    "Create a Hornstag account and start turning game film into game data.",
};

export default function SignUpPage() {
  return (
    <AuthShell
      eyebrow="CREATE ACCOUNT"
      title="Start reading"
      titleAccent="the game."
      subtitle="Create your workspace and turn footage into structured data."
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/signin"
            className="font-medium text-orange-bright transition-colors hover:text-orange"
          >
            Sign in
          </Link>
        </>
      }
    >
      <AuthForm mode="signup" />
    </AuthShell>
  );
}
