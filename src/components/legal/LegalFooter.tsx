import Link from "next/link";
import { getLegalContactHref } from "@/config/legal";

const legalFooterLinks = [
  { href: "/legal/privacy", label: "Privacy Notice" },
  { href: "/legal/terms", label: "Website Terms" },
  { href: "/legal/cookies", label: "Cookie Policy" },
  { href: getLegalContactHref(), label: "Contact" },
];

export default function LegalFooter() {
  return (
    <footer className="border-t border-[#00ff66]/15 bg-black px-4 py-6 text-[#eafff2] sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 text-xs text-gray-500 md:flex-row md:items-center md:justify-between">
        <p>
          101st Doom Battalion operational website. Not affiliated with Discord,
          Valve, Bohemia Interactive, Disney, or Lucasfilm.
        </p>
        <nav aria-label="Legal links" className="flex flex-wrap gap-x-5 gap-y-2">
          {legalFooterLinks.map((link) =>
            link.href.startsWith("mailto:") ? (
              <a
                key={link.label}
                href={link.href}
                className="text-[#00ff66] transition hover:text-white"
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.label}
                href={link.href}
                className="text-[#00ff66] transition hover:text-white"
              >
                {link.label}
              </Link>
            )
          )}
        </nav>
      </div>
    </footer>
  );
}
