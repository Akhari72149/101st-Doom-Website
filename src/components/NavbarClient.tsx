"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAppSession, signOutOfApp, type AppUser } from "@/lib/client-auth";
import { pagePermissionDefinitions } from "@/data/pagePermissions";
import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Cog,
  FileText,
  Hammer,
  Home,
  Menu,
  Newspaper,
  Shield,
  User,
  Users,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";

/* ================= TYPES ================= */

type Role =
  | "admin"
  | "nco"
  | "di"
  | "trainer"
  | "logistics"
  | "recruiter"
  | "ServerMaintenance"
  | "Akhari";

type NavItem = {
  href: string;
  label: string;
  description?: string;
  allowedRoles?: Role[];
  category?: string;
};

type NavGroup = {
  label: string;
  icon: LucideIcon;
  description: string;
  allowedRoles?: Role[];
  columns?: 1 | 2;
  items: NavItem[];
};

export default function NavbarClient() {
  const router = useRouter();

  const [user, setUser] = useState<AppUser | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<Record<string, string>>({});
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openMobileGroup, setOpenMobileGroup] = useState<string | null>(null);

  /* ================= AUTH ================= */

  useEffect(() => {
    const getUser = async () => {
      const session = await getAppSession();
      setUser(session?.user || null);
      setRoles(session?.roles || []);
      setPermissions(session?.permissions || {});
    };

    getUser();
  }, []);

  const handleLogout = async () => {
    await signOutOfApp();
    setUser(null);
    router.push("/login");
  };

  /* ================= NAV GROUPS ================= */

  const navGroups = useMemo<NavGroup[]>(() => [
    {
      label: "Public",
      icon: BookOpen,
      description: "Information for visitors and new members",
      columns: 1,
      items: [
        {
          href: "/Who-We-Are",
          label: "Who We Are",
          description: "Learn about the battalion and its purpose",
        },
        {
          href: "/Join",
          label: "How to Join",
          description: "Recruitment steps and entry guidance",
        },
        {
          href: "/certs",
          label: "What We Offer",
          description: "Training, qualifications and opportunities",
        },
        {
          href: "/documents",
          label: "Documents & Forms",
          description: "Important files, policies and paperwork",
        },
        {
          href: "/faq",
          label: "FAQ",
          description: "Common questions and quick answers",
        },
      ],
    },
    {
      label: "Personnel",
      icon: Users,
      description: "Member records, structure and lookups",
      columns: 2,
      items: [
        {
          href: "/personnel-profile",
          label: "Personnel Profile",
          description: "View your personnel record and details",
        },
        {
          href: "/pcs",
          label: "Personnel Command Dashboard",
          description: "Command and personnel overview tools",
        },
        {
          href: "/roster",
          label: "Slotted Roster",
          description: "View assigned positions across the unit",
        },
        {
          href: "/grand-orbat",
          label: "Grand ORBAT",
          description: "Unit structure and force organisation",
        },
        {
          href: "/certifications",
          label: "Certification Lookup",
          description: "Search qualifications by person or cert",
        },
        {
          href: "/Tags",
          label: "Tag Lookup",
          description: "Search personnel by role or status tags",
        },
        {
          href: "/audit",
          label: "Audit Log",
          description: "Review logged system and personnel actions",
          allowedRoles: ["admin", "nco", "trainer", "di"],
        },
      ],
    },
    {
      label: "Operations",
      icon: CalendarDays,
      description: "Bookings, events and operational support",
      columns: 1,
      items: [
        {
          href: "/servers",
          label: "Server Booking",
          description: "Reserve and manage training or event time",
        },
        {
          href: "/Galactic-Campaign/operation-last-stand",
          label: "Operation Last Stand",
          description: "Live Altis survival campaign progress",
        },
        {
          href: "/Art-of-War",
          label: "Art of War",
          description: "Operational archive and doctrine reference",
        },
        {
          href: "/weekly-attendance",
          label: "Weekly Attendance",
          description: "Weekly Mainop Attendance Tracking",
        },
      ],
    },
    {
      label: "Campaign",
      icon: Newspaper,
      description: "Galactic Campaign pages and tools",
      columns: 2,
      items: [
        {
          href: "/Galactic-Campaign",
          label: "GC Dashboard",
          description: "Campaign overview and current progress",
        },
        {
          href: "/News",
          label: "Galactic Weekly",
          description: "Campaign news and narrative updates",
        },
        {
          href: "/GC-Platoon-Logi",
          label: "GC Platoon Logistics",
          description: "Platoon assets, tokens and campaign support",
        },
        {
          href: "/Randomiser",
          label: "Side Operation Signup",
          description: "Manage signups and side-op randomisation",
        },
      ],
    },
    {
      label: "Tools",
      icon: Wrench,
      description: "Specialist utilities and internal tools",
      columns: 1,
      items: [
        {
          href: "/Workbench",
          label: "Animation Workbench",
          description: "Workbench and development utility page",
        },
        {
          href: "/admin/Taskboard",
          label: "TaskBoard",
          description: "Track tasks, work items and progress",
          allowedRoles: ["admin", "Akhari"],
        },
      ],
    },
    {
      label: "Admin",
      icon: Shield,
      description: "Management, logistics and control panels",
      allowedRoles: [
        "admin",
        "nco",
        "di",
        "trainer",
        "recruiter",
        "logistics",
        "Akhari",
        "ServerMaintenance",
      ],
      columns: 2,
      items: [
        {
          href: "/admin/create",
          label: "Create Accounts",
          description: "Create new user and personnel accounts",
          allowedRoles: ["admin", "recruiter"],
          category: "Personnel Admin",
        },
        {
          href: "/admin/discord-announcemets",
          label: "Discord Pings",
          description: "Create bot announcements and pings",
          allowedRoles: ["admin", "Akhari"],
          category: "Systems",
        },
        {
          href: "/admin/positions",
          label: "Ranks & Slots",
          description: "Manage rank progressions and assignments",
          allowedRoles: ["admin", "nco", "di"],
          category: "Personnel Admin",
        },
        {
          href: "/admin/certifications",
          label: "Certifications",
          description: "Award and manage certifications",
          allowedRoles: ["admin", "nco", "trainer"],
          category: "Personnel Admin",
        },
        {
          href: "/admin/weekly-attendance",
          label: "Attendance",
          description: "Manage weekly attendance records",
          allowedRoles: ["admin", "nco"],
          category: "Records",
        },
        {
          href: "/admin/discord-attendance",
          label: "Discord Attendance",
          description: "Schedule reaction-based Discord attendance embeds",
          allowedRoles: ["admin", "nco", "Akhari"],
          category: "Records",
        },
        {
          href: "/admin/medals",
          label: "Medals",
          description: "Award medals shown on personnel profiles",
          allowedRoles: ["Akhari", "nco", "admin"],
          category: "Personnel Admin",
        },
        {
          href: "/admin/removal",
          label: "Remove / Retire",
          description: "Remove or retire personnel records",
          allowedRoles: ["nco", "admin"],
          category: "Records",
        },
        {
          href: "/admin/removal-log",
          label: "Removal Log",
          description: "Review account and personnel removals",
          allowedRoles: ["recruiter", "nco", "admin"],
          category: "Records",
        },
        {
          href: "/GC-Asset-Log",
          label: "Asset Log",
          description: "Track campaign asset purchases",
          allowedRoles: ["Akhari", "logistics"],
          category: "Logistics",
        },
        {
          href: "/GC-Logi",
          label: "GC Logistics",
          description: "Campaign logistics and distribution tools",
          allowedRoles: ["Akhari", "logistics", "admin"],
          category: "Logistics",
        },
        {
          href: "/CIS-Logi",
          label: "CIS Logistics",
          description: "Manage CIS logistics actions and inventory",
          allowedRoles: ["logistics", "Akhari"],
          category: "Logistics",
        },
        {
          href: "/admin/server-control",
          label: "Server Control",
          description: "Server maintenance and control access",
          allowedRoles: ["ServerMaintenance", "Akhari"],
          category: "Systems",
        },
        {
          href: "/admin/permissions",
          label: "Permissions",
          description: "Manage accounts and page access",
          allowedRoles: ["admin", "Akhari"],
          category: "Systems",
        },
      ],
    },
  ], []);

  /* ================= ROLE FILTER ================= */

  const filteredGroups = useMemo(() => {
    const normalizedRoles = new Set(roles.map((role) => role.toLowerCase()));
    const permissionByPath = new Map(pagePermissionDefinitions.map((entry) => [entry.pagePath, entry.key]));
    const canSeeItem = (item: NavItem) => {
      const permissionKey = permissionByPath.get(item.href);
      if (permissionKey && permissions[permissionKey]) return true;
      return !item.allowedRoles || item.allowedRoles.some((role) => normalizedRoles.has(role.toLowerCase()));
    };
    return navGroups
      .map((group) => ({
        ...group,
        items: group.items.filter(canSeeItem),
      }))
      .filter((group) => group.items.length > 0);
  }, [navGroups, permissions, roles]);

  const getItemIcon = (groupLabel: string) => {
    if (groupLabel === "Public") return <FileText size={14} />;
    if (groupLabel === "Personnel") return <User size={14} />;
    if (groupLabel === "Operations") return <ClipboardList size={14} />;
    if (groupLabel === "Campaign") return <Newspaper size={14} />;
    if (groupLabel === "Tools") return <Hammer size={14} />;
    if (groupLabel === "Admin") return <Cog size={14} />;
    return <FileText size={14} />;
  };

  const adminSections = ["Personnel Admin", "Records", "Logistics", "Systems"];

  const getAdminSections = (items: NavItem[]) =>
    adminSections
      .map((section) => ({
        section,
        items: items.filter((item) => item.category === section),
      }))
      .filter((section) => section.items.length > 0);

  return (
    <nav className="relative z-50 w-full border-b border-[#00ff66]/15 bg-black/70 shadow-[0_10px_40px_rgba(0,255,102,0.06)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1800px] items-center justify-between gap-3 px-4 py-4 sm:px-6 xl:gap-6">
        {/* ================= LEFT ================= */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            onClick={() => {
              setOpenMobileGroup(null);
              setMobileMenuOpen(false);
            }}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-[#00ff66]/20 bg-[#00ff66]/5 px-3 py-2 text-[#00ff66] transition hover:border-[#00ff66]/40 hover:bg-[#00ff66]/10 sm:px-4"
          >
            <Home size={16} />
            <span className="text-sm font-medium uppercase tracking-[0.18em]">
              Home
            </span>
          </Link>
        </div>

        {/* ================= CENTER NAV ================= */}
        <div className="hidden items-center gap-3 xl:flex">
          {filteredGroups.map((group) => {
            const Icon = group.icon;
            const isOpen = openDropdown === group.label;

            return (
              <div
                key={group.label}
                className="relative"
                onMouseEnter={() => setOpenDropdown(group.label)}
                onMouseLeave={() => setOpenDropdown(null)}
              >
                <button
                  type="button"
                  onClick={() =>
                    setOpenDropdown((prev) =>
                      prev === group.label ? null : group.label
                    )
                  }
                  className="flex items-center gap-2 rounded-xl border border-transparent px-4 py-2 text-[#00ff66] transition hover:border-[#00ff66]/20 hover:bg-[#00ff66]/8"
                >
                  <Icon size={16} />
                  <span className="text-sm font-medium uppercase tracking-[0.12em]">
                    {group.label}
                  </span>
                  <ChevronDown
                    size={15}
                    className={`transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                <div
                  className={`absolute left-0 top-full pt-3 transition-all duration-200 ${
                    isOpen
                      ? "visible translate-y-0 opacity-100"
                      : "invisible -translate-y-1 opacity-0"
                  }`}
                >
                  <div
                    className={`rounded-2xl border border-[#00ff66]/20 bg-black/95 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl ${
                      group.columns === 2 ? "w-[700px]" : "w-[360px]"
                    }`}
                  >
                    <div className="mb-4 border-b border-[#00ff66]/10 pb-3">
                      <div className="flex items-center gap-2 text-[#00ff66]">
                        <Icon size={16} />
                        <span className="text-sm font-semibold uppercase tracking-[0.16em]">
                          {group.label}
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-gray-400">
                        {group.description}
                      </p>
                    </div>

                    {group.label === "Admin" ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        {getAdminSections(group.items).map((section) => (
                          <div key={section.section}>
                            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#00ff66]/55">
                              {section.section}
                            </div>
                            <div className="space-y-2">
                              {section.items.map((item) => (
                                <Link
                                  key={item.href}
                                  href={item.href}
                                  onClick={() => setOpenDropdown(null)}
                                  className="group/item block rounded-xl border border-transparent bg-white/[0.015] p-3 transition hover:border-[#00ff66]/15 hover:bg-[#00ff66]/8"
                                >
                                  <div className="flex items-start gap-3">
                                    <div className="mt-0.5 rounded-lg border border-[#00ff66]/15 bg-[#00ff66]/8 p-2 text-[#00ff66]">
                                      {getItemIcon(group.label)}
                                    </div>

                                    <div className="min-w-0">
                                      <div className="text-sm font-medium text-white transition group-hover/item:text-[#00ff66]">
                                        {item.label}
                                      </div>
                                      {item.description && (
                                        <div className="mt-1 line-clamp-2 text-xs leading-5 text-gray-400">
                                          {item.description}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </Link>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div
                        className={`grid gap-2 ${
                          group.columns === 2 ? "grid-cols-2" : "grid-cols-1"
                        }`}
                      >
                        {group.items.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setOpenDropdown(null)}
                            className="group/item rounded-xl border border-transparent bg-white/[0.015] p-3 transition hover:border-[#00ff66]/15 hover:bg-[#00ff66]/8"
                          >
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 rounded-lg border border-[#00ff66]/15 bg-[#00ff66]/8 p-2 text-[#00ff66]">
                                {getItemIcon(group.label)}
                              </div>

                              <div className="min-w-0">
                                <div className="text-sm font-medium text-white transition group-hover/item:text-[#00ff66]">
                                  {item.label}
                                </div>
                                {item.description && (
                                  <div className="mt-1 text-xs leading-5 text-gray-400">
                                    {item.description}
                                  </div>
                                )}
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ================= RIGHT ================= */}
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            type="button"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
            aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"}
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="grid min-h-11 min-w-11 place-items-center rounded-xl border border-[#00ff66]/30 bg-[#00ff66]/5 text-[#00ff66] transition hover:bg-[#00ff66]/10 xl:hidden"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          {user ? (
            <>
              <div className="hidden text-right md:block">
                <div className="text-sm text-gray-300">
                  {user.displayName || user.username || user.email}
                </div>

                {roles.length > 0 && (
                  <div className="mt-1 flex flex-wrap justify-end gap-1">
                    {roles.map((role) => (
                      <span
                        key={role}
                        className="rounded-full border border-[#00ff66]/20 bg-[#00ff66]/8 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[#00ff66]"
                      >
                        {role}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={handleLogout}
                className="rounded-xl border border-red-500/60 px-3 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500/10 sm:px-4"
              >
                Logout
              </button>
            </>
          ) : (
            <Link
              href="/login"
              onClick={() => setOpenMobileGroup(null)}
              className="rounded-xl border border-[#00ff66]/40 bg-[#00ff66]/5 px-4 py-2 text-sm font-medium text-[#00ff66] transition hover:bg-[#00ff66]/10"
            >
              Login
            </Link>
          )}
        </div>
      </div>

      {/* ================= MOBILE NAV ================= */}
      <div
        id="mobile-navigation"
        className={`border-t border-[#00ff66]/10 px-4 py-3 xl:hidden ${
          mobileMenuOpen ? "block" : "hidden"
        }`}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
            Navigation
          </span>
          <span className="text-[10px] uppercase tracking-[0.16em] text-[#00ff66]/70">
            {filteredGroups.length} Sections
          </span>
        </div>

        <div className="space-y-2">
          {filteredGroups.map((group) => {
            const Icon = group.icon;
            const isOpen = openMobileGroup === group.label;

            return (
              <div
                key={group.label}
                className="overflow-hidden rounded-xl border border-[#00ff66]/15 bg-black/60"
              >
                <button
                  type="button"
                  onClick={() =>
                    setOpenMobileGroup((prev) =>
                      prev === group.label ? null : group.label
                    )
                  }
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-[#00ff66] transition hover:bg-[#00ff66]/5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="rounded-lg border border-[#00ff66]/15 bg-[#00ff66]/8 p-2">
                      <Icon size={16} />
                    </div>

                    <div className="min-w-0">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em]">
                        {group.label}
                      </div>
                      <div className="mt-1 line-clamp-1 text-[11px] normal-case tracking-normal text-gray-400">
                        {group.description}
                      </div>
                    </div>
                  </div>

                  <ChevronDown
                    size={16}
                    className={`shrink-0 transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="space-y-2 border-t border-[#00ff66]/10 p-3">
                    {group.label === "Admin"
                      ? getAdminSections(group.items).map((section) => (
                          <div key={section.section}>
                            <div className="px-1 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#00ff66]/55">
                              {section.section}
                            </div>
                            <div className="space-y-2">
                              {section.items.map((item) => (
                                <Link
                                  key={item.href}
                                  href={item.href}
                                  onClick={() => {
                                    setOpenMobileGroup(null);
                                    setMobileMenuOpen(false);
                                  }}
                                  className="group/mobile block rounded-lg border border-[#00ff66]/10 bg-[#00ff66]/5 p-3 transition hover:border-[#00ff66]/25 hover:bg-[#00ff66]/10"
                                >
                                  <div className="flex items-start gap-3">
                                    <div className="mt-0.5 rounded-lg border border-[#00ff66]/15 bg-black/40 p-2 text-[#00ff66]">
                                      {getItemIcon(group.label)}
                                    </div>

                                    <div className="min-w-0">
                                      <div className="text-sm font-medium text-white transition group-hover/mobile:text-[#00ff66]">
                                        {item.label}
                                      </div>

                                      {item.description && (
                                        <div className="mt-1 text-xs leading-5 text-gray-400 sm:block">
                                          {item.description}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </Link>
                              ))}
                            </div>
                          </div>
                        ))
                      : group.items.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => {
                              setOpenMobileGroup(null);
                              setMobileMenuOpen(false);
                            }}
                            className="group/mobile block rounded-lg border border-[#00ff66]/10 bg-[#00ff66]/5 p-3 transition hover:border-[#00ff66]/25 hover:bg-[#00ff66]/10"
                          >
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 rounded-lg border border-[#00ff66]/15 bg-black/40 p-2 text-[#00ff66]">
                                {getItemIcon(group.label)}
                              </div>

                              <div className="min-w-0">
                                <div className="text-sm font-medium text-white transition group-hover/mobile:text-[#00ff66]">
                                  {item.label}
                                </div>

                                {item.description && (
                                  <div className="mt-1 text-xs leading-5 text-gray-400 sm:block">
                                    {item.description}
                                  </div>
                                )}
                              </div>
                            </div>
                          </Link>
                        ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
