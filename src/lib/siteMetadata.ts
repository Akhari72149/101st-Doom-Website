import type { Metadata } from "next";

type RouteMetadata = {
  title: string;
  description: string;
};

export const siteRouteMetadata = {
  "/admin/certifications": { title: "Certification Management", description: "Assign certifications, manage certification leads, and review personnel qualification records." },
  "/admin/create": { title: "Personnel Intake", description: "Create and onboard new personnel records for the 101st Doom Battalion." },
  "/admin/discipline": { title: "Discipline Management", description: "Issue, review, approve, and appeal official warnings and disciplinary actions." },
  "/admin/discord-announcemets": { title: "Discord Announcements", description: "Create and schedule official Discord announcements and unit pings." },
  "/admin/discord-attendance": { title: "Discord Attendance", description: "Schedule and resend reaction-based Discord attendance messages." },
  "/admin/medals": { title: "Medal Management", description: "Award and manage medals recorded on personnel profiles." },
  "/admin/Mod-Taskboard": { title: "Mod Taskboard", description: "Manage the battalion mod-development pipeline and assigned work." },
  "/admin/permissions": { title: "Account Permissions", description: "Manage website accounts, access levels, presets, and display role tags." },
  "/admin/personnel-profiles": { title: "Personnel Administration", description: "Manage service dates, identity links, status, and personnel reactivation." },
  "/admin/positions": { title: "Ranks and Slots", description: "Manage personnel ranks and assigned positions across the unit structure." },
  "/admin/promotion-readiness": { title: "Promotion Readiness", description: "Review rank progression requirements, attendance, and promotion readiness." },
  "/admin/rank-corrections": { title: "Rank Corrections", description: "Correct personnel ranks while preserving their existing time in grade." },
  "/admin/ranks": { title: "Rank Management", description: "Create, edit, activate, and order the battalion rank structure." },
  "/admin/removal": { title: "Remove or Retire Personnel", description: "Retire, remove, or transfer personnel from active service." },
  "/admin/removal-log": { title: "Removal Log", description: "Review recorded personnel retirements, removals, and transfers." },
  "/admin/server-control": { title: "Server Control", description: "Access authorised game-server maintenance and control actions." },
  "/admin/system-health": { title: "System Health", description: "Monitor website services, database health, integrations, and Discord outbox activity." },
  "/admin/Taskboard": { title: "Website Taskboard", description: "Manage website development tasks, priorities, and progress." },
  "/admin/updater": { title: "Website Updater", description: "Review available releases and manage controlled website deployments." },
  "/admin/weekly-attendance": { title: "Weekly Attendance", description: "Review and manage weekly operation attendance records." },
  "/admin/xp": { title: "XP Administration", description: "Review and administer Arma XP records and progression events." },
  "/Art-of-War": { title: "Art of War", description: "Review the battalion's operational doctrine and combat guidance." },
  "/audit": { title: "Public Audit Log", description: "Review recorded website, account, and personnel changes across the battalion." },
  "/certifications": { title: "Certification Lookup", description: "Search personnel qualifications and certification records." },
  "/certs": { title: "Training and Qualifications", description: "Explore the training, qualifications, and specialist opportunities offered by the battalion." },
  "/change-password": { title: "Change Password", description: "Securely update your 101st Doom Battalion website password." },
  "/CIS-Logi": { title: "CIS Logistics", description: "Manage CIS campaign assets, inventory, and logistics activity." },
  "/documents": { title: "Documents and Forms", description: "Access official battalion documents, policies, forms, and reference material." },
  "/faq": { title: "Frequently Asked Questions", description: "Find answers to common questions about joining and serving in the battalion." },
  "/Galactic-Campaign": { title: "Galactic Campaign", description: "Follow the battalion's ongoing Galactic Campaign and operational progress." },
  "/Galactic-Campaign/operation-last-stand": { title: "Operation Last Stand", description: "View the live status and progress of the Operation Last Stand campaign." },
  "/GC-Asset-Log": { title: "Campaign Asset Log", description: "Review Galactic Campaign asset purchases and inventory activity." },
  "/GC-Logi": { title: "Galactic Campaign Logistics", description: "Manage campaign resources, purchases, and asset distribution." },
  "/GC-Platoon-Logi": { title: "Platoon Logistics", description: "Manage platoon campaign assets and assigned logistics resources." },
  "/grand-orbat": { title: "Grand ORBAT", description: "Explore the full organisational structure of the 101st Doom Battalion." },
  "/Join": { title: "Join the 101st", description: "Learn how to join the 101st Doom Battalion and begin recruit training." },
  "/legal/cookies": { title: "Cookie Notice", description: "Review how the 101st Doom Battalion website uses essential cookies and local storage." },
  "/legal/privacy": { title: "Privacy Notice", description: "Review how the 101st Doom Battalion website handles personnel, account, attendance, and integration data." },
  "/legal/terms": { title: "Terms of Use", description: "Review the terms governing use of the 101st Doom Battalion website and its member services." },
  "/login": { title: "Account Login", description: "Sign in to access your 101st Doom Battalion account and authorised tools." },
  "/member-link": { title: "Link Personnel Profile", description: "Connect your website account to your Discord and personnel record." },
  "/model-customiser": { title: "Model Customiser", description: "Create controlled armour and vehicle customisation references with approved paint and insignia." },
  "/News": { title: "Battalion News", description: "Read the latest updates and announcements from the 101st Doom Battalion." },
  "/personnel-profile": { title: "Personnel Profile", description: "Review service details, qualifications, awards, attendance, and linked identities." },
  "/planops": { title: "Plan Operations", description: "Create and manage operational planning boards for upcoming missions." },
  "/Randomiser": { title: "Operation Randomiser", description: "Generate randomised operation concepts, objectives, and mission parameters." },
  "/rank-structure": { title: "Rank Structure", description: "Explore battalion and MOS rank progression routes, insignia, and promotion requirements." },
  "/roster": { title: "Slotted Roster", description: "View active personnel and their assigned positions across the battalion." },
  "/servers": { title: "Server Booking", description: "View availability and reserve battalion servers for training or operations." },
  "/Tags": { title: "Personnel Tag Lookup", description: "Search active personnel by specialist, qualification, and status tags." },
  "/Task-Viewer": { title: "Task Viewer", description: "Review published website tasks and development progress." },
  "/vault": { title: "Document Vault", description: "Access authorised battalion files and protected reference material." },
  "/weekly-attendance": { title: "Attendance Records", description: "Review weekly main-operation attendance across the battalion." },
  "/Who-We-Are": { title: "Who We Are", description: "Meet the 101st Doom Battalion and learn about our community and mission." },
  "/Workbench": { title: "Workbench", description: "Access practical battalion tools and operational utilities." },
} satisfies Record<string, RouteMetadata>;

export type SiteMetadataRoute = keyof typeof siteRouteMetadata;

export function metadataFor(path: SiteMetadataRoute): Metadata {
  const entry = siteRouteMetadata[path];
  const fullTitle = `${entry.title} | 101st Doom Battalion`;
  return {
    title: entry.title,
    description: entry.description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: "101st Doom Battalion",
      title: fullTitle,
      description: entry.description,
      url: path,
      images: [{ url: "/icons/DBLogo.jpg", alt: "101st Doom Battalion emblem" }],
    },
    twitter: {
      card: "summary",
      title: fullTitle,
      description: entry.description,
      images: ["/icons/DBLogo.jpg"],
    },
  };
}
