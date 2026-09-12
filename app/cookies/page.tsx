import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { type LegalSection } from "@/components/legal/LegalPage";
import { LEGAL_CONTACT_EMAIL, LAST_UPDATED } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Cookie Policy — Hornstag",
  description: "How Hornstag uses cookies and similar technologies.",
};

const sections: LegalSection[] = [
  {
    id: "what-are-cookies",
    heading: "1. What Are Cookies",
    content: (
      <p>
        Cookies are small text files placed on your device when you visit a
        website. They allow a site to recognize your browser, remember
        information about your visit, and provide certain functionality.
        We also use similar technologies such as local storage and pixels,
        which this policy refers to collectively as &ldquo;cookies.&rdquo;
      </p>
    ),
  },
  {
    id: "types",
    heading: "2. Types of Cookies We Use",
    content: (
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th>Purpose</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Essential</strong></td>
            <td>Required for core functionality such as keeping you signed in and maintaining security. The Service cannot function properly without these.</td>
          </tr>
          <tr>
            <td><strong>Preference</strong></td>
            <td>Remember choices you make, such as display settings, so you don&rsquo;t have to reset them on each visit.</td>
          </tr>
          <tr>
            <td><strong>Analytics</strong></td>
            <td>Help us understand how visitors use the Service so we can measure and improve performance and usability.</td>
          </tr>
        </tbody>
      </table>
    ),
  },
  {
    id: "third-party",
    heading: "3. Third-Party Cookies",
    content: (
      <p>
        Some cookies are placed by third-party services we use, such as
        analytics or infrastructure providers. These third parties may use
        cookies to collect information about your use of the Service and
        other websites over time, in accordance with their own privacy
        policies.
      </p>
    ),
  },
  {
    id: "managing",
    heading: "4. Managing Your Cookie Preferences",
    content: (
      <>
        <p>
          Most browsers let you control cookies through their settings,
          including blocking or deleting them. Because essential cookies are
          required for the Service to function, disabling them may affect
          your ability to sign in or use certain features.
        </p>
        <p>
          You can typically manage cookie preferences from your browser&rsquo;s
          settings menu, or through opt-out tools provided by individual
          analytics vendors.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    heading: "5. Changes to This Policy",
    content: (
      <p>
        We may update this Cookie Policy periodically to reflect changes in
        the technologies we use or for legal reasons. Please revisit this
        page occasionally to stay informed. See also our{" "}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>
    ),
  },
  {
    id: "contact",
    heading: "6. Contact Us",
    content: (
      <p>
        Questions about this Cookie Policy can be sent to{" "}
        <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
      </p>
    ),
  },
];

export default function CookiesPage() {
  return (
    <LegalPage
      eyebrow="LEGAL"
      title="Cookie Policy"
      updated={LAST_UPDATED}
      intro="This policy explains how Hornstag uses cookies and similar technologies on our website and platform."
      sections={sections}
    />
  );
}
