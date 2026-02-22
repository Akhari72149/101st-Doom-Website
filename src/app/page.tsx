"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  /* =====================================================
     🔐 AUTH STATE
  ======================================================*/

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

  /* =====================================================
     🔥 LOGOUT
  ======================================================*/

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    router.push("/login");
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-start bg-[#0b140b] text-white py-12">

      {/* =====================================================
          🔥 TOP BAR — USER INFO + LOGOUT
      ======================================================*/}

      <div className="w-full max-w-4xl flex justify-between items-center px-6 mb-8">

        <h1 className="text-4xl font-bold text-[#00ff66]">
          Personnel Management System
        </h1>

        {/* SHOW USER EMAIL IF LOGGED IN */}
        {user ? (
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-300">
              Logged in as: {user.email}
            </span>

            <button
              onClick={handleLogout}
              className="bg-red-700 px-4 py-2 rounded hover:bg-red-600"
            >
              Logout
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="bg-[#002700] px-4 py-2 rounded hover:bg-[#004d00]"
          >
            Login
          </Link>
        )}
      </div>

      {/* =====================================================
          🔥 BUTTON GRID
      ======================================================*/}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl px-4">

        <Link
          href="/personnel-profile"
          className="border border-[#002700] bg-[#0f1a0f] p-6 hover:bg-[#002700] transition text-center"
        >
          <h2 className="text-2xl font-bold mb-2">
            Personnel Profile
          </h2>
          <p className="text-gray-400">
            View your service record.
          </p>
        </Link>
		
        <Link
          href="/roster"
          className="border border-[#002700] bg-[#0f1a0f] p-6 hover:bg-[#002700] transition text-center"
        >
          <h2 className="text-2xl font-bold mb-2">
            Slotted Roster
          </h2>
          <p className="text-gray-400">
            View the live roster with assigned positions.
          </p>
        </Link>

        <Link
          href="/admin/positions"
          className="border border-[#002700] bg-[#0f1a0f] p-6 hover:bg-[#002700] transition text-center"
        >
          <h2 className="text-2xl font-bold mb-2">
            Position Management
          </h2>
          <p className="text-gray-400">
            Assign and manage personnel slots.
          </p>
        </Link>

        <Link
          href="/admin/create"
          className="border border-[#002700] bg-[#0f1a0f] p-6 hover:bg-[#002700] transition text-center"
        >
          <h2 className="text-2xl font-bold mb-2">
            User Creation
          </h2>
          <p className="text-gray-400">
            Add new personnel to the system.
          </p>
        </Link>

        <Link
          href="/admin/certifications"
          className="border border-[#002700] bg-[#0f1a0f] p-6 hover:bg-[#002700] transition text-center"
        >
          <h2 className="text-2xl font-bold mb-2">
            Certification Management
          </h2>
          <p className="text-gray-400">
            Assign or revoke certifications.
          </p>
        </Link>

        <Link
          href="/certifications"
          className="border border-[#002700] bg-[#0f1a0f] p-6 hover:bg-[#002700] transition text-center"
        >
          <h2 className="text-2xl font-bold mb-2">
            Certification Lookup
          </h2>
          <p className="text-gray-400">
            Search and view certifications by person.
          </p>
        </Link>


      </div>
    </div>
  );
}