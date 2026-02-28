"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function AuditLogsPage() {
  const router = useRouter();

  /* ================= STATES ================= */

  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);

  const [users, setUsers] = useState<string[]>([]);
  const [actions, setActions] = useState<string[]>([]);

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
      const allowedRoles = ["nco", "admin", "trainer", "di"];

      if (!roleList.some((role) => allowedRoles.includes(role))) {
        router.replace("/");
        return;
      }

      await fetchFilterOptions();
      setLoadingAuth(false);
    };

    checkAccess();
  }, [router]);

  /* ================= FETCH FILTER OPTIONS ================= */

  const fetchFilterOptions = async () => {
    // Fetch users
    const { data: userData } = await supabase
      .from("profiles")
      .select("display_name")
      .order("display_name");

    if (userData) {
      setUsers(
        userData
          .map((u) => u.display_name)
          .filter(Boolean)
      );
    }

    // Fetch actions
    const { data: actionData } = await supabase
      .from("audit_logs")
      .select("action");

    if (actionData) {
      const uniqueActions = Array.from(
        new Set(actionData.map((a) => a.action).filter(Boolean))
      );
      setActions(uniqueActions);
    }
  };

  /* ================= FILTER DETECTION ================= */

  const hasActiveFilter =
    selectedUser !== "all" ||
    selectedAction !== "all" ||
    selectedDate !== "all";

  /* ================= FETCH LOGS ================= */

  const fetchLogs = async () => {
    if (!hasActiveFilter) {
      setLogs([]);
      return;
    }

    setLoadingLogs(true);

    let query = supabase
      .from("audit_logs")
      .select(`
        id,
        action,
        created_at,
        user_id,
        profiles:user_id ( display_name ),
        personnel:target_personnel_id ( name ),
        ranks:target_rank_id ( name ),
        oldRank:old_rank_id ( name ),
        certifications:target_certification_id ( name ),
        target_slot_label,
        target_slot_section,
        target_slot_subsection
      `)
      .order("created_at", { ascending: false })
      .limit(200);

    if (selectedAction !== "all") {
      query = query.eq("action", selectedAction);
    }

    if (selectedDate !== "all") {
      const start = new Date(selectedDate);
      const end = new Date(selectedDate);
      end.setHours(23, 59, 59, 999);

      query = query
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString());
    }

    if (selectedUser !== "all") {
      // Get user_id from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("display_name", selectedUser)
        .single();

      if (profile) {
        query = query.eq("user_id", profile.id);
      }
    }

    const { data, error } = await query;

    if (error) {
      alert(error.message);
      setLoadingLogs(false);
      return;
    }

    setLogs(data || []);
    setLoadingLogs(false);
  };

  /* ================= FETCH WHEN FILTER CHANGES ================= */

  useEffect(() => {
    if (hasActiveFilter) {
      fetchLogs();
    } else {
      setLogs([]);
    }
  }, [selectedUser, selectedAction, selectedDate]);

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

  /* ================= LOADING SCREEN ================= */

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
        <h1 className="text-3xl font-bold text-[#00ff66] mb-6">
          Audit Logs
        </h1>

        {/* FILTERS */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="px-4 py-2 rounded-xl bg-black/40 border border-[#00ff66]/30 text-white"
          >
            <option value="all">All Users</option>
            {users.map((user) => (
              <option key={user} value={user}>
                {user}
              </option>
            ))}
          </select>

          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="px-4 py-2 rounded-xl bg-black/40 border border-[#00ff66]/30 text-white"
          >
            <option value="all">All Actions</option>
            {actions.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={selectedDate === "all" ? "" : selectedDate}
            onChange={(e) =>
              setSelectedDate(e.target.value || "all")
            }
            className="px-4 py-2 rounded-xl bg-black/40 border border-[#00ff66]/30 text-white"
          />
        </div>

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
              {!hasActiveFilter ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-gray-400">
                    Apply at least one filter to view audit logs.
                  </td>
                </tr>
              ) : loadingLogs ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-gray-400">
                    Loading logs...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
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