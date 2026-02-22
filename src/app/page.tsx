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
    <div className="min-h-screen w-full flex flex-col items-center justify-start 
      bg-gradient-to-br from-[#05080f] via-[#0b0f1a] to-black 
      text-white py-12 font-orbitron">

      {/* TOP BAR */}
      <div className="w-full max-w-5xl flex justify-between items-center px-6 mb-12">

        <h1 className="text-4xl tracking-widest text-[#00e5ff] 
          drop-shadow-[0_0_15px_rgba(0,229,255,0.6)]">
          PERSONNEL COMMAND SYSTEM
        </h1>

        {user ? (
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-300">
              {user.email}
            </span>

            <button
              onClick={handleLogout}
              className="border border-[#00e5ff] px-4 py-2 rounded-lg 
              hover:bg-[#00e5ff] hover:text-black transition 
              shadow-[0_0_15px_rgba(0,229,255,0.5)]"
            >
              Logout
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="border border-[#00e5ff] px-4 py-2 rounded-lg 
            hover:bg-[#00e5ff] hover:text-black transition 
            shadow-[0_0_15px_rgba(0,229,255,0.5)]"
          >
            Login
          </Link>
        )}
      </div>

      {/* BUTTON GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 
        gap-8 w-full max-w-6xl px-6">

        {[
          { href: "/personnel-profile", title: "Personnel Profile", desc: "View service record" },
          { href: "/roster", title: "Slotted Roster", desc: "Live position overview" },
          { href: "/admin/positions", title: "Slotting & Rank", desc: "Slotting & Rank Management" },
          { href: "/admin/create", title: "User Creation", desc: "Add new personnel" },
          { href: "/admin/certifications", title: "Certification Management", desc: "Assign or revoke certifications" },
          { href: "/certifications", title: "Certification Lookup", desc: "Search certifications" },
          { href: "/servers", title: "Server Booking", desc: "Book server time" }
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group relative border border-[#00e5ff] 
            bg-black/60 backdrop-blur-xl 
            p-8 rounded-2xl 
            hover:scale-105 transition-all duration-300
            shadow-[0_0_20px_rgba(0,229,255,0.2)] 
            hover:shadow-[0_0_40px_rgba(0,229,255,0.6)]"
          >
            <h2 className="text-2xl mb-3 text-[#00e5ff] tracking-wide">
              {item.title}
            </h2>

            <p className="text-gray-400 text-sm">
              {item.desc}
            </p>

            {/* Glow line animation */}
            <div className="absolute bottom-0 left-0 h-[2px] w-0 
              bg-[#00e5ff] group-hover:w-full transition-all duration-500" />
          </Link>
        ))}

      </div>
    </div>
  );
}