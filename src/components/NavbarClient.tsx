"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Cog,
  FileText,
  FolderKanban,
  Hammer,
  Home,
  Newspaper,
  Shield,
  User,
  Users,
  Wrench,
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
};

type NavGroup = {
  label: string;
  icon: any;
  description: string;
  allowedRoles?: Role[];
  columns?: 1 | 2;
  items: NavItem[];
};

export default function NavbarClient() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  /* ================= AUTH ================= */

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUser(user);

      if (user) {
        const { data } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        setRoles(data?.map((r) => r.role) || []);
      }
    };

    getUser();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    router.push("/login");
  };

  /* ================= NAV GROUPS ================= */

  const navGroups: NavGroup[] = [
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
          href: "/Art-of-War",
          label: "Art of War",
          description: "Operational archive and doctrine reference",
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
          label: "Account Creation",
          description: "Create new user and personnel accounts",
          allowedRoles: ["admin", "recruiter"],
        },
        {
          href: "/admin/discord-announcemets",
          label: "Discord announcemets Control Page",
          description: "Manage & create pings for the bot to send out.",
          allowedRoles: ["admin", "Akhari"],
        },
        {
          href: "/admin/positions",
          label: "Promotions & Slotting",
          description: "Manage rank progressions and assignments",
          allowedRoles: ["admin", "nco", "di"],
        },
        {
          href: "/admin/certifications",
          label: "Certification Management",
          description: "Award and manage certifications",
          allowedRoles: ["admin", "nco", "trainer"],
        },
        {
          href: "/admin/removal",
          label: "Account Removal",
          description: "Remove or retire personnel records",
          allowedRoles: ["nco", "admin"],
        },
        {
          href: "/admin/removal-log",
          label: "Removal Log",
          description: "Review account and personnel removals",
          allowedRoles: ["recruiter", "nco", "admin"],
        },
        {
          href: "/GC-Asset-Log",
          label: "Asset Purchase Log",
          description: "Track campaign asset purchases",
          allowedRoles: ["Akhari", "logistics"],
        },
        {
          href: "/GC-Logi",
          label: "GC Logistics",
          description: "Campaign logistics and distribution tools",
          allowedRoles: ["Akhari", "logistics", "admin"],
        },
        {
          href: "/CIS-Logi",
          label: "CIS Logistics",
          description: "Manage CIS logistics actions and inventory",
          allowedRoles: ["logistics", "Akhari"],
        },
        {
          href: "/admin/server-control",
          label: "Server Control Panel",
          description: "Server maintenance and control access",
          allowedRoles: ["ServerMaintenance", "Akhari"],
        },
      ],
    },
  ];

  /* ================= ROLE FILTER ================= */

  const filteredGroups = useMemo(() => {
    return navGroups
      .filter(
        (group) =>
          !group.allowedRoles ||
          group.allowedRoles.some((role) => roles.includes(role))
      )
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            !item.allowedRoles ||
            item.allowedRoles.some((role) => roles.includes(role))
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [roles]);

  return (
    <nav className="relative z-50 w-full border-b border-[#00ff66]/15 bg-black/70 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,255,102,0.06)]">
      <div className="mx-auto flex w-full max-w-[1800px] items-center justify-between gap-6 px-6 py-4">
        {/* ================= LEFT ================= */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-xl border border-[#00ff66]/20 bg-[#00ff66]/5 px-4 py-2 text-[#00ff66] transition hover:border-[#00ff66]/40 hover:bg-[#00ff66]/10"
          >
            <Home size={16} />
            <span className="text-sm font-medium tracking-[0.18em] uppercase">
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
                  <span className="text-sm font-medium tracking-[0.12em] uppercase">
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
                      group.columns === 2
                        ? "w-[700px]"
                        : "w-[360px]"
                    }`}
                  >
                    <div className="mb-4 border-b border-[#00ff66]/10 pb-3">
                      <div className="flex items-center gap-2 text-[#00ff66]">
                        <Icon size={16} />
                        <span className="text-sm font-semibold tracking-[0.16em] uppercase">
                          {group.label}
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-gray-400">
                        {group.description}
                      </p>
                    </div>

                    <div
                      className={`grid gap-2 ${
                        group.columns === 2 ? "grid-cols-2" : "grid-cols-1"
                      }`}
                    >
                      {group.items.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="group/item rounded-xl border border-transparent bg-white/[0.015] p-3 transition hover:border-[#00ff66]/15 hover:bg-[#00ff66]/8"
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 rounded-lg border border-[#00ff66]/15 bg-[#00ff66]/8 p-2 text-[#00ff66]">
                              {group.label === "Public" && <FileText size={14} />}
                              {group.label === "Personnel" && <User size={14} />}
                              {group.label === "Operations" && (
                                <ClipboardList size={14} />
                              )}
                              {group.label === "Campaign" && (
                                <Newspaper size={14} />
                              )}
                              {group.label === "Tools" && <Hammer size={14} />}
                              {group.label === "Admin" && <Cog size={14} />}
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
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ================= RIGHT ================= */}
        <div className="flex items-center gap-4">
          {user ? (
            <>
              <div className="hidden text-right md:block">
                <div className="text-sm text-gray-300">{user.email}</div>

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
                className="rounded-xl border border-red-500/60 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500/10"
              >
                Logout
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-xl border border-[#00ff66]/40 bg-[#00ff66]/5 px-4 py-2 text-sm font-medium text-[#00ff66] transition hover:bg-[#00ff66]/10"
            >
              Login
            </Link>
          )}
        </div>
      </div>

      {/* ================= SIMPLE FALLBACK FOR SMALLER SCREENS ================= */}
      <div className="border-t border-[#00ff66]/10 px-4 py-3 xl:hidden">
        <div className="flex flex-wrap gap-2">
          {filteredGroups.map((group) => (
            <Link
              key={group.label}
              href={group.items[0]?.href || "#"}
              className="rounded-lg border border-[#00ff66]/15 bg-[#00ff66]/5 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-[#00ff66] transition hover:bg-[#00ff66]/10"
            >
              {group.label}
            </Link>
          ))}
          <Link
            href="/faq"
            className="rounded-lg border border-[#00ff66]/15 bg-[#00ff66]/5 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-[#00ff66] transition hover:bg-[#00ff66]/10"
          >
            FAQ
          </Link>
        </div>
      </div>
    </nav>
  );
}