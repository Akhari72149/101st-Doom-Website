"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import {
  RefreshCw,
  Search,
  Shield,
  CalendarDays,
  Filter,
  X,
  Users,
  ClipboardList,
} from "lucide-react";

const DEFAULT_RECENT_DAYS = 5;

type LogRow = {
  id: string;
  action: string;
  created_at: string;
  user_id: string | null;
  processed_by: string | null;
  profiles?: {
    display_name?: string | null;
  } | null;
  processor?: {
    name?: string | null;
  } | null;
  personnel?: {
    name?: string | null;
  } | null;
  ranks?: {
    name?: string | null;
  } | null;
  oldRank?: {
    name?: string | null;
  } | null;
  certifications?: {
    name?: string | null;
  } | null;
  target_slot_label?: string | null;
  target_slot_section?: string | null;
  target_slot_subsection?: string | null;
};

export default function AuditLogsPage() {
  const router = useRouter();

  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [logs, setLogs] = useState<LogRow[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [personnelList, setPersonnelList] = useState<string[]>([]);

  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [selectedAction, setSelectedAction] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string>("all");
  const [selectedPersonnel, setSelectedPersonnel] = useState<string>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const init = async () => {
      await fetchFilterOptions();
      setLoadingAuth(false);
    };

    init();
  }, []);

  const renderName = (name: string) => {
    if (!name) return <span className="text-gray-500">Unknown</span>;

    if (name === "Mommy Doombot") {
      return <span className="text-green-400 font-semibold">{name}</span>;
    }

    if (name === "Akhari") {
      return <span className="text-yellow-400 font-semibold">{name}</span>;
    }

    if (name === "Blind") {
      return <span className="text-emerald-400 font-semibold">{name}</span>;
    }

    return <span className="text-white">{name}</span>;
  };

  const fetchFilterOptions = async () => {
    const [{ data: userData }, { data: actionData }, { data: personnelData }] =
      await Promise.all([
        supabase.from("profiles").select("display_name").order("display_name"),
        supabase.from("audit_logs").select("action"),
        supabase.from("personnel").select("name").order("name"),
      ]);

    if (userData) {
      setUsers(
        userData
          .map((u) => u.display_name)
          .filter((value): value is string => Boolean(value))
      );
    }

    if (actionData) {
      const uniqueActions = Array.from(
        new Set(
          actionData
            .map((a) => a.action)
            .filter((value): value is string => Boolean(value))
        )
      ).sort();
      setActions(uniqueActions);
    }

    if (personnelData) {
      setPersonnelList(
        personnelData
          .map((p) => p.name)
          .filter((value): value is string => Boolean(value))
      );
    }
  };

  const hasManualFilter =
    selectedUser !== "all" ||
    selectedAction !== "all" ||
    selectedDate !== "all" ||
    selectedPersonnel !== "all";

  const fetchLogs = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoadingLogs(true);
    }

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
        .maybeSingle();

      if (profile?.id) {
        query = query.eq("user_id", profile.id);
      } else {
        setLogs([]);
        setLoadingLogs(false);
        setRefreshing(false);
        return;
      }
    }

    if (selectedPersonnel !== "all") {
      const { data: personnel } = await supabase
        .from("personnel")
        .select("id")
        .eq("name", selectedPersonnel)
        .maybeSingle();

      if (personnel?.id) {
        query = query.eq("target_personnel_id", personnel.id);
      } else {
        setLogs([]);
        setLoadingLogs(false);
        setRefreshing(false);
        return;
      }
    }

    const { data, error } = await query;

    if (error) {
      alert(error.message);
      setLoadingLogs(false);
      setRefreshing(false);
      return;
    }

    setLogs((data || []) as LogRow[]);
    setLoadingLogs(false);
    setRefreshing(false);
  };

  useEffect(() => {
    if (!loadingAuth) {
      fetchLogs();
    }
  }, [loadingAuth, selectedUser, selectedAction, selectedDate, selectedPersonnel]);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString();
  };

  const formatRelativeTime = (date: string) => {
    const now = new Date().getTime();
    const target = new Date(date).getTime();
    const diffMs = now - target;

    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMs / 3600000);
    const days = Math.floor(diffMs / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(date).toLocaleDateString();
  };

  const formatTarget = (log: LogRow) => {
    if (
      log.action === "CERTIFICATION_ASSIGNED" ||
      log.action === "CERTIFICATION_REVOKED"
    ) {
      return `Certification → ${log.certifications?.name || "Unknown Certification"}`;
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

    return "General audit entry";
  };

  const getUserName = (log: LogRow) => {
    if (
      log.action === "CERTIFICATION_ASSIGNED" ||
      log.action === "CERTIFICATION_REVOKED"
    ) {
      return log.processor?.name || log.profiles?.display_name || "Mommy Doombot";
    }

    if (log.action === "NEW_MEMBER") {
      return log.processor?.name || "Mommy Doombot";
    }

    return log.profiles?.display_name || "Mommy Doombot";
  };

  const getActionClasses = (action: string) => {
    switch (action) {
      case "RANK_CHANGED":
        return "text-blue-300 bg-blue-500/10 border-blue-500/25";
      case "CERTIFICATION_ASSIGNED":
        return "text-orange-300 bg-orange-500/10 border-orange-500/25";
      case "CERTIFICATION_REVOKED":
        return "text-red-300 bg-red-500/10 border-red-500/25";
      case "POSITION_ASSIGNED":
        return "text-purple-300 bg-purple-500/10 border-purple-500/25";
      case "POSITION_UNASSIGNED":
        return "text-yellow-300 bg-yellow-500/10 border-yellow-500/25";
      case "PERSONNEL_REMOVED":
        return "text-rose-300 bg-rose-500/10 border-rose-500/25";
      case "NEW_MEMBER":
        return "text-emerald-300 bg-emerald-500/10 border-emerald-500/25";
      default:
        return "text-[#00ff66] bg-[#00ff66]/10 border-[#00ff66]/20";
    }
  };

  const filteredLogs = useMemo(() => {
    const term = search.trim().toLowerCase();

    return logs.filter((log) => {
      const userName = getUserName(log).toLowerCase();
      const personnelName = (log.personnel?.name || "Mommy Doombot").toLowerCase();
      const targetText = formatTarget(log).toLowerCase();
      const actionText = (log.action || "").toLowerCase();

      if (!term) return true;

      return (
        userName.includes(term) ||
        personnelName.includes(term) ||
        targetText.includes(term) ||
        actionText.includes(term)
      );
    });
  }, [logs, search]);

  const stats = useMemo(() => {
    const now = new Date();

    const today = logs.filter((log) => {
      const created = new Date(log.created_at);
      return created.toDateString() === now.toDateString();
    }).length;

    const recentCutoff = new Date();
    recentCutoff.setDate(recentCutoff.getDate() - DEFAULT_RECENT_DAYS);
    recentCutoff.setHours(0, 0, 0, 0);

    const recent = logs.filter((log) => new Date(log.created_at) >= recentCutoff).length;

    const activeFiltersCount = [
      selectedUser !== "all",
      selectedAction !== "all",
      selectedDate !== "all",
      selectedPersonnel !== "all",
      search.trim() !== "",
    ].filter(Boolean).length;

    return {
      total: filteredLogs.length,
      today,
      recent,
      activeFiltersCount,
    };
  }, [
    logs,
    filteredLogs.length,
    selectedUser,
    selectedAction,
    selectedDate,
    selectedPersonnel,
    search,
  ]);

  const activeFilterChips = [
    selectedUser !== "all" ? `User: ${selectedUser}` : null,
    selectedPersonnel !== "all" ? `Personnel: ${selectedPersonnel}` : null,
    selectedAction !== "all" ? `Action: ${selectedAction}` : null,
    selectedDate !== "all" ? `Date: ${selectedDate}` : null,
    search.trim() ? `Search: ${search.trim()}` : null,
  ].filter(Boolean) as string[];

  const resetFilters = () => {
    setSelectedUser("all");
    setSelectedAction("all");
    setSelectedDate("all");
    setSelectedPersonnel("all");
    setSearch("");
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_center,#001f0f_0%,#000a06_100%)] text-[#00ff66]">
        Loading Audit Logs...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#001f11_0%,#000000_55%,#000000_100%)] text-white relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-[0.06] bg-[linear-gradient(rgba(0,255,102,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,102,0.2)_1px,transparent_1px)] bg-[size:42px_42px]" />

      <div className="relative z-10 p-4 sm:p-6 lg:p-10">
        <div className="max-w-7xl mx-auto">
          <button
            onClick={() => router.push("/pcs")}
            className="mb-6 px-4 py-2 rounded-xl border border-[#00ff66]/30 bg-black/40 text-[#00ff66] font-semibold hover:bg-[#00ff66]/10 hover:scale-[1.02] transition"
          >
            ← Return to Dashboard
          </button>

          <div className="rounded-3xl border border-[#00ff66]/20 bg-black/55 backdrop-blur-xl shadow-[0_0_60px_rgba(0,255,100,0.12)] overflow-hidden">
            <div className="border-b border-[#00ff66]/15 p-6 sm:p-8">
              <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-6">
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-12 w-12 rounded-2xl border border-[#00ff66]/20 bg-[#00ff66]/10 flex items-center justify-center shadow-[0_0_25px_rgba(0,255,100,0.18)]">
                      <Shield className="h-6 w-6 text-[#00ff66]" />
                    </div>

                    <div>
                      <h1 className="text-3xl sm:text-4xl font-bold text-[#00ff66] tracking-tight">
                        Audit Logs
                      </h1>
                      <p className="text-sm sm:text-base text-gray-400 mt-1">
                        Monitor personnel, certifications, ranks, and slotting activity across the system
                      </p>
                    </div>
                  </div>

                  <div className="h-px w-full max-w-md bg-gradient-to-r from-[#00ff66]/60 via-[#00ff66]/20 to-transparent" />
                </div>

                <button
                  onClick={() => fetchLogs(true)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-[#00ff66]/25 bg-black/50 text-[#00ff66] hover:bg-[#00ff66]/10 transition"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                  />
                  Refresh Now
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-8">
                <div className="rounded-2xl border border-[#00ff66]/15 bg-black/40 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-2">
                    Visible Logs
                  </div>
                  <div className="text-3xl font-bold text-white">{stats.total}</div>
                </div>

                <div className="rounded-2xl border border-[#00ff66]/15 bg-black/40 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-2">
                    Today
                  </div>
                  <div className="text-3xl font-bold text-white">{stats.today}</div>
                </div>

                <div className="rounded-2xl border border-[#00ff66]/15 bg-black/40 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-2">
                    Last {DEFAULT_RECENT_DAYS} Days
                  </div>
                  <div className="text-3xl font-bold text-white">{stats.recent}</div>
                </div>

                <div className="rounded-2xl border border-[#00ff66]/15 bg-black/40 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-2">
                    Active Filters
                  </div>
                  <div className="text-3xl font-bold text-white">
                    {stats.activeFiltersCount}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-8 border-b border-[#00ff66]/10">
              <div className="flex items-center gap-2 mb-4">
                <Filter className="h-4 w-4 text-[#00ff66]" />
                <div className="text-sm font-semibold text-[#00ff66] tracking-wide">
                  Filter Controls
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
                <div className="xl:col-span-2 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#00ff66]/70" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search user, personnel, action or target..."
                    className="w-full pl-11 pr-4 py-3 rounded-2xl border border-[#00ff66]/20 bg-black/50 text-white placeholder:text-gray-500 outline-none focus:border-[#00ff66]/50 focus:ring-2 focus:ring-[#00ff66]/10 transition"
                  />
                </div>

                <select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className="px-4 py-3 rounded-2xl bg-black/50 border border-[#00ff66]/20 text-white focus:outline-none focus:ring-2 focus:ring-[#00ff66]/10 focus:border-[#00ff66]/50 hover:border-[#00ff66]/35 transition"
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
                  className="px-4 py-3 rounded-2xl bg-black/50 border border-[#00ff66]/20 text-white focus:outline-none focus:ring-2 focus:ring-[#00ff66]/10 focus:border-[#00ff66]/50 hover:border-[#00ff66]/35 transition"
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
                  className="px-4 py-3 rounded-2xl bg-black/50 border border-[#00ff66]/20 text-white focus:outline-none focus:ring-2 focus:ring-[#00ff66]/10 focus:border-[#00ff66]/50 hover:border-[#00ff66]/35 transition"
                >
                  <option value="all">All Actions</option>
                  {actions.map((action) => (
                    <option key={action} value={action}>
                      {action}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 mt-4">
                <input
                  type="date"
                  value={selectedDate === "all" ? "" : selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value || "all")}
                  className="px-4 py-3 rounded-2xl bg-black/50 border border-[#00ff66]/20 text-white focus:outline-none focus:ring-2 focus:ring-[#00ff66]/10 focus:border-[#00ff66]/50 hover:border-[#00ff66]/35 transition"
                />

                <button
                  onClick={resetFilters}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-red-500/25 bg-red-500/8 text-red-300 hover:bg-red-500/12 transition"
                >
                  <X className="h-4 w-4" />
                  Reset Filters
                </button>
              </div>

              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mt-5 text-sm">
                <div className="text-gray-400">
                  {selectedDate === "all"
                    ? `Showing recent changes from the last ${DEFAULT_RECENT_DAYS} days`
                    : `Showing changes for ${selectedDate}`}
                  {" • "}
                  <span className="text-white font-semibold">
                    {filteredLogs.length}
                  </span>{" "}
                  visible log entries
                </div>

                <div className="inline-flex items-center gap-2 text-gray-500">
                  <CalendarDays className="h-4 w-4" />
                  Latest first
                </div>
              </div>

              {(hasManualFilter || search.trim()) && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {activeFilterChips.map((chip) => (
                    <span
                      key={chip}
                      className="px-3 py-1.5 rounded-full bg-[#00ff66]/10 border border-[#00ff66]/20 text-sm text-[#00ff66]"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] text-left border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-black/90 backdrop-blur-xl border-b border-[#00ff66]/15 text-[#00ff66] text-sm">
                    <th className="p-4 font-semibold">User</th>
                    <th className="p-4 font-semibold">Personnel</th>
                    <th className="p-4 font-semibold">Action</th>
                    <th className="p-4 font-semibold">Details</th>
                    <th className="p-4 font-semibold">Time</th>
                  </tr>
                </thead>

                <tbody>
                  {loadingLogs ? (
                    [...Array(7)].map((_, i) => (
                      <tr
                        key={i}
                        className="border-b border-[#00ff66]/10 odd:bg-black/35 even:bg-black/55"
                      >
                        <td className="p-4">
                          <div className="h-4 w-28 rounded bg-white/5 animate-pulse" />
                        </td>
                        <td className="p-4">
                          <div className="h-4 w-32 rounded bg-white/5 animate-pulse" />
                        </td>
                        <td className="p-4">
                          <div className="h-7 w-32 rounded-full bg-white/5 animate-pulse" />
                        </td>
                        <td className="p-4">
                          <div className="space-y-2">
                            <div className="h-4 w-full rounded bg-white/5 animate-pulse" />
                            <div className="h-4 w-3/4 rounded bg-white/5 animate-pulse" />
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="h-4 w-24 rounded bg-white/5 animate-pulse" />
                        </td>
                      </tr>
                    ))
                  ) : filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-12 text-center">
                        <div className="flex flex-col items-center justify-center text-gray-400">
                          <div className="h-16 w-16 rounded-2xl border border-[#00ff66]/15 bg-black/50 flex items-center justify-center mb-4">
                            <ClipboardList className="h-7 w-7 text-[#00ff66]/60" />
                          </div>
                          <div className="text-lg font-medium text-white">
                            No logs found
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            Try adjusting your filters or search terms
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => {
                      const userName = getUserName(log);
                      const personnelName = log.personnel?.name || "Mommy Doombot";
                      const targetText = formatTarget(log);

                      return (
                        <tr
                          key={log.id}
                          className="border-b border-[#00ff66]/10 odd:bg-black/35 even:bg-black/55 hover:bg-[#00ff66]/8 transition"
                        >
                          <td className="p-4 align-top">
                            <div className="font-medium">{renderName(userName)}</div>
                          </td>

                          <td className="p-4 align-top">
                            <div className="font-medium">{renderName(personnelName)}</div>
                          </td>

                          <td className="p-4 align-top">
                            <div
                              className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border ${getActionClasses(
                                log.action
                              )}`}
                            >
                              {log.action}
                            </div>
                          </td>

                          <td className="p-4 align-top">
                            <div className="max-w-[520px]">
                              <div className="text-[11px] uppercase tracking-[0.16em] text-gray-500 mb-1">
                                Target
                              </div>
                              <div className="text-sm text-gray-300 leading-relaxed break-words">
                                {targetText}
                              </div>
                            </div>
                          </td>

                          <td className="p-4 align-top whitespace-nowrap">
                            <div className="text-sm text-white font-medium">
                              {formatRelativeTime(log.created_at)}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {formatDate(log.created_at)}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="border-t border-[#00ff66]/10 px-6 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-gray-500">
              <div className="inline-flex items-center gap-2">
                <Users className="h-4 w-4" />
                Audit view supports multi-filter review and manual refresh
              </div>

              <div>
                Showing up to <span className="text-white font-medium">200</span> most
                recent matching entries
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}