"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUser(user);
    };

    getUser();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    router.push("/login");
  };

  return (
    <div className="
      min-h-screen w-full
      flex flex-col
      bg-[radial-gradient(circle_at_center,#001f11_0%,#000a06_100%)]
      text-white
      font-orbitron
    ">

      {/* ================= TOP BAR ================= */}

      <div className="
        w-full
        backdrop-blur-xl
        bg-black/40
        border-b border-[#00ff66]/20
        px-8 py-6
        flex justify-between items-center
      ">

        <h1 className="
          text-3xl md:text-4xl
          tracking-[0.4em]
          text-[#00ff66]
          font-bold
        ">
          PERSONNEL COMMAND SYSTEM
        </h1>

        {user ? (
          <div className="flex items-center gap-6">

            <span className="text-sm text-gray-300">
              {user.email}
            </span>

            <button
              onClick={handleLogout}
              className="
                px-4 py-2 rounded-xl
                border border-[#00ff66]/50
                text-[#00ff66]
                transition-all duration-200
                hover:bg-[#00ff66]/10
                hover:scale-105
                hover:shadow-[0_0_20px_rgba(0,255,100,0.6)]
              "
            >
              Logout
            </button>

          </div>
        ) : (
          <Link
            href="/login"
            className="
              px-4 py-2 rounded-xl
              border border-[#00ff66]/50
              text-[#00ff66]
              transition-all duration-200
              hover:bg-[#00ff66]/10
              hover:scale-105
              hover:shadow-[0_0_20px_rgba(0,255,100,0.6)]
            "
          >
            Login
          </Link>
        )}
      </div>

      {/* ================= GRID ================= */}

      <div className="
        flex-1
        grid
        grid-cols-1 md:grid-cols-2 lg:grid-cols-3
        gap-8
        p-12
        max-w-7xl
        mx-auto
        w-full
      ">

        {[
          {
            href: "/personnel-profile",
            title: "Personnel Profile",
            desc: "View service records & career data"
          },
          {
            href: "/grand-orbat",
            title: "Grand ORBAT",
            desc: "Full organizational hierarchy"
          },
          {
            href: "/roster",
            title: "Slotted Roster",
            desc: "Live position overview"
          },
          {
            href: "/admin/positions",
            title: "Slotting & Rank",
            desc: "Manage positions & rank assignments"
          },
          {
            href: "/admin/create",
            title: "User Creation",
            desc: "Add new personnel to system"
          },
          {
            href: "/admin/certifications",
            title: "Certification Management",
            desc: "Assign or revoke certifications"
          },
          {
            href: "/certifications",
            title: "Certification Lookup",
            desc: "Search personnel certifications"
          },
          {
            href: "/servers",
            title: "Server Booking",
            desc: "Book & manage server time"
          }
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="
              group relative
              p-8 rounded-3xl
              bg-black/50 backdrop-blur-xl
              border border-[#00ff66]/20
              shadow-[0_0_25px_rgba(0,255,100,0.15)]
              transition-all duration-300
              hover:scale-105
              hover:border-[#00ff66]
              hover:shadow-[0_0_50px_rgba(0,255,100,0.5)]
              hover:bg-[#003d14]/30
            "
          >

            <h2 className="
              text-2xl mb-3
              text-[#00ff66]
              font-semibold
            ">
              {item.title}
            </h2>

            <p className="text-gray-300 text-sm leading-relaxed">
              {item.desc}
            </p>

            {/* Animated bottom glow line */}
            <div className="
              absolute bottom-0 left-0
              h-[3px] w-0
              bg-[#00ff66]
              rounded-full
              group-hover:w-full
              transition-all duration-500
            " />

          </Link>
        ))}

      </div>
    </div>
  );
}