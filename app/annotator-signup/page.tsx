import type { Metadata } from "next";
import Link from "next/link";
import AuthShell from "@/components/auth/AuthShell";
import AuthForm from "@/components/auth/AuthForm";

export const metadata: Metadata = {
  title: "Annotator sign up — Hornstag",
  description: "Create your Hornstag annotator workspace to claim and tag game film.",
};

export default function AnnotatorSignUpPage() {
  return (
    <AuthShell
      eyebrow="ANNOTATOR SIGN UP"
      title="Start"
      titleAccent="annotating."
      subtitle="Create your annotator workspace to claim and tag game film. You'll need to have been invited by an admin first."
      footer={
        <>
          <p>
            Already have an annotator account?{" "}
            <Link
              href="/annotator-signin"
              className="font-medium text-orange-bright transition-colors hover:text-orange"
            >
              Sign in
            </Link>
          </p>
          <p className="mt-2">
            Client instead?{" "}
            <Link
              href="/signup"
              className="font-medium text-orange-bright transition-colors hover:text-orange"
            >
              Create a client account
            </Link>
          </p>
        </>
      }
    >
      <AuthForm mode="signup" role="annotator" />
    </AuthShell>
  );
}
