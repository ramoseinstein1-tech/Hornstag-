import type { Metadata } from "next";
import ComingSoonPanel from "@/components/client-portal/ComingSoonPanel";

export const metadata: Metadata = { title: "Upload Project — Hornstag Client Portal" };

export default function UploadProjectPage() {
  return (
    <ComingSoonPanel
      title="Upload Project"
      description="Submit new game film for annotation — upload footage, attach play-by-play data, and set the scope for your next project."
    />
  );
}
