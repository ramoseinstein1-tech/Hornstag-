import type { Metadata } from "next";
import Link from "next/link";
import AuthShell from "@/components/auth/AuthShell";
import AuthForm from "@/components/auth/AuthForm";

export const metadata: Metadata = {
  title: "Annotator sign in — Hornstag",
  description: "Sign in to your Hornstag annotator workspace.",
};

export default function AnnotatorSignInPage() {
  return (
    <AuthShell
      eyebrow="ANNOTATOR SIGN IN"
      title="Welcome"
      titleAccent="back, annotator."
      subtitle="Sign in to claim matches and tag game film."
      footer={
        <>
          <p>
            Don&apos;t have an annotator account?{" "}
            <Link
              href="/annotator-signup"
              className="font-medium text-orange-bright transition-colors hover:text-orange"
            >
              Create one
            </Link>
          </p>
          <p className="mt-2">
            Client instead?{" "}
            <Link
              href="/signin"
              className="font-medium text-orange-bright transition-colors hover:text-orange"
            >
              Sign in here
            </Link>
          </p>
        </>
      }
    >
      <AuthForm mode="signin" />
    </AuthShell>
  );
}
