import type { ReactNode } from "react";
import AnnotatorPortalGuard from "@/components/annotator-portal/AnnotatorPortalGuard";

export default function AnnotatorPortalLayout({ children }: { children: ReactNode }) {
  return <AnnotatorPortalGuard>{children}</AnnotatorPortalGuard>;
}
