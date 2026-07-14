export const LEGAL_EFFECTIVE_DATE = "14 July 2026";
export const LEGAL_LAST_UPDATED = "14 July 2026";
export const LEGAL_VERSION = "1.0";
export const LEGAL_OPERATOR_NAME = "101st Doom Battalion";
export const LEGAL_CONTACT_NAME = "CX-O 72149 Akhari";

export const legalPages = [
  {
    title: "Privacy Notice",
    href: "/legal/privacy",
    shortLabel: "Privacy",
  },
  {
    title: "Website Terms of Use",
    href: "/legal/terms",
    shortLabel: "Terms",
  },
  {
    title: "Cookie Policy",
    href: "/legal/cookies",
    shortLabel: "Cookies",
  },
] as const;

export function getLegalContactHref() {
  return "/legal/privacy#contact";
}
