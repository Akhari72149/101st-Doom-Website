"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

const DEFAULT_RECENT_DAYS = 5;

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
  const [personnelList, setPersonnelList] = useState<string[]>([]);
  const [selectedPersonnel, setSelectedPersonnel] = useState<string>("all");

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

  const renderName = (name: string) => {
    if (!name) return null;

    if (name === "Mommy Doombot") {
      return <span className="text-green-500 font-semibold">{name}</span>;
    }
    if (name === "Akhari") {
      return <span className="text-yellow-600 font-semibold">{name}</span>;
    }
    if (name === "Blind") {
      return <span className="text-green-600 font-semibold">{name}</span>;
    }

    return name;
  };

  /* ================= FETCH FILTER OPTIONS ================= */

  const fetchFilterOptions = async () => {
    const { data: userData } = await supabase
      .from("profiles")
      .select("display_name")
      .order("display_name");

    if (userData) {
      setUsers(userData.map((u) => u.display_name).filter(Boolean));
    }

    const { data: actionData } = await supabase
      .from("audit_logs")
      .select("action");

    if (actionData) {
      const uniqueActions = Array.from(
        new Set(actionData.map((a) => a.action).filter(Boolean))
      );
      setActions(uniqueActions);
    }

    const { data: personnelData } = await supabase
      .from("personnel")
      .select("name")
      .order("name");

    if (personnelData) {
      setPersonnelList(personnelData.map((p) => p.name).filter(Boolean));
    }
  };

  /* ================= FILTER DETECTION ================= */

  const hasManualFilter =
    selectedUser !== "all" ||
    selectedAction !== "all" ||
    selectedDate !== "all" ||
    selectedPersonnel !== "all";

  /* ================= FETCH LOGS ================= */

  const fetchLogs = async () => {
    setLoadingLogs(true);

    let query = supabase
      .from("audit_logs")
      .select(`
        id,
        action,
        created_at,
        user_id,
        processed_by,
        profiles:user_id ( display_name ),
        processor:processed_by ( name ),
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
      start.setHours(0, 0, 0, 0);

      const end = new Date(selectedDate);
      end.setHours(23, 59, 59, 999);

      query = query
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString());
    } else {
      const recentStart = new Date();
      recentStart.setDate(recentStart.getDate() - DEFAULT_RECENT_DAYS);
      recentStart.setHours(0, 0, 0, 0);

      query = query.gte("created_at", recentStart.toISOString());
    }

    if (selectedUser !== "all") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("display_name", selectedUser)
        .single();

      if (profile) {
        query = query.eq("user_id", profile.id);
      }
    }

    if (selectedPersonnel !== "all") {
      const { data: personnel } = await supabase
        .from("personnel")
        .select("id")
        .eq("name", selectedPersonnel)
        .single();

      if (personnel) {
        query = query.eq("target_personnel_id", personnel.id);
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

  /* ================= FETCH WHEN FILTERS CHANGE ================= */

  useEffect(() => {
    if (!loadingAuth) {
      fetchLogs();
    }
  }, [loadingAuth, selectedUser, selectedAction, selectedDate, selectedPersonnel]);

  /* ================= AUTO REFRESH ================= */

  useEffect(() => {
    if (loadingAuth) return;

    const interval = setInterval(() => {
      fetchLogs();
    }, 30000);

    return () => clearInterval(interval);
  }, [loadingAuth, selectedUser, selectedAction, selectedDate, selectedPersonnel]);

  /* ================= HELPERS ================= */

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString();
  };

  const formatTarget = (log: any) => {
    if (log.action === "CERTIFICATION_ASSIGNED") {
      return `Certification → ${log.certifications?.name || "Mommy Doombot"}`;
    }

    if (log.action === "CERTIFICATION_REVOKED") {
      return `Certification → ${log.certifications?.name || "Mommy Doombot"}`;
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
        return "text-orange-600";
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
        className="mb-6 px-4 py-2 rounded-lg border border-[#00ff66]/50 text-[#00ff66] font-semibold hover:bg-[#00ff66]/10 hover:scale-105 transition"
      >
        ← Return to Dashboard
      </button>

      <div className="max-w-7xl mx-auto p-8 rounded-3xl border border-[#00ff66]/30 bg-black/60 backdrop-blur-lg shadow-[0_0_60px_rgba(0,255,100,0.15)]">
        <h1 className="text-3xl font-bold text-[#00ff66] mb-3">
          Audit Logs
        </h1>

        <div className="text-sm text-gray-400 mb-6">
          {selectedDate === "all"
            ? `Showing recent changes from the last ${DEFAULT_RECENT_DAYS} days`
            : `Showing changes for ${selectedDate}`}
          {" • "}
          {logs.length} log entries
        </div>

        <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="px-4 py-2 rounded-xl bg-black/40 border border-[#00ff66]/30 text-white focus:outline-none focus:ring-2 focus:ring-[#00ff66]/40 hover:border-[#00ff66] transition"
          >
            <option value="all">All Users</option>
            {users.map((user) => (
              <option key={user} value={user}>
                {user}
              </option>
            ))}
          </select>

          <select
            value={selectedPersonnel}
            onChange={(e) => setSelectedPersonnel(e.target.value)}
            className="px-4 py-2 rounded-xl bg-black/40 border border-[#00ff66]/30 text-white focus:outline-none focus:ring-2 focus:ring-[#00ff66]/40 hover:border-[#00ff66] transition"
          >
            <option value="all">All Personnel</option>
            {personnelList.map((person) => (
              <option key={person} value={person}>
                {person}
              </option>
            ))}
          </select>

          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="px-4 py-2 rounded-xl bg-black/40 border border-[#00ff66]/30 text-white focus:outline-none focus:ring-2 focus:ring-[#00ff66]/40 hover:border-[#00ff66] transition"
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
            onChange={(e) => setSelectedDate(e.target.value || "all")}
            className="px-4 py-2 rounded-xl bg-black/40 border border-[#00ff66]/30 text-white focus:outline-none focus:ring-2 focus:ring-[#00ff66]/40 hover:border-[#00ff66] transition"
          />
        </div>

        {hasManualFilter && (
          <div className="mb-4">
            <span className="px-3 py-1 rounded-full bg-[#00ff66]/10 border border-[#00ff66]/30 text-sm text-[#00ff66]">
              Manual Filters Active
            </span>
          </div>
        )}

        <button
          onClick={() => {
            setSelectedUser("all");
            setSelectedAction("all");
            setSelectedDate("all");
            setSelectedPersonnel("all");
          }}
          className="mb-6 px-4 py-2 rounded-xl border border-red-500 text-red-400 hover:bg-red-500/10"
        >
          Reset Filters
        </button>

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
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-400">
                      <div className="text-4xl mb-3 opacity-50">📭</div>
                      <div className="text-lg font-medium">No logs found</div>
                      <div className="text-sm opacity-60">
                        Try adjusting your filters
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  let userName = "Mommy Doombot";

                  if (
                    log.action === "CERTIFICATION_ASSIGNED" ||
                    log.action === "CERTIFICATION_REVOKED"
                  ) {
                    userName =
                      log.processor?.name ||
                      log.profiles?.display_name ||
                      "Mommy Doombot";
                  } else if (log.action === "NEW_MEMBER") {
                    userName = log.processor?.name || "Mommy Doombot";
                  } else {
                    userName = log.profiles?.display_name || "Mommy Doombot";
                  }

                  const personnelName = log.personnel?.name || "Mommy Doombot";

                  return (
                    <tr
                      key={log.id}
                      className="border-b border-[#00ff66]/10 odd:bg-black/40 even:bg-black/60 hover:bg-[#00ff66]/10 transition"
                    >
                      <td className="p-3">{renderName(userName)}</td>
                      <td className="p-3">{renderName(personnelName)}</td>

                      <td className="p-3">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${getActionStyle(
                            log.action
                          )} bg-black/40 border`}
                        >
                          {log.action}
                        </span>
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