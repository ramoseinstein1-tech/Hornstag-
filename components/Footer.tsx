import Image from "next/image";
import Link from "next/link";
import { SUPPORT_EMAIL } from "@/lib/legal";

const COLUMNS = [
  {
    title: "PLATFORM",
    links: [
      { label: "Workflow", href: "/#workflow" },
      { label: "Annotation", href: "/#annotation" },
      { label: "Analytics", href: "/#analytics" },
      { label: "Court View", href: "/#platform" },
    ],
  },
  {
    title: "COMPANY",
    links: [
      { label: "About", href: "/#top" },
      { label: "Contact", href: "/#final-cta" },
      { label: "Careers", href: "/#final-cta" },
    ],
  },
  {
    title: "ACCOUNT",
    links: [
      { label: "Sign in", href: "/signin" },
      { label: "Create account", href: "/signup" },
    ],
  },
  {
    title: "LEGAL",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Cookie Policy", href: "/cookies" },
      { label: "Accessibility", href: "/accessibility" },
    ],
  },
];

const SOCIALS = [
  { label: "X", href: "#" },
  { label: "LinkedIn", href: "#" },
  { label: "GitHub", href: "#" },
];

export default function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-border bg-background">
      <div
        className="bloom absolute -bottom-40 left-1/2 h-[24rem] w-[44rem] -translate-x-1/2"
        style={{ background: "rgba(255,106,0,0.06)" }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-[1440px] px-6 py-16 md:px-10 md:py-20">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-[1.4fr_2fr]">
          <div>
            <Image
              src="/hornstag-wordmark.png"
              alt="Hornstag"
              width={1528}
              height={638}
              className="h-10 w-auto"
            />
            <p className="mt-4 font-mono-tech text-xs tracking-[0.16em] text-text-muted">
              BASKETBALL INTELLIGENCE.
            </p>
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-text-faint">
              Turning basketball footage into structured, reliable game data.
            </p>

            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="mt-4 inline-block font-mono-tech text-xs tracking-[0.08em] text-text-muted transition-colors duration-300 hover:text-orange-bright"
            >
              {SUPPORT_EMAIL}
            </a>

            <div className="mt-7 flex gap-3">
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  className="flex h-9 items-center rounded-md border border-border px-3.5 font-mono-tech text-[0.62rem] tracking-[0.14em] text-text-muted transition-all duration-300 hover:border-orange/40 hover:text-orange-bright"
                >
                  {s.label.toUpperCase()}
                </a>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <h3 className="font-mono-tech text-[0.62rem] tracking-[0.2em] text-text-faint">
                  {col.title}
                </h3>
                <ul className="mt-5 flex flex-col gap-3">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <Link
                        href={l.href}
                        className="text-sm text-text-muted transition-colors duration-300 hover:text-orange-bright"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-wrap items-center gap-4 border-t border-border pt-10">
          <span className="font-mono-tech text-[0.62rem] tracking-[0.2em] text-text-faint">
            TEAM PORTALS
          </span>
          <Link href="/signin" className="hs-btn-secondary">
            CLIENT LOGIN
          </Link>
          <Link href="/annotator-signin" className="hs-btn-secondary">
            ANNOTATOR LOGIN
          </Link>
        </div>

        <div className="mt-8 flex flex-col gap-5 border-t border-border pt-7 text-xs text-text-faint md:flex-row md:items-center md:justify-between">
          <span>© {new Date().getFullYear()} Hornstag, Inc. All rights reserved.</span>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href="/privacy" className="transition-colors duration-300 hover:text-orange-bright">
              Privacy
            </Link>
            <Link href="/terms" className="transition-colors duration-300 hover:text-orange-bright">
              Terms
            </Link>
            <Link href="/cookies" className="transition-colors duration-300 hover:text-orange-bright">
              Cookies
            </Link>
            <Link href="/accessibility" className="transition-colors duration-300 hover:text-orange-bright">
              Accessibility
            </Link>
          </div>

          <span className="font-mono-tech tracking-[0.14em]">
            FROM COURT ACTION TO STRUCTURED DATA.
          </span>
        </div>

        <p className="mt-4 text-[0.68rem] text-text-faint/70">
          Tiger mascot 3D model by{" "}
          <a
            href="https://www.meshy.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-dotted transition-colors duration-300 hover:text-orange-bright"
          >
            Meshy
          </a>
          , licensed CC BY 4.0.
        </p>
      </div>
    </footer>
  );
}
