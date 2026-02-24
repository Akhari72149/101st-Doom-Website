"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function AuditLogsPage() {
  const router = useRouter();

  /* ================= STATES ================= */

  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [logs, setLogs] = useState<any[]>([]);

  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [selectedAction, setSelectedAction] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string>("all");

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
    setLoadingLogs(true);

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

        target_slot_label,
        target_slot_section,
        target_slot_subsection
      `)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      alert(error.message);
      setLoadingLogs(false);
      return;
    }

    setLogs(data || []);
    setLoadingLogs(false);
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

    if (
      log.action === "POSITION_ASSIGNED" ||
      log.action === "POSITION_UNASSIGNED"
    ) {
      const section = log.target_slot_section || "";
      const subsection = log.target_slot_subsection || "";
      const label = log.target_slot_label || "Unknown Slot";

      const parts = [section, subsection, label].filter(Boolean);
      return parts.join(" — ");
    }

    return "";
  };

  /* ================= ACTION COLORS ================= */

  const getActionStyle = (action: string) => {
    switch (action) {
      case "RANK_CHANGED":
        return "text-blue-600";
      case "CERTIFICATION_ASSIGNED":
        return "text-green-900";
      case "CERTIFICATION_REVOKED":
        return "text-red-800";
      case "POSITION_ASSIGNED":
        return "text-purple-400";
      case "POSITION_UNASSIGNED":
        return "text-yellow-400";
      default:
        return "text-[#00ff66]";
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

  /* ================= FILTER DATA ================= */

  const uniqueUsers = Array.from(
    new Set(logs.map((log) => log.profiles?.display_name).filter(Boolean))
  );

  const uniqueActions = Array.from(
    new Set(logs.map((log) => log.action).filter(Boolean))
  );

  const filteredLogs = logs.filter((log) => {
    const userMatch =
      selectedUser === "all" ||
      log.profiles?.display_name === selectedUser;

    const actionMatch =
      selectedAction === "all" ||
      log.action === selectedAction;

    const dateMatch =
      selectedDate === "all" ||
      new Date(log.created_at).toDateString() ===
        new Date(selectedDate).toDateString();

    return userMatch && actionMatch && dateMatch;
  });

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

        <h1 className="text-3xl font-bold text-[#00ff66] mb-6">
          Audit Logs
        </h1>

        {/* ================= FILTERS ================= */}

        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* USER FILTER */}
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="px-4 py-2 rounded-xl bg-black/40 border border-[#00ff66]/30 text-white"
          >
            <option value="all">All Users</option>
            {uniqueUsers.map((user) => (
              <option key={user} value={user}>
                {user}
              </option>
            ))}
          </select>

          {/* ACTION FILTER */}
          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="px-4 py-2 rounded-xl bg-black/40 border border-[#00ff66]/30 text-white"
          >
            <option value="all">All Actions</option>
            {uniqueActions.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>

          {/* DATE FILTER */}
          <input
            type="date"
            value={selectedDate === "all" ? "" : selectedDate}
            onChange={(e) =>
              setSelectedDate(e.target.value || "all")
            }
            className="px-4 py-2 rounded-xl bg-black/40 border border-[#00ff66]/30 text-white"
          />

        </div>

        {/* RESET BUTTON */}

        <button
          onClick={() => {
            setSelectedUser("all");
            setSelectedAction("all");
            setSelectedDate("all");
          }}
          className="mb-6 px-4 py-2 rounded-xl border border-red-500 text-red-400 hover:bg-red-500/10"
        >
          Reset Filters
        </button>

        {/* ================= TABLE ================= */}

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
              {loadingLogs ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-gray-400">
                    Loading logs...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-gray-400">
                    No logs found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const user = log.profiles?.display_name || "Unknown";
                  const personnelName = log.personnel?.name || "Unknown";

                  return (
                    <tr
                      key={log.id}
                      className="border-b border-[#00ff66]/10 hover:bg-[#00ff66]/5 transition"
                    >
                      <td className="p-3">{user}</td>
                      <td className="p-3">{personnelName}</td>

                      <td className={`p-3 font-semibold ${getActionStyle(log.action)}`}>
                        {log.action}
                      </td>

                      <td className="p-3 text-sm">
                        <span className="px-2 py-1 rounded-lg bg-[#00ff66]/10 border border-[#00ff66]/20">
                          {formatTarget(log)}
                        </span>
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