import type { Metadata } from "next";
import LegalPage, { LegalSection } from "@/components/legal/LegalPage";
import { LEGAL_CONTACT_NAME } from "@/config/legal";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description:
    "Cookie Policy for the 101st Doom Battalion website, covering native authentication, Steam linking, restricted tools, security, and browser storage.",
};

const cookieSections: LegalSection[] = [
  {
    id: "overview",
    title: "1. Overview",
    paragraphs: [
      "This Cookie Policy explains how the 101st Doom Battalion website uses cookies and similar browser-storage technologies.",
      "The current site uses storage only for strictly necessary security or functionality requested by the user. It does not use advertising or behavioural tracking cookies, so it does not currently display a marketing-cookie consent banner.",
    ],
  },
  {
    id: "authentication",
    title: "2. Native website authentication",
    paragraphs: [
      "The website uses its own account and session system backed by the self-hosted PostgreSQL database. Cookies beginning with doom_native keep signed-in users authenticated and allow permission checks on protected pages.",
      "Normal login sessions last up to eight hours unless the user signs out or the session is revoked earlier. These cookies are required for account access and protected administration features.",
    ],
  },
  {
    id: "steam",
    title: "3. Steam linking cookie",
    paragraphs: [
      "The Steam linking flow uses the short-lived, HTTP-only doom_steam_link_session cookie to match the browser session that began Steam authentication with the callback returned by Steam.",
      "It is used only for the requested linking process, is unavailable to client-side JavaScript, uses SameSite protection, and expires after 30 minutes.",
    ],
  },
  {
    id: "restricted-tools",
    title: "4. Restricted tool access",
    paragraphs: [
      "The HTTP-only gc_shop_access cookie remembers successful access to the protected GC Shop tool for up to eight hours. It uses strict SameSite protection and is not used for tracking.",
    ],
  },
  {
    id: "browser-storage",
    title: "5. Browser storage",
    paragraphs: [
      "The attendance-admin-formation value remembers an administrator's selected attendance formation on that browser until it is changed or site data is cleared.",
      "Temporary per-tab updater values prevent duplicate deployment notices and allow the page to resume correctly after an update. These interface values do not contain passwords or authentication tokens.",
    ],
  },
  {
    id: "security",
    title: "6. Security and infrastructure storage",
    paragraphs: [
      "Hosting, security, or proxy providers may use technical storage where necessary to deliver the website, prevent abuse, route traffic, or protect against attacks.",
      "Cloudflare may set strictly necessary security cookies or process request data as part of its security and performance services when enabled.",
    ],
  },
  {
    id: "analytics",
    title: "7. Analytics and advertising",
    paragraphs: [
      "No Google Analytics, Plausible, PostHog, advertising tracker, or similar optional analytics script was in use when this policy was updated.",
    ],
  },
  {
    id: "third-parties",
    title: "8. Third-party services",
    paragraphs: [
      "The website links to or interacts with services such as Discord, Steam, GitHub, and Cloudflare. Those services may set their own cookies or storage when you visit or use their systems.",
      "External profile images or Discord emoji images may also cause the browser to request content from a third-party server.",
    ],
  },
  {
    id: "controls",
    title: "9. Managing cookies and storage",
    paragraphs: [
      "You can delete or block cookies and browser storage through your browser settings. Blocking necessary cookies will prevent login, Steam linking, restricted tools, or protected website features from working correctly.",
      "Clearing site data also removes saved interface preferences. If optional analytics, advertising, or other non-essential storage is introduced, the site will add an appropriate consent choice before using it.",
    ],
  },
  {
    id: "changes-contact",
    title: "10. Changes and contact",
    paragraphs: [
      "This policy may be updated if the website adds new storage, analytics, monitoring, embedded content, or integrations.",
      `Questions about this policy can be sent to ${LEGAL_CONTACT_NAME} through the official unit communication channels.`,
    ],
  },
];

export default function CookiesPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Cookie Policy"
      intro="This policy explains the cookies and limited browser storage used by the 101st Doom Battalion website for native login, linked services, security, and requested functionality."
      sections={cookieSections}
    />
  );
}
