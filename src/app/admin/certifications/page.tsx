"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function ManageCertifications() {
  const router = useRouter();

  /* =====================================================
     🔐 ADMIN PROTECTION
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
     🔥 STATE
  ======================================================*/

  const [personnel, setPersonnel] = useState<any[]>([]);
  const [certifications, setCertifications] = useState<any[]>([]);
  const [personCerts, setPersonCerts] = useState<any[]>([]);
  const [selectedPerson, setSelectedPerson] = useState("");
  const [searchPerson, setSearchPerson] = useState("");
  const [selectedCert, setSelectedCert] = useState("");
  const [loading, setLoading] = useState(false);

  /* =====================================================
     🔄 FETCH DATA
  ======================================================*/

  useEffect(() => {
    if (!loadingAuth) {
      fetchData();
    }
  }, [loadingAuth]);

  useEffect(() => {
    if (selectedPerson) {
      fetchPersonCerts();
    } else {
      setPersonCerts([]);
    }
  }, [selectedPerson]);

  const fetchData = async () => {
    const { data: people } = await supabase
      .from("personnel")
      .select("*")
      .order("name");

    const { data: certs } = await supabase
      .from("certifications")
      .select("*")
      .order("name");

    setPersonnel(people || []);
    setCertifications(certs || []);
  };

  const fetchPersonCerts = async () => {
    const { data } = await supabase
      .from("personnel_certifications")
      .select(`
        id,
        certification:certification_id ( id, name )
      `)
      .eq("personnel_id", selectedPerson);

    setPersonCerts(data || []);
  };

  /* =====================================================
     ➕ ASSIGN CERT
  ======================================================*/

  const assignCertification = async () => {
    if (!selectedPerson || !selectedCert) return;

    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("personnel_certifications")
      .insert([
        {
          personnel_id: selectedPerson,
          certification_id: selectedCert,
          awarded_at: new Date().toISOString(),
          awarded_by: user?.id ?? null,
        },
      ]);

    setLoading(false);

    if (error) {
      if (error.code === "23505") {
        alert("⚠ This person already has this certification.");
      } else {
        alert("Assignment failed: " + error.message);
      }
      return;
    }

    alert("✅ Certification Assigned!");
    setSelectedCert("");
    fetchPersonCerts();
  };

  /* =====================================================
     ❌ REVOKE CERT
  ======================================================*/

  const revokeCertification = async (recordId: string) => {
    const confirmDelete = confirm("Revoke this certification?");
    if (!confirmDelete) return;

    const { error } = await supabase
      .from("personnel_certifications")
      .delete()
      .eq("id", recordId);

    if (error) {
      alert("Failed to revoke: " + error.message);
      return;
    }

    alert("❌ Certification Revoked");
    fetchPersonCerts();
  };

  /* =====================================================
     🛑 LOADING
  ======================================================*/

  if (loadingAuth) {
    return (
      <div className="p-8 text-white text-center">
        <h2 className="text-xl">Checking Permissions...</h2>
      </div>
    );
  }

  /* =====================================================
     🔎 FILTERED PERSONNEL
  ======================================================*/

  const filteredPersonnel = personnel.filter((p) =>
    `${p.Clone_Rank} ${p.name}`
      .toLowerCase()
      .includes(searchPerson.toLowerCase())
  );

  /* =====================================================
     ✅ UI
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
        Certification Management
      </h1>

      {/* =====================================================
         🔎 PERSON SEARCH (NEW — REPLACES DROPDOWN)
      ======================================================*/}

      <div className="mb-6">
        <label className="block mb-2">
          Search Personnel
        </label>

        <input
          type="text"
          placeholder="Search by rank or name..."
          value={searchPerson}
          onChange={(e) => setSearchPerson(e.target.value)}
          className="bg-[#0f1a0f] border border-[#002700] p-2 w-full"
        />

        {searchPerson && (
          <div className="mt-2 border border-[#002700] bg-[#0f1a0f] max-h-60 overflow-y-auto">
            {filteredPersonnel.length === 0 ? (
              <p className="p-3 text-gray-400">
                No personnel found.
              </p>
            ) : (
              filteredPersonnel.map((p) => (
                <div
                  key={p.id}
                  onClick={() => {
                    setSelectedPerson(p.id);
                    setSearchPerson("");
                  }}
                  className="p-3 border-b border-[#002700] cursor-pointer hover:bg-[#002700]"
                >
                  {p.Clone_Rank} {p.name}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* =====================================================
         📜 CURRENT CERTIFICATIONS
      ======================================================*/}

      {selectedPerson && (
        <div className="mb-8 border border-[#002700] p-4 bg-[#0f1a0f]">
          <h2 className="text-xl font-bold mb-4">
            Current Certifications
          </h2>

          {personCerts.length === 0 ? (
            <p className="text-gray-400">
              No certifications assigned.
            </p>
          ) : (
            personCerts.map((pc) => (
              <div
                key={pc.id}
                className="flex justify-between items-center mb-2"
              >
                <span>{pc.certification?.name}</span>

                <button
                  onClick={() => revokeCertification(pc.id)}
                  className="bg-red-800 px-3 py-1 hover:bg-red-600"
                >
                  Revoke
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* =====================================================
         ➕ ASSIGN CERTIFICATION
      ======================================================*/}

      <div className="mb-6">
        <label className="block mb-2">
          Select Certification
        </label>

        <select
          className="bg-[#0f1a0f] border border-[#002700] p-2 w-full"
          value={selectedCert}
          onChange={(e) => setSelectedCert(e.target.value)}
        >
          <option value="">-- Select Certification --</option>

          {certifications.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={assignCertification}
        disabled={loading}
        className="bg-[#002700] px-6 py-2 hover:bg-[#004d00] disabled:opacity-50"
      >
        {loading ? "Assigning..." : "Assign Certification"}
      </button>
    </div>
  );
}