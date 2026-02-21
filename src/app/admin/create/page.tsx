"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function CreatePersonnel() {
  const router = useRouter();

  /* =====================================================
     🔐 ADMIN PROTECTION (BUILT-IN — NO HOOK)
  ======================================================*/

  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    const checkAdmin = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: role } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!role || role.role !== "admin") {
        router.replace("/");
        return;
      }

      setLoadingAuth(false);
    };

    checkAdmin();
  }, [router]);

  /* =====================================================
     🔥 STATES
  ======================================================*/

  const [rank, setRank] = useState("");
  const [birthNumber, setBirthNumber] = useState("");
  const [name, setName] = useState("");

  /* =====================================================
     🔥 LOADING SCREEN (PREVENT HOOK FLASH)
  ======================================================*/

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        <p>Checking permissions...</p>
      </div>
    );
  }

  /* =====================================================
     🔥 CREATE USER
  ======================================================*/

  const createUser = async () => {
    if (!rank || !birthNumber || !name) {
      alert("Rank, Birth Number and Name are required!");
      return;
    }

    /* ================= DUPLICATE CHECK ================= */

    const { data: nameCheck, error: nameError } = await supabase
      .from("personnel")
      .select("id")
      .eq("name", name)
      .maybeSingle();

    if (nameError) {
      alert("Validation error: " + nameError.message);
      return;
    }

    if (nameCheck) {
      alert("❌ Name is already taken!");
      return;
    }

    const { data: birthCheck, error: birthError } = await supabase
      .from("personnel")
      .select("id")
      .eq("birth_number", birthNumber)
      .maybeSingle();

    if (birthError) {
      alert("Validation error: " + birthError.message);
      return;
    }

    if (birthCheck) {
      alert("❌ Birth Number is already taken!");
      return;
    }

    /* ================= INSERT ================= */

    const { error } = await supabase.from("personnel").insert([
      {
        Clone_Rank: rank,
        birth_number: birthNumber,
        name: name,
        created_at: new Date().toISOString(),
      },
    ]);

    if (error) {
      alert("Creation failed: " + error.message);
      return;
    }

    alert("✅ Personnel Created Successfully!");

    setRank("");
    setBirthNumber("");
    setName("");
  };

  /* =====================================================
     🔥 UI
  ======================================================*/

  return (
    <div className="p-8 text-white">
	<button
    onClick={() => router.push("/")}
    className="mb-6 bg-[#002700] px-4 py-2 hover:bg-[#004d00] transition"
  >
    ← Back to Dashboard
  </button>
      <h1 className="text-3xl font-bold mb-6">
        Create New Personnel
      </h1>

      {/* ================= RANK ================= */}
      <div className="mb-4">
        <label className="block mb-2">Rank</label>
        <input
          type="text"
          value={rank}
          onChange={(e) => setRank(e.target.value)}
          className="bg-[#0f1a0f] border border-[#002700] p-2 w-full"
        />
      </div>

      {/* ================= BIRTH NUMBER ================= */}
      <div className="mb-4">
        <label className="block mb-2">Birth Number</label>
        <input
          type="text"
          value={birthNumber}
          onChange={(e) => setBirthNumber(e.target.value)}
          className="bg-[#0f1a0f] border border-[#002700] p-2 w-full"
        />
      </div>

      {/* ================= NAME ================= */}
      <div className="mb-4">
        <label className="block mb-2">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="bg-[#0f1a0f] border border-[#002700] p-2 w-full"
        />
      </div>

      {/* ================= CREATE BUTTON ================= */}
      <button
        onClick={createUser}
        className="bg-[#002700] px-6 py-2 hover:bg-[#004d00]"
      >
        Create Personnel
      </button>
    </div>
  );
}