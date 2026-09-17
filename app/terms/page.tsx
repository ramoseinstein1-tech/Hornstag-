import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { type LegalSection } from "@/components/legal/LegalPage";
import { COMPANY_NAME, SUPPORT_EMAIL, LAST_UPDATED } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service — Hornstag",
  description:
    "The terms and conditions that govern your use of the Hornstag basketball intelligence platform.",
};

const sections: LegalSection[] = [
  {
    id: "acceptance",
    heading: "1. Acceptance of Terms",
    content: (
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) form a binding agreement
        between you and {COMPANY_NAME} (&ldquo;Hornstag,&rdquo; &ldquo;we,&rdquo;
        or &ldquo;us&rdquo;) governing your access to and use of the Hornstag
        website, applications, and video annotation and analytics platform
        (collectively, the &ldquo;Service&rdquo;). By creating an account or
        otherwise using the Service, you agree to be bound by these Terms. If
        you do not agree, do not use the Service.
      </p>
    ),
  },
  {
    id: "eligibility",
    heading: "2. Eligibility and Accounts",
    content: (
      <>
        <p>
          You must be at least 16 years old and capable of forming a binding
          contract to use the Service. You are responsible for maintaining the
          confidentiality of your account credentials and for all activity
          that occurs under your account.
        </p>
        <p>
          You agree to provide accurate registration information and to keep
          it up to date. We may suspend or terminate accounts that contain
          inaccurate or fraudulent information.
        </p>
      </>
    ),
  },
  {
    id: "service-description",
    heading: "3. Description of the Service",
    content: (
      <p>
        Hornstag provides tools to convert basketball game footage into
        structured events, quality-assured statistics, and visual analytics.
        Features, availability, and output accuracy may change or improve over
        time, and we do not guarantee uninterrupted or error-free operation of
        the Service.
      </p>
    ),
  },
  {
    id: "acceptable-use",
    heading: "4. Acceptable Use",
    content: (
      <>
        <p>You agree not to:</p>
        <ul>
          <li>Upload content you do not have the right to use or distribute, including footage subject to third-party broadcast or league rights.</li>
          <li>Use the Service to build a competing product or to reverse-engineer our models or software.</li>
          <li>Attempt to gain unauthorized access to the Service, other accounts, or our infrastructure.</li>
          <li>Interfere with or disrupt the integrity or performance of the Service.</li>
          <li>Use the Service for any unlawful, harassing, or fraudulent purpose.</li>
        </ul>
      </>
    ),
  },
  {
    id: "content-ownership",
    heading: "5. Your Content and Data Ownership",
    content: (
      <>
        <p>
          You retain all ownership rights to the game footage, play-by-play
          files, and other materials you upload (&ldquo;Your Content&rdquo;).
          By uploading Your Content, you grant Hornstag a limited,
          non-exclusive license to process, store, and analyze it solely to
          provide and improve the Service for you.
        </p>
        <p>
          Structured events, annotations, and derived statistics generated
          from Your Content are made available to you as part of the Service.
          You are responsible for ensuring you have the necessary rights to
          upload and process any footage you submit.
        </p>
      </>
    ),
  },
  {
    id: "intellectual-property",
    heading: "6. Intellectual Property",
    content: (
      <p>
        The Service, including its software, models, design, and branding, is
        owned by Hornstag and protected by intellectual property laws. Except
        for the limited rights expressly granted to you in these Terms, we
        reserve all rights, title, and interest in the Service.
      </p>
    ),
  },
  {
    id: "subscriptions",
    heading: "7. Subscriptions and Payment",
    content: (
      <p>
        Certain features of the Service require purchasing game annotation
        credits, either individually or as part of a package. Pricing and,
        where applicable, credit expiration terms are presented to you at
        the time of purchase. All purchases are final: fees are
        non-refundable except as required by law or as otherwise stated at
        the point of sale.
      </p>
    ),
  },
  {
    id: "termination",
    heading: "8. Suspension and Termination",
    content: (
      <p>
        You may stop using the Service and close your account at any time. We
        may suspend or terminate your access to the Service if you violate
        these Terms, pose a security risk, or if required by law. Upon
        termination, your right to use the Service will immediately cease.
      </p>
    ),
  },
  {
    id: "disclaimers",
    heading: "9. Disclaimers",
    content: (
      <p>
        The Service is provided &ldquo;as is&rdquo; and &ldquo;as
        available&rdquo; without warranties of any kind, whether express or
        implied, including warranties of merchantability, fitness for a
        particular purpose, and non-infringement. Automated annotations and
        analytics are generated using computer-vision models and may contain
        errors; you should independently verify any output used for
        consequential decisions.
      </p>
    ),
  },
  {
    id: "liability",
    heading: "10. Limitation of Liability",
    content: (
      <p>
        To the maximum extent permitted by law, Hornstag will not be liable
        for any indirect, incidental, special, consequential, or punitive
        damages, or any loss of data, revenue, or profits, arising from your
        use of the Service. Our total liability for any claim arising out of
        these Terms will not exceed the amount you paid us in the twelve
        months preceding the claim.
      </p>
    ),
  },
  {
    id: "indemnification",
    heading: "11. Indemnification",
    content: (
      <p>
        You agree to indemnify and hold Hornstag harmless from any claims,
        damages, or expenses arising from your use of the Service, Your
        Content, or your violation of these Terms.
      </p>
    ),
  },
  {
    id: "governing-law",
    heading: "12. Governing Law",
    content: (
      <p>
        These Terms are governed by the laws of the State of Delaware,
        without regard to its conflict-of-laws principles. Any disputes
        arising under these Terms will be resolved in the state or federal
        courts located in Delaware, and you consent to their jurisdiction.
      </p>
    ),
  },
  {
    id: "changes",
    heading: "13. Changes to These Terms",
    content: (
      <p>
        We may modify these Terms from time to time. If we make material
        changes, we will provide notice through the Service or by email
        before the changes take effect. Continued use of the Service after
        changes become effective constitutes acceptance of the revised Terms.
        See also our{" "}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>
    ),
  },
  {
    id: "contact",
    heading: "14. Contact Us",
    content: (
      <p>
        Questions about these Terms can be directed to{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="LEGAL"
      title="Terms of Service"
      updated={LAST_UPDATED}
      intro="Please read these terms carefully before using the Hornstag platform."
      sections={sections}
    />
  );
}
