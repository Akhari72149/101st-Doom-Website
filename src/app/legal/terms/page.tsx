import type { Metadata } from "next";
import LegalPage, { LegalSection } from "@/components/legal/LegalPage";
import { LEGAL_CONTACT_NAME } from "@/config/legal";

export const metadata: Metadata = {
  title: "Website Terms of Use | 101st Doom Battalion",
  description:
    "Website Terms of Use for the 101st Doom Battalion operational website and account-linked community systems.",
};

const termsSections: LegalSection[] = [
  {
    id: "about",
    title: "1. About the website",
    paragraphs: [
      "This website provides operational and personnel-management tools for the 101st Doom Battalion community, including roster information, personnel profiles, attendance, certifications, awards, account linking, and administrative tools.",
      "The website is intended for community use and does not provide official public authority, military, commercial, or emergency services.",
    ],
  },
  {
    id: "eligibility",
    title: "2. Eligibility and authorised access",
    paragraphs: [
      "Public pages may be viewed by visitors. Restricted pages, account functions, and administrative tools are intended only for authorised 101st Doom Battalion members or staff with the correct permissions.",
      "You must not attempt to access accounts, personnel records, administrative features, Discord systems, Steam linking flows, attendance tools, or other restricted areas unless you are authorised to do so.",
    ],
  },
  {
    id: "accounts",
    title: "3. Account registration and security",
    paragraphs: [
      "Where an account is issued or created, you are responsible for keeping your login details secure and for actions taken through your account.",
      "You must provide accurate account and personnel information and must promptly tell authorised staff if your account, Discord account, Steam account, personnel record, or role information is incorrect or compromised.",
    ],
  },
  {
    id: "linking",
    title: "4. Discord and Steam account linking",
    paragraphs: [
      "Discord account information may be used to verify personnel records, send one-time verification codes, manage attendance interactions, and support role assignment for events.",
      "Steam linking is used to confirm ownership of a Steam ID through Steam OpenID and connect that Steam ID to the correct personnel record. You must only link your own Steam account and must not attempt to link another person's account or personnel record.",
    ],
  },
  {
    id: "verification-codes",
    title: "5. One-time Discord verification codes",
    paragraphs: [
      "Verification codes are intended only for the person receiving them through the Discord account already connected to the selected personnel record.",
      "You must not share, guess, reuse, intercept, or request codes for another person. Repeated failed attempts, abuse, or suspicious activity may be logged and may result in access being restricted.",
    ],
  },
  {
    id: "records",
    title: "6. Attendance, certifications, medals, and awards",
    paragraphs: [
      "Attendance records, certifications, medals, awards, XP, service records, and related statistics may be generated from website activity, Discord activity, game-server activity, or staff updates.",
      "These records may be corrected by authorised staff where errors are found. The website operator may remove, adjust, archive, or correct records to keep the system accurate and fair.",
    ],
  },
  {
    id: "acceptable-use",
    title: "7. Acceptable use",
    paragraphs: [
      "You must use the website in a lawful, respectful, and authorised way. You must not impersonate another person, provide false information, abuse verification systems, interfere with the service, upload malicious content, attempt unauthorised access, exploit vulnerabilities, scrape restricted information, or bypass access controls.",
      "If you discover a vulnerability or security issue, report it privately to authorised staff instead of exploiting it or sharing it publicly.",
    ],
  },
  {
    id: "suspension",
    title: "8. Account suspension, removal, and end of membership",
    paragraphs: [
      "Access may be suspended, restricted, corrected, or removed if you misuse the website, leave the community, lose the required role, breach these terms, or create a security or operational risk.",
      "When membership ends, active access may be removed while some historical service records, audit logs, attendance records, or administrative records may be retained for legitimate community purposes.",
    ],
  },
  {
    id: "availability",
    title: "9. Website availability",
    paragraphs: [
      "The website is provided on a reasonable-efforts basis. It may be unavailable, delayed, changed, or interrupted because of maintenance, hosting issues, database issues, Discord or Steam outages, security incidents, or other operational reasons.",
      "The website operator may change, remove, or disable features where needed to maintain security, reliability, or community administration.",
    ],
  },
  {
    id: "intellectual-property",
    title: "10. Intellectual property and submitted information",
    paragraphs: [
      "Website code, text, layouts, and community-created content may belong to their respective creators or the community. Third-party names, logos, game assets, service names, and trademarks remain the property of their respective owners.",
      "By submitting information to the website, you allow it to be used for the community and administrative purposes described in these terms and the Privacy Notice.",
    ],
  },
  {
    id: "third-parties",
    title: "11. Third-party services and affiliation disclaimer",
    paragraphs: [
      "The website may interact with third-party services including Discord, Steam or Valve, Supabase, hosting providers, Cloudflare where used, and email providers where configured.",
      "The 101st Doom Battalion website and community are not officially affiliated with, endorsed by, sponsored by, or operated by Discord, Valve, Steam, Bohemia Interactive, Disney, or Lucasfilm. No ownership is claimed over third-party trademarks, names, services, or intellectual property.",
    ],
  },
  {
    id: "liability",
    title: "12. Reasonable limitation of liability",
    paragraphs: [
      "The website is provided for community administration. To the fullest extent permitted by law, the website operator is not responsible for indirect loss, loss of data caused by third-party outages, loss of access to third-party services, or issues outside reasonable control.",
      "Nothing in these terms excludes liability where it cannot lawfully be excluded.",
    ],
  },
  {
    id: "changes-law-contact",
    title: "13. Changes, governing law, and contact",
    paragraphs: [
      "These terms may be updated as the website, community tools, or legal requirements change. The Last Updated date and version on this page show the current published version.",
      "These terms are governed by the law of England and Wales. Contact for questions about these terms: " + LEGAL_CONTACT_NAME + ".",
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Website Terms of Use"
      intro="These terms explain the rules for using the 101st Doom Battalion website, including accounts, personnel records, Discord verification, Steam linking, attendance, certifications, awards, and administrative systems."
      sections={termsSections}
    />
  );
}
