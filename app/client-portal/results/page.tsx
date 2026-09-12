import type { Metadata } from "next";
import ComingSoonPanel from "@/components/client-portal/ComingSoonPanel";

export const metadata: Metadata = { title: "Results — Hornstag Client Portal" };

export default function ResultsPage() {
  return (
    <ComingSoonPanel
      title="Results"
      description="Explore structured events, shot charts, and analytics generated from your completed projects."
    />
  );
}
