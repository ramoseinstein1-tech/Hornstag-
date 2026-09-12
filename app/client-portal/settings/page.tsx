import type { Metadata } from "next";
import ComingSoonPanel from "@/components/client-portal/ComingSoonPanel";

export const metadata: Metadata = { title: "Account Settings — Hornstag Client Portal" };

export default function AccountSettingsPage() {
  return (
    <ComingSoonPanel
      title="Account Settings"
      description="Update your profile, notification preferences, team members, and security settings."
    />
  );
}
