"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function AuditLogsPage() {
  const router = useRouter();

  const [loadingAuth, setLoadingAuth] = useState(true);
  const [logs, setLogs] = useState<any[]>([]);

  /* ================= AUTH ================= */

  useEffect(() => {
    const checkAccess = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const roleList = roles?.map((r) => r.role) || [];


      const allowedRoles = ["nco", "admin"];

      if (!roleList.some((role) => allowedRoles.includes(role))) {
        router.replace("/");
        return;
      }

      await fetchLogs();
      setLoadingAuth(false);
    };

    checkAccess();
  }, [router]);

  /* ================= FETCH LOGS ================= */

  const fetchLogs = async () => {
    const { data, error } = await supabase
      .from("audit_logs")
      .select(`
        id,
        action,
        created_at,

        profiles:user_id (
          display_name
        ),

        personnel:target_personnel_id (
          name
        ),

        ranks:target_rank_id (
          name
        ),

        oldRank:old_rank_id (
          name
        ),

        certifications:target_certification_id (
          name
        ),

        target_slot_id,
        target_slot_label,
        target_slot_section,
        target_slot_subsection
      `)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      alert(error.message);
      return;
    }

    setLogs(data || []);
  };

  /* ================= HELPERS ================= */

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString();
  };

  const formatTarget = (log: any) => {
    if (log.action === "CERTIFICATION_ASSIGNED") {
      return `Certification → ${log.certifications?.name || "Unknown"}`;
    }

    if (log.action === "CERTIFICATION_REVOKED") {
      return `Certification → ${log.certifications?.name || "Unknown"}`;
    }

    if (log.action === "RANK_CHANGED") {
      const oldRank = log.oldRank?.name || "Unranked";
      const newRank = log.ranks?.name || "Unranked";

      return `${oldRank} → ${newRank}`;
    }

    /* ================= POSITION ================= */

    if (log.action === "POSITION_ASSIGNED") {
      const section = log.target_slot_section || "";
      const subsection = log.target_slot_subsection || "";
      const label = log.target_slot_label || "Unknown Slot";

      const parts = [section, subsection, label].filter(Boolean);
      return parts.join(" — ");
    }

    if (log.action === "POSITION_UNASSIGNED") {
      const section = log.target_slot_section || "";
      const subsection = log.target_slot_subsection || "";
      const label = log.target_slot_label || "Unknown Slot";

      const parts = [section, subsection, label].filter(Boolean);
      return parts.join(" — ");
    }
  };

  /* ================= LOADING ================= */

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_center,#001f0f_0%,#000a06_100%)] text-[#00ff66]">
        Loading Audit Logs...
      </div>
    );
  }

  /* ================= UI ================= */

  return (
    <div className="min-h-screen p-10 bg-[radial-gradient(circle_at_center,#001f11_0%,#000000_100%)] text-white">

      <button
        onClick={() => router.push("/pcs")}
        className="mb-8 px-5 py-2 rounded-xl border border-[#00ff66]/50 text-[#00ff66] hover:bg-[#00ff66]/10 transition"
      >
        ← Back
      </button>

      <div className="max-w-6xl mx-auto p-8 rounded-3xl border border-[#00ff66]/30 bg-black/60 backdrop-blur-lg shadow-[0_0_60px_rgba(0,255,100,0.15)]">

        <h1 className="text-3xl font-bold text-[#00ff66] mb-8">
          Audit Logs
        </h1>

        {/* TABLE */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">

            <thead>
              <tr className="border-b border-[#00ff66]/30 text-[#00ff66]">
                <th className="p-3">User</th>
                <th className="p-3">Personnel</th>
                <th className="p-3">Action</th>
                <th className="p-3">Details</th>
                <th className="p-3">Time</th>
              </tr>
            </thead>

            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-gray-400">
                    No logs found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const user = log.profiles?.display_name || "Unknown";
                  const personnelName = log.personnel?.name || "Unknown";

                  return (
                    <tr
                      key={log.id}
                      className="border-b border-[#00ff66]/10 hover:bg-[#00ff66]/5 transition"
                    >
                      <td className="p-3">{user}</td>
                      <td className="p-3">{personnelName}</td>
                      <td className="p-3 text-[#00ff66] font-semibold">
                        {log.action}
                      </td>
                      <td className="p-3 text-sm text-gray-300">
                        {formatTarget(log)}
                      </td>
                      <td className="p-3 text-sm text-gray-400">
                        {formatDate(log.created_at)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

          </table>
        </div>

      </div>
    </div>
  );
}