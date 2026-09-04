export type PagePermissionAccess = "none" | "read" | "edit" | "full";

export type PagePermissionDefinition = {
  key: string;
  pagePath: string;
  label: string;
  category: string;
  description: string;
  legacyRoles: string[];
};

export const pagePermissionLevels: PagePermissionAccess[] = [
  "none",
  "read",
  "edit",
  "full",
];

export const pagePermissionDefinitions: PagePermissionDefinition[] = [
  {
    key: "admin.create",
    pagePath: "/admin/create",
    label: "Create Accounts",
    category: "Personnel Admin",
    description: "Create new website and personnel records.",
    legacyRoles: ["admin", "recruiter"],
  },
  {
    key: "admin.positions",
    pagePath: "/admin/positions",
    label: "Ranks & Slots",
    category: "Personnel Admin",
    description: "Manage ranks, MOS, slots, and billet assignments.",
    legacyRoles: ["admin", "nco", "di"],
  },
  {
    key: "admin.certifications",
    pagePath: "/admin/certifications",
    label: "Certifications",
    category: "Personnel Admin",
    description: "Award and remove personnel certifications.",
    legacyRoles: ["admin", "nco", "trainer"],
  },
  {
    key: "admin.medals",
    pagePath: "/admin/medals",
    label: "Medals",
    category: "Personnel Admin",
    description: "Award and remove medals on personnel dossiers.",
    legacyRoles: ["akhari", "nco", "admin", "di", "recruiter"],
  },
  {
    key: "admin.weekly-attendance",
    pagePath: "/admin/weekly-attendance",
    label: "Weekly Attendance Admin",
    category: "Records",
    description: "Update weekly attendance records.",
    legacyRoles: ["admin", "nco"],
  },
  {
    key: "admin.discord-attendance",
    pagePath: "/admin/discord-attendance",
    label: "Discord Attendance",
    category: "Records",
    description: "Create and manage Discord attendance embeds.",
    legacyRoles: ["admin", "nco", "akhari"],
  },
  {
    key: "admin.removal",
    pagePath: "/admin/removal",
    label: "Remove / Retire",
    category: "Records",
    description: "Remove, retire, or archive personnel records.",
    legacyRoles: ["nco", "admin"],
  },
  {
    key: "admin.removal-log",
    pagePath: "/admin/removal-log",
    label: "Removal Log",
    category: "Records",
    description: "Review removal and retirement history.",
    legacyRoles: ["recruiter", "nco", "admin"],
  },
  {
    key: "admin.discord-announcements",
    pagePath: "/admin/discord-announcemets",
    label: "Discord Pings",
    category: "Systems",
    description: "Create scheduled Discord announcements and pings.",
    legacyRoles: ["admin", "akhari"],
  },
  {
    key: "admin.server-control",
    pagePath: "/admin/server-control",
    label: "Server Control",
    category: "Systems",
    description: "Start, stop, and monitor Arma servers.",
    legacyRoles: ["servermaintenance", "akhari"],
  },
  {
    key: "admin.permissions",
    pagePath: "/admin/permissions",
    label: "Permissions",
    category: "Systems",
    description: "Manage login accounts and page permissions.",
    legacyRoles: ["admin", "akhari"],
  },
  {
    key: "gc.asset-log",
    pagePath: "/GC-Asset-Log",
    label: "GC Asset Log",
    category: "Logistics",
    description: "Review campaign asset transaction history.",
    legacyRoles: ["akhari", "logistics"],
  },
  {
    key: "gc.logistics",
    pagePath: "/GC-Logi",
    label: "GC Logistics",
    category: "Logistics",
    description: "Manage campaign logistics and distribution.",
    legacyRoles: ["akhari", "logistics", "admin"],
  },
  {
    key: "cis.logistics",
    pagePath: "/CIS-Logi",
    label: "CIS Logistics",
    category: "Logistics",
    description: "Manage CIS commander assets and logistics actions.",
    legacyRoles: ["logistics", "akhari"],
  },
  {
    key: "personnel.command-dashboard",
    pagePath: "/pcs",
    label: "Personnel Command Dashboard",
    category: "Personnel",
    description: "Command overview and restricted personnel tools.",
    legacyRoles: ["admin", "nco", "di", "trainer", "recruiter", "akhari"],
  },
  {
    key: "operations.planops",
    pagePath: "/planops",
    label: "Plan Ops",
    category: "Operations",
    description: "Create and edit operational planning boards.",
    legacyRoles: ["admin", "logistics", "nco", "trainer"],
  },
];

