import type { Metadata } from "next";
import ComingSoonPanel from "@/components/client-portal/ComingSoonPanel";

export const metadata: Metadata = { title: "Projects — Hornstag Client Portal" };

export default function ProjectsPage() {
  return (
    <ComingSoonPanel
      title="Projects"
      description="A full list and filterable view of every project you've submitted, including status, annotators assigned, and delivery dates."
    />
  );
}
