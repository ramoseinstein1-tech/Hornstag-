import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { type LegalSection } from "@/components/legal/LegalPage";
import { LEGAL_CONTACT_EMAIL, COMPANY_NAME, LAST_UPDATED } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy — Hornstag",
  description:
    "How Hornstag collects, uses, and protects information when you use our basketball intelligence platform.",
};

const sections: LegalSection[] = [
  {
    id: "overview",
    heading: "1. Overview",
    content: (
      <p>
        This Privacy Policy explains how {COMPANY_NAME} (&ldquo;Hornstag,&rdquo;
        &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) collects, uses,
        discloses, and safeguards information when you visit our website, create
        an account, or use our video annotation and basketball analytics
        platform (collectively, the &ldquo;Service&rdquo;). By using the
        Service, you agree to the collection and use of information in
        accordance with this policy.
      </p>
    ),
  },
  {
    id: "information-we-collect",
    heading: "2. Information We Collect",
    content: (
      <>
        <h3>Account information</h3>
        <p>
          When you create an account we collect your name, email address,
          password (stored as a salted hash, never in plain text), and
          organization or team details you choose to provide.
        </p>
        <h3>Game film and uploaded content</h3>
        <p>
          If you upload video footage, play-by-play files, or other basketball
          data to the platform, we process that content to generate
          annotations, structured events, and analytics on your behalf. You
          retain ownership of content you upload, as described in our{" "}
          <Link href="/terms">Terms of Service</Link>.
        </p>
        <h3>Usage data</h3>
        <p>
          We automatically collect information about how you interact with the
          Service, including pages viewed, features used, timestamps, browser
          type, device identifiers, and approximate location derived from IP
          address.
        </p>
        <h3>Cookies and similar technologies</h3>
        <p>
          We use cookies and comparable technologies to keep you signed in,
          remember preferences, and understand aggregate usage. See our{" "}
          <Link href="/cookies">Cookie Policy</Link> for details and how to
          control them.
        </p>
      </>
    ),
  },
  {
    id: "how-we-use",
    heading: "3. How We Use Information",
    content: (
      <ul>
        <li>To provide, operate, and maintain the Service, including generating annotations and analytics from uploaded footage.</li>
        <li>To create and manage your account and authenticate sign-in.</li>
        <li>To monitor and improve the accuracy of our computer-vision and quality-assurance models.</li>
        <li>To communicate with you about your account, updates, security alerts, and support requests.</li>
        <li>To detect, investigate, and prevent fraudulent, unauthorized, or illegal activity.</li>
        <li>To comply with legal obligations and enforce our agreements.</li>
      </ul>
    ),
  },
  {
    id: "sharing",
    heading: "4. How We Share Information",
    content: (
      <>
        <p>
          We do not sell your personal information. We may share information
          in the following limited circumstances:
        </p>
        <ul>
          <li><strong>Service providers</strong> — vendors who host our infrastructure, process payments, or provide analytics, bound by confidentiality obligations.</li>
          <li><strong>Team and organization members</strong> — data and annotated footage within a shared workspace is visible to other members you or your organization invite.</li>
          <li><strong>Legal requirements</strong> — where disclosure is required to comply with law, court order, or governmental request.</li>
          <li><strong>Business transfers</strong> — in connection with a merger, acquisition, or sale of assets, subject to standard confidentiality terms.</li>
        </ul>
      </>
    ),
  },
  {
    id: "retention",
    heading: "5. Data Retention",
    content: (
      <p>
        We retain account information and uploaded content for as long as your
        account is active or as needed to provide the Service. If you delete
        your account, we will delete or anonymize your personal information
        within 90 days, except where retention is required to comply with a
        legal obligation, resolve disputes, or enforce our agreements.
      </p>
    ),
  },
  {
    id: "your-rights",
    heading: "6. Your Rights and Choices",
    content: (
      <>
        <p>
          Depending on your location, you may have the right to access,
          correct, export, or delete your personal information, and to object
          to or restrict certain processing. You can exercise most of these
          rights directly from your account settings, or by contacting us at{" "}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
        </p>
        <p>
          Residents of the European Economic Area, the UK, and California have
          additional rights under GDPR and the CCPA/CPRA respectively,
          including the right to lodge a complaint with a supervisory
          authority.
        </p>
      </>
    ),
  },
  {
    id: "security",
    heading: "7. Security",
    content: (
      <p>
        We use industry-standard technical and organizational measures —
        including encryption in transit, access controls, and regular
        security reviews — to protect information against unauthorized
        access, alteration, disclosure, or destruction. No method of
        transmission or storage is completely secure, and we cannot guarantee
        absolute security.
      </p>
    ),
  },
  {
    id: "childrens-privacy",
    heading: "8. Children's Privacy",
    content: (
      <p>
        The Service is not directed to individuals under 16, and we do not
        knowingly collect personal information from children. If you believe a
        child has provided us with personal information, please contact us so
        we can remove it.
      </p>
    ),
  },
  {
    id: "international",
    heading: "9. International Data Transfers",
    content: (
      <p>
        We may process and store information in countries other than your
        own. Where we transfer personal data internationally, we rely on
        appropriate safeguards, such as standard contractual clauses, to
        protect that information.
      </p>
    ),
  },
  {
    id: "changes",
    heading: "10. Changes to This Policy",
    content: (
      <p>
        We may update this Privacy Policy from time to time. If we make
        material changes, we will notify you by email or through the Service
        prior to the change becoming effective. The &ldquo;Last updated&rdquo;
        date above reflects the most recent revision.
      </p>
    ),
  },
  {
    id: "contact",
    heading: "11. Contact Us",
    content: (
      <p>
        If you have questions about this Privacy Policy or how we handle your
        information, contact us at{" "}
        <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="LEGAL"
      title="Privacy Policy"
      updated={LAST_UPDATED}
      intro="This policy describes what information Hornstag collects, why we collect it, and the choices you have."
      sections={sections}
    />
  );
}
