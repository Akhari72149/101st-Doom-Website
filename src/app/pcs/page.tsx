"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  Users,
  Shield,
  FileText,
  Layers,
  BookOpen,
  Server,
  Search,
  LogIn,
  LogOut,
  UserPlus,
  Award,
  CalendarCheck,
  ScrollText,
  Network,
  Database,
  Lock,
  Radar,
} from "lucide-react";

type DashboardItem = {
  href: string;
  title: string;
  desc: string;
  section: "Personnel Operations" | "Command Tools" | "System Control";
  badge?: string;
  icon: React.ReactNode;
  allowedRoles?: string[];
};

export default function Home() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [search, setSearch] = useState("");

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
    setRoles([]);
    router.push("/login");
  };

  const items: DashboardItem[] = [
    {
      href: "/personnel-profile",
      title: "Personnel Profile",
      desc: "View service records & career data",
      section: "Personnel Operations",
      badge: "CORE",
      icon: <Database size={22} />,
    },
    {
      href: "/grand-orbat",
      title: "Grand ORBAT",
      desc: "Full organizational hierarchy",
      section: "Personnel Operations",
      badge: "ORBAT",
      icon: <Network size={22} />,
    },
    {
      href: "/roster",
      title: "Slotted Roster",
      desc: "Live position overview",
      section: "Personnel Operations",
      badge: "LIVE",
      icon: <BookOpen size={22} />,
    },
    {
      href: "/admin/positions",
      title: "Promotions & Slotting",
      desc: "Manage positions & rank assignments",
      section: "Command Tools",
      badge: "COMMAND",
      icon: <Shield size={22} />,
      allowedRoles: ["admin", "nco", "di"],
    },
    {
      href: "/admin/create",
      title: "User Creation",
      desc: "Add new personnel to system",
      section: "Command Tools",
      badge: "ADMIN",
      icon: <UserPlus size={22} />,
    },
    {
      href: "/admin/certifications",
      title: "Certification Management",
      desc: "Assign or revoke certifications",
      section: "Command Tools",
      badge: "TRAINING",
      icon: <Award size={22} />,
      allowedRoles: ["admin", "nco", "trainer"],
    },
    {
      href: "/certifications",
      title: "Certification Lookup",
      desc: "Search personnel certifications",
      section: "Command Tools",
      badge: "LOOKUP",
      icon: <FileText size={22} />,
    },
    {
      href: "/admin/attendance",
      title: "Attendance Roster",
      desc: "Confirm attendance for weekly mainops/trainings",
      section: "Command Tools",
      badge: "NCO",
      icon: <CalendarCheck size={22} />,
      allowedRoles: ["nco", "admin"],
    },
    {
      href: "/servers",
      title: "Server Booking",
      desc: "Book & manage server time",
      section: "System Control",
      badge: "LIVE",
      icon: <Server size={22} />,
    },
    {
      href: "/audit",
      title: "Audit Log",
      desc: "Audit log for assign/unassign functions",
      section: "System Control",
      badge: "SECURE",
      icon: <ScrollText size={22} />,
      allowedRoles: ["nco", "admin", "trainer", "di"],
    },
  ];

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const hasAccess =
        !item.allowedRoles ||
        item.allowedRoles.some((role) => roles.includes(role));

      const matchesSearch =
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.desc.toLowerCase().includes(search.toLowerCase()) ||
        item.section.toLowerCase().includes(search.toLowerCase());

      return hasAccess && matchesSearch;
    });
  }, [roles, search]);

  const groupedItems = useMemo(() => {
    return filteredItems.reduce<Record<string, DashboardItem[]>>((acc, item) => {
      if (!acc[item.section]) acc[item.section] = [];
      acc[item.section].push(item);
      return acc;
    }, {});
  }, [filteredItems]);

  const displayName =
    user?.user_metadata?.display_name ||
    user?.user_metadata?.full_name ||
    user?.email ||
    "Guest Operator";

  const accessLabel =
    roles.length > 0 ? roles.map((role) => role.toUpperCase()).join(" / ") : "GUEST ACCESS";

  return (
    <div className="relative z-0 min-h-screen w-full overflow-hidden text-white">
      <div className="absolute inset-0 -z-10 bg-black" />

      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(0,255,102,0.16),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(0,255,102,0.08),transparent_35%)]" />

      <div className="absolute inset-0 -z-10 opacity-[0.08] bg-[linear-gradient(rgba(0,255,102,0.25)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,102,0.25)_1px,transparent_1px)] bg-[size:44px_44px]" />

      <div className="w-full border-b border-[#00ff66]/20 bg-black/50 px-6 py-5 backdrop-blur-xl md:px-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.35em] text-[#00ff66]/70">
              <Radar size={14} />
              101st Doom Battalion
            </p>

            <h1 className="text-2xl font-bold tracking-[0.28em] text-[#00ff66] md:text-4xl">
              PERSONNEL COMMAND
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300 transition hover:border-red-400 hover:bg-red-500/20"
              >
                <LogOut size={16} />
                Logout
              </button>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-2 rounded-xl border border-[#00ff66]/30 bg-[#00ff66]/10 px-4 py-2 text-sm text-[#00ff66] transition hover:border-[#00ff66] hover:bg-[#00ff66]/20"
              >
                <LogIn size={16} />
                Login
              </Link>
            )}
          </div>
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8 md:px-10">
        <section className="relative overflow-hidden rounded-3xl border border-[#00ff66]/20 bg-black/55 p-6 shadow-[0_0_35px_rgba(0,255,102,0.12)] backdrop-blur-xl md:p-8">
          <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-[#00ff66]/10 blur-3xl" />

          <div className="relative grid gap-6 lg:grid-cols-[1.4fr_0.6fr] lg:items-center">
            <div>
              <p className="mb-2 text-sm uppercase tracking-[0.25em] text-[#00ff66]/70">
                Command dashboard online
              </p>

              <h2 className="text-3xl font-bold text-white md:text-4xl">
                Welcome back, <span className="text-[#00ff66]">{displayName}</span>
              </h2>

              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-300 md:text-base">
                Central access hub for personnel records, ORBAT management, slotting,
                certifications, attendance, servers, and audit tools.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-2xl border border-[#00ff66]/20 bg-black/40 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Access Level</p>
                <p className="mt-1 text-sm font-semibold text-[#00ff66]">{accessLabel}</p>
              </div>

              <div className="rounded-2xl border border-[#00ff66]/20 bg-black/40 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Modules</p>
                <p className="mt-1 text-2xl font-bold text-[#00ff66]">{filteredItems.length}</p>
              </div>

              <div className="rounded-2xl border border-[#00ff66]/20 bg-black/40 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Status</p>
                <p className="mt-1 text-sm font-semibold text-[#00ff66]">Operational</p>
              </div>
            </div>
          </div>
        </section>

        <section className="relative">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-[#00ff66]/60" size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search command modules..."
            className="w-full rounded-2xl border border-[#00ff66]/20 bg-black/55 py-4 pl-12 pr-5 text-sm text-white outline-none backdrop-blur-xl transition placeholder:text-gray-500 focus:border-[#00ff66]/70 focus:shadow-[0_0_25px_rgba(0,255,102,0.15)]"
          />
        </section>

        {Object.entries(groupedItems).map(([section, sectionItems]) => (
          <section key={section} className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-[#00ff66]/20" />
              <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-[#00ff66]/80">
                {section}
              </h3>
              <div className="h-px flex-1 bg-[#00ff66]/20" />
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {sectionItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group relative overflow-hidden rounded-3xl border border-[#00ff66]/20 bg-black/50 p-7 shadow-[0_0_25px_rgba(0,255,100,0.12)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-[#00ff66]/80 hover:bg-[#003d14]/25 hover:shadow-[0_0_45px_rgba(0,255,100,0.35)]"
                >
                  <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-[#00ff66]/10 blur-2xl transition group-hover:bg-[#00ff66]/20" />

                  {item.badge && (
                    <span className="absolute right-5 top-5 rounded-full border border-[#00ff66]/25 bg-[#00ff66]/10 px-3 py-1 text-[10px] font-semibold tracking-[0.18em] text-[#00ff66]/80">
                      {item.badge}
                    </span>
                  )}

                  <div className="relative mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#00ff66]/25 bg-[#00ff66]/10 text-[#00ff66] shadow-[0_0_20px_rgba(0,255,102,0.12)]">
                    {item.icon}
                  </div>

                  <h2 className="relative pr-20 text-xl font-semibold text-[#00ff66]">
                    {item.title}
                  </h2>

                  <p className="relative mt-3 text-sm leading-relaxed text-gray-300">
                    {item.desc}
                  </p>

                  {item.allowedRoles && (
                    <div className="relative mt-5 flex items-center gap-2 text-xs text-gray-500">
                      <Lock size={13} />
                      Requires {item.allowedRoles.map((role) => role.toUpperCase()).join(" / ")}
                    </div>
                  )}

                  <div className="absolute bottom-0 left-0 h-[3px] w-0 rounded-full bg-[#00ff66] transition-all duration-500 group-hover:w-full" />
                </Link>
              ))}
            </div>
          </section>
        ))}

        {filteredItems.length === 0 && (
          <div className="rounded-3xl border border-[#00ff66]/20 bg-black/50 p-10 text-center text-gray-400">
            No modules found for that search.
          </div>
        )}
      </main>
    </div>
  );
}