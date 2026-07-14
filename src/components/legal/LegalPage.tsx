import Link from "next/link";
import {
  LEGAL_EFFECTIVE_DATE,
  LEGAL_LAST_UPDATED,
  LEGAL_VERSION,
  legalPages,
} from "@/config/legal";

export type LegalSection = {
  id: string;
  title: string;
  paragraphs: string[];
};

type LegalPageProps = {
  title: string;
  eyebrow: string;
  intro: string;
  sections: LegalSection[];
};

export default function LegalPage({
  title,
  eyebrow,
  intro,
  sections,
}: LegalPageProps) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_center,#001f11_0%,#000a06_100%)] px-4 py-10 text-[#eafff2] sm:px-6 lg:px-10">
      <article className="mx-auto max-w-5xl">
        <header className="rounded-3xl border border-[#00ff66]/25 bg-black/55 p-6 shadow-[0_0_45px_rgba(0,255,100,0.08)] backdrop-blur-xl sm:p-8">
          <p className="text-xs uppercase tracking-[0.35em] text-[#7f9f8f]">
            {eyebrow}
          </p>
          <h1 className="mt-4 text-3xl font-bold uppercase tracking-[0.16em] text-[#00ff66] sm:text-5xl">
            {title}
          </h1>
          <p className="mt-5 max-w-3xl text-sm leading-7 text-gray-300">
            {intro}
          </p>
          <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
            <MetaItem label="Effective" value={LEGAL_EFFECTIVE_DATE} />
            <MetaItem label="Last Updated" value={LEGAL_LAST_UPDATED} />
            <MetaItem label="Version" value={LEGAL_VERSION} />
          </dl>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <nav
              aria-label={`${title} table of contents`}
              className="rounded-3xl border border-[#00ff66]/20 bg-black/45 p-5"
            >
              <h2 className="text-sm font-bold uppercase tracking-[0.22em] text-[#00ff66]">
                Contents
              </h2>
              <ol className="mt-4 space-y-3 text-sm text-gray-400">
                {sections.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="transition hover:text-[#00ff66]"
                    >
                      {section.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </aside>

          <div className="space-y-5">
            {sections.map((section) => (
              <section
                key={section.id}
                id={section.id}
                className="scroll-mt-28 rounded-3xl border border-[#00ff66]/20 bg-black/45 p-6"
              >
                <h2 className="text-xl font-bold text-[#00ff66]">
                  {section.title}
                </h2>
                <div className="mt-4 space-y-4 text-sm leading-7 text-gray-300">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>

        <footer className="mt-6 rounded-3xl border border-[#00ff66]/20 bg-black/45 p-5">
          <h2 className="text-sm font-bold uppercase tracking-[0.22em] text-[#00ff66]">
            Related Legal Pages
          </h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {legalPages.map((page) => (
              <Link
                key={page.href}
                href={page.href}
                className="rounded-xl border border-[#00ff66]/30 px-4 py-2 text-sm text-[#00ff66] transition hover:bg-[#00ff66]/10"
              >
                {page.title}
              </Link>
            ))}
            <Link
              href="/"
              className="rounded-xl border border-white/15 px-4 py-2 text-sm text-gray-300 transition hover:bg-white/10"
            >
              Back to Main Website
            </Link>
          </div>
        </footer>
      </article>
    </main>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#00ff66]/15 bg-black/35 p-4">
      <dt className="text-[11px] uppercase tracking-[0.18em] text-gray-500">
        {label}
      </dt>
      <dd className="mt-2 text-[#eafff2]">{value}</dd>
    </div>
  );
}
