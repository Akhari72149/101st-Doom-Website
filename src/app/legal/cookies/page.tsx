import type { Metadata } from "next";
import LegalPage, { LegalSection } from "@/components/legal/LegalPage";
import { LEGAL_CONTACT_NAME } from "@/config/legal";

export const metadata: Metadata = {
  title: "Cookie Policy | 101st Doom Battalion",
  description:
    "Cookie Policy for the 101st Doom Battalion website, covering authentication, Steam linking, security, preference storage, analytics, and third-party storage.",
};

const cookieSections: LegalSection[] = [
  {
    id: "overview",
    title: "1. Overview",
    paragraphs: [
      "This Cookie Policy explains how the 101st Doom Battalion website uses cookies and similar browser storage technologies.",
      "Only essential authentication and session storage, including Supabase authentication storage and a short-lived Steam linking cookie are used on this website. No non-essential analytics or advertising trackers are in use.",
    ],
  },
  {
    id: "strictly-necessary",
    title: "2. Strictly necessary storage",
    paragraphs: [
      "Strictly necessary storage is used to keep the website secure, maintain login sessions, protect restricted areas, and support account-linking flows.",
      "This includes Supabase authentication storage used by the website login system and the short-lived HTTP-only Steam linking session cookie used during Steam account linking.",
    ],
  },
  {
    id: "supabase",
    title: "3. Supabase authentication storage",
    paragraphs: [
      "The website uses Supabase for authentication. Supabase client authentication may store session information in browser storage so that logged-in users can remain signed in and the website can check access to protected pages.",
      "This storage is necessary for account login, role checks, and authenticated website features.",
    ],
  },
  {
    id: "steam",
    title: "4. Steam linking cookie",
    paragraphs: [
      "The Steam linking flow uses a short-lived HTTP-only cookie. It helps match the browser session that began Steam authentication with the Steam callback returned by Steam.",
      "This cookie is used only for the Steam linking process, is not available to client-side JavaScript, and is configured with SameSite protection.",
    ],
  },
  {
    id: "security",
    title: "5. Security cookies and provider storage",
    paragraphs: [
      "Hosting, security, or proxy providers may use technical storage or security cookies where necessary to deliver the website, prevent abuse, route traffic, or protect against attacks.",
      "Cloudflare may set strictly necessary security cookies or process request data as part of its security and performance services.",
    ],
  },
  {
    id: "preferences",
    title: "6. Preference storage",
    paragraphs: [
      "The current repository review did not find a dedicated non-essential preference storage system such as theme preferences or optional tracking preferences.",
      "If preference storage is added later, this policy will be updated to describe what is stored and how users can change it.",
    ],
  },
  {
    id: "analytics",
    title: "7. Analytics storage",
    paragraphs: [
      "No Google Analytics, Plausible, PostHog, advertising tracker, or similar optional analytics script was in use at the time of making this policy.",
      ],
  },
  {
    id: "third-parties",
    title: "8. Third-party storage and embedded content",
    paragraphs: [
      "The website links to or interacts with third-party services such as Discord and Steam. Those services may set their own cookies or use their own storage when you visit their websites or interact with their systems.",
      "The website may display external images or profile information, such as Steam profile avatars or Discord emoji images, which can involve requests to third-party servers.",
    ],
  },
  {
    id: "controls",
    title: "9. Managing cookies and storage",
    paragraphs: [
      "You can control cookies and browser storage through your browser settings. Blocking strictly necessary cookies or authentication storage may prevent login, Steam linking, or protected website features from working.",
      "To clear a website login session, use the website logout feature where available and, if needed, clear site data in your browser.",
    ],
  },
  {
    id: "changes-contact",
    title: "10. Changes and contact",
    paragraphs: [
      "This policy may be updated if the website adds new storage, analytics, monitoring, embedded content, or third-party integrations.",
      "Questions about this policy can be sent to: " + LEGAL_CONTACT_NAME + ".",
    ],
  },
];

export default function CookiesPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Cookie Policy"
      intro="This policy explains the cookies and browser storage used by the 101st Doom Battalion website, including essential login storage, Steam linking cookies, and third-party service storage."
      sections={cookieSections}
    />
  );
}
