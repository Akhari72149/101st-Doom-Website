"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";

/* ================= TYPES ================= */

type Role = "admin" | "nco" | "di" | "trainer" | "logistics" | "recruiter";

type NavItem = {
  href: string;
  label: string;
  allowedRoles?: Role[];
};

type NavGroup = {
  label: string;
  allowedRoles?: Role[];
  items: NavItem[];
};

export default function NavbarClient() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [roles, setRoles] = useState<string[]>([]);

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
      label: "Operations",
      items: [
        { href: "/pcs", label: "Personnel Command Dashboard" },
        { href: "/Who-We-Are", label: "Who We Are" },
        { href: "/certs", label: "What We Offer" },
        { href: "/personnel-profile", label: "Personnel Profile" },
        { href: "/roster", label: "Slotted Roster" },
        { href: "/grand-orbat", label: "Grand Orbat" },
        { href: "/servers", label: "Server Booking" },
        { href: "/certifications", label: "Cert Lookup" },
        { href: "/Art-of_war", label: "Art of War" },
      ],
    },
{
      label: "Newcomers",
      items: [
        { href: "/Join", label: "How to Join" },
      ],
    },
{
      label: "Galactic Campaign",
      items: [
        { href: "/Galactic-Campaign", label: "GC Dashboard" },
        { href: "/GC-Platoon-Logi", label: "GC Platoon Logistics" },
      ],
    },
    {
      label: "Admin",
      allowedRoles: ["admin", "nco", "di", "trainer", "recruiter", "logistics"],
      items: [
        {
          href: "/admin/create",
          label: "Account Creation",
          allowedRoles: ["admin", "recruiter"],
        },
        {
          href: "/admin/positions",
          label: "Promotions & Slotting",
          allowedRoles: ["admin", "nco", "di"],
        },
        {
          href: "/audit",
          label: "Audit Log",
          allowedRoles: ["admin", "nco", "trainer", "di"],
        },
        {
          href: "/admin/certifications",
          label: "Certification Management",
          allowedRoles: ["admin", "nco", "trainer", "di"],
        },
        {
          href: "/admin/attendance",
          label: "Attendance Roster",
          allowedRoles: ["admin", "nco"],
        },
        {
          href: "/attendance-dashboard",
          label: "Attendance Roster Viewer",
          allowedRoles: ["admin", "nco"],
        },
        {
          href: "/GC-Logi",
          label: "GC Logistics",
          allowedRoles: ["admin", "logistics"],
        },
      ],
    },
  ];

  /* ================= ROLE FILTER ================= */

  const filteredGroups = navGroups
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
    }));

  return (
    <nav className="relative z-50 w-full bg-black/60 backdrop-blur border-b border-[#00ff66]/20 px-6 py-4 flex justify-between items-center">

      {/* =================DROPDOWN GROUPS ================= */}

      <div className="flex gap-8">

 
  <Link
    href="/"
    className="text-[#00ff66] hover:opacity-70 transition"
  >
    Home
  </Link>


        {filteredGroups.map((group) => (
          <div key={group.label} className="relative">
            <div className="group">

              {/* 🔥 Dropdown Button */}
              <button className="text-[#00ff66] hover:opacity-70 transition">
                {group.label} ▼
              </button>

              {/* 🔥 Dropdown Menu */}
              {group.items.length > 0 && (
                <div
                  className="
                    absolute
                    top-full
                    left-0
                    mt-2
                    opacity-0 invisible
                    group-hover:opacity-100 group-hover:visible
                    transition-all duration-200
                    bg-black/95
                    border border-[#00ff66]/20
                    rounded-xl
                    p-3
                    min-w-[180px]
                    backdrop-blur
                    z-50
                  "
                >
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="
                        block py-2 px-3
                        rounded
                        hover:bg-[#00ff66]/10
                        text-sm text-white
                        transition
                      "
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}

            </div>
          </div>
        ))}

        <Link
    href="/faq"
    className="text-[#00ff66] hover:opacity-70 transition"
  >
    FAQ
  </Link>
      </div>

      {/* ================= RIGHT = USER INFO ================= */}

      <div className="flex items-center gap-4">

        {user ? (
          <>
            <div className="text-right">
              <div className="text-sm text-gray-300">
                {user.email}
              </div>

              {roles.length > 0 && (
                <div className="text-xs text-[#00ff66]">
                  {roles.join(" | ").toUpperCase()}
                </div>
              )}
            </div>

            <button
              onClick={handleLogout}
              className="
                px-3 py-1
                rounded-xl
                border border-red-500
                text-red-400
                hover:bg-red-500/10
                transition
              "
            >
              Logout
            </button>
          </>
        ) : (
          <Link
            href="/login"
            className="
              px-3 py-1
              rounded-xl
              border border-[#00ff66]
              text-[#00ff66]
              hover:bg-[#00ff66]/10
              transition
            "
          >
            Login
          </Link>
        )}

      </div>

    </nav>
  );
}