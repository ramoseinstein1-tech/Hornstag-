import type { Metadata } from "next";
import LegalPage, { type LegalSection } from "@/components/legal/LegalPage";
import { SUPPORT_EMAIL, LAST_UPDATED } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Accessibility — Hornstag",
  description: "Hornstag's commitment to digital accessibility.",
};

const sections: LegalSection[] = [
  {
    id: "commitment",
    heading: "1. Our Commitment",
    content: (
      <p>
        Hornstag is committed to making our website and platform usable by
        everyone, including people with disabilities. We work to design and
        build our Service in line with recognized accessibility standards and
        to continually improve the experience for all users.
      </p>
    ),
  },
  {
    id: "conformance",
    heading: "2. Conformance Status",
    content: (
      <p>
        We aim to meet the Web Content Accessibility Guidelines (WCAG) 2.1
        Level AA. Our site is built with semantic HTML, keyboard-navigable
        interactive elements, visible focus states, sufficient color
        contrast, and support for reduced-motion preferences. Conformance is
        an ongoing effort rather than a one-time achievement, and some areas
        of the Service may not yet fully meet every guideline.
      </p>
    ),
  },
  {
    id: "measures",
    heading: "3. Accessibility Measures We Take",
    content: (
      <ul>
        <li>Semantic landmarks and heading structure for screen-reader navigation.</li>
        <li>Keyboard access to all interactive controls, including the annotation timeline and navigation menus.</li>
        <li>Visible focus outlines on every interactive element.</li>
        <li>Reduced-motion support that scales back animation and 3D movement when requested by the operating system.</li>
        <li>Text alternatives for meaningful non-text content.</li>
      </ul>
    ),
  },
  {
    id: "limitations",
    heading: "4. Known Limitations",
    content: (
      <p>
        Despite our efforts, some parts of the Service — particularly
        interactive 3D visualizations — may be less accessible to assistive
        technologies than standard HTML content. We are actively working to
        improve these areas and welcome feedback on specific issues you
        encounter.
      </p>
    ),
  },
  {
    id: "feedback",
    heading: "5. Feedback",
    content: (
      <p>
        We welcome your feedback on the accessibility of the Hornstag
        platform. If you encounter an accessibility barrier, please contact
        us at{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and let us
        know the page and nature of the issue so we can address it.
      </p>
    ),
  },
];

export default function AccessibilityPage() {
  return (
    <LegalPage
      eyebrow="LEGAL"
      title="Accessibility"
      updated={LAST_UPDATED}
      intro="Our ongoing approach to making Hornstag usable for everyone."
      sections={sections}
    />
  );
}
