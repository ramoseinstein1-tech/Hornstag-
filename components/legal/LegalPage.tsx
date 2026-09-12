"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Navbar from "../Navbar";
import Footer from "../Footer";

export type LegalSection = {
  id: string;
  heading: string;
  content: ReactNode;
};

export default function LegalPage({
  eyebrow,
  title,
  updated,
  intro,
  sections,
}: {
  eyebrow: string;
  title: string;
  updated: string;
  intro?: ReactNode;
  sections: LegalSection[];
}) {
  const [active, setActive] = useState(sections[0]?.id ?? "");

  useEffect(() => {
    const headings = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => !!el);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: 0 }
    );

    headings.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections]);

  return (
    <>
      <Navbar />

      <main className="relative">
        <div className="grid-bg mask-fade-bottom absolute inset-0 h-[560px] opacity-30" />
        <div
          className="bloom absolute -left-32 top-10 h-[26rem] w-[26rem]"
          style={{ background: "rgba(255,106,0,0.08)" }}
          aria-hidden="true"
        />

        <header className="relative mx-auto max-w-[1000px] px-6 pb-16 pt-36 md:px-10 md:pt-44">
          <span className="hs-chip mb-6">{eyebrow}</span>
          <h1 className="display-md uppercase">
            <span className="text-gradient">{title}</span>
          </h1>
          <p className="mt-4 font-mono-tech text-[0.68rem] tracking-[0.18em] text-text-faint">
            LAST UPDATED {updated.toUpperCase()}
          </p>
          {intro && (
            <div className="mt-6 max-w-2xl text-base leading-relaxed text-text-muted">
              {intro}
            </div>
          )}
        </header>

        <div className="relative mx-auto grid max-w-[1000px] grid-cols-1 gap-12 px-6 pb-28 md:px-10 lg:grid-cols-[220px_1fr]">
          <nav
            aria-label="Sections"
            className="hidden lg:block"
          >
            <div className="sticky top-28 border-l border-border pl-5">
              <p className="mb-4 font-mono-tech text-[0.6rem] tracking-[0.2em] text-text-faint">
                ON THIS PAGE
              </p>
              <ul className="flex flex-col gap-3">
                {sections.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className={`block text-sm leading-snug transition-colors duration-300 ${
                        active === s.id
                          ? "text-orange-bright"
                          : "text-text-faint hover:text-text-muted"
                      }`}
                    >
                      {s.heading}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          <article className="min-w-0">
            {sections.map((s, i) => (
              <section
                key={s.id}
                id={s.id}
                className={`scroll-mt-28 ${i > 0 ? "mt-12 border-t border-border pt-12" : ""}`}
              >
                <h2 className="font-display text-xl font-semibold tracking-tight text-text md:text-2xl">
                  {s.heading}
                </h2>
                <div className="prose-legal mt-4">{s.content}</div>
              </section>
            ))}
          </article>
        </div>
      </main>

      <Footer />
    </>
  );
}
