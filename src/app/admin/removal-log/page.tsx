"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { RefreshCw, Search, ShieldAlert, Trash2, CalendarDays } from "lucide-react";

type JoinedDisplayName =
  | { display_name: string | null }
  | { display_name: string | null }[]
  | null
  | undefined;

type JoinedName =
  | { name: string | null }
  | { name: string | null }[]
  | null
  | undefined;

type RemovalLogRowRaw = {
  id: string;
  action: string;
  details: string | null;
  created_at: string;
  user_id: string | null;
  processed_by: string | null;
  target_personnel_id: string | null;
  profiles?: JoinedDisplayName;
  processor?: JoinedName;
  personnel?: JoinedName;
};

type RemovalLogRow = {
  id: string;
  action: string;
  details: string | null;
  created_at: string;
  user_id: string | null;
  processed_by: string | null;
  target_personnel_id: string | null;
  profiles?: {
    display_name: string | null;
  } | null;
  processor?: {
    name: string | null;
  } | null;
  personnel?: {
    name: string | null;
  } | null;
};

type TimeFilter = "all" | "today" | "7d" | "30d";

function normaliseDisplayNameRelation(
  value: JoinedDisplayName
): { display_name: string | null } | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function normaliseNameRelation(
  value: JoinedName
): { name: string | null } | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export default function RemovalLogsPage() {
  const router = useRouter();

  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [logs, setLogs] = useState<RemovalLogRow[]>([]);
  const [search, setSearch] = useState("");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");

  useEffect(() => {
    const checkAccessAndLoad = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const [{ data: roles }, { data: profile }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase
          .from("profiles")
          .select("display_name")
          .eq("id", user.id)
          .maybeSingle(),
      ]);

      const roleList = roles?.map((r) => r.role?.toLowerCase()) || [];
      const displayName = profile?.display_name?.trim().toLowerCase() || "";

      const allowedRoles = ["recruiter", "nco", "admin", "akhari"];
      const hasAllowedRole = roleList.some((role) => allowedRoles.includes(role));
      const isAkhariByName = displayName === "akhari";

      if (!hasAllowedRole && !isAkhariByName) {
        router.replace("/");
        return;
      }

      setLoadingAuth(false);
      await fetchLogs(false);
    };

    checkAccessAndLoad();
  }, [router]);

  const fetchLogs = async (isManualRefresh = true) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoadingLogs(true);

    const { data, error } = await supabase
      .from("audit_logs")
      .select(`
        id,
        action,
        details,
        created_at,
        user_id,
        processed_by,
        target_personnel_id,
        profiles:user_id ( display_name ),
        processor:processed_by ( name ),
        personnel:target_personnel_id ( name )
      `)
      .eq("action", "PERSONNEL_REMOVED")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      alert(error.message);
      setLogs([]);
      setLoadingLogs(false);
      setRefreshing(false);
      return;
    }

    const cleanedLogs: RemovalLogRow[] = ((data || []) as RemovalLogRowRaw[]).map(
      (log) => ({
        id: log.id,
        action: log.action,
        details: log.details,
        created_at: log.created_at,
        user_id: log.user_id,
        processed_by: log.processed_by,
        target_personnel_id: log.target_personnel_id,
        profiles: normaliseDisplayNameRelation(log.profiles),
        processor: normaliseNameRelation(log.processor),
        personnel: normaliseNameRelation(log.personnel),
      })
    );

    setLogs(cleanedLogs);
    setLoadingLogs(false);
    setRefreshing(false);
  };

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

  const renderName = (name: string | null | undefined) => {
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

  const isWithinFilter = (dateString: string, filter: TimeFilter) => {
    if (filter === "all") return true;

    const now = new Date();
    const target = new Date(dateString);

    if (filter === "today") {
      return target.toDateString() === now.toDateString();
    }

    if (filter === "7d") {
      const threshold = new Date();
      threshold.setDate(now.getDate() - 7);
      return target >= threshold;
    }

    if (filter === "30d") {
      const threshold = new Date();
      threshold.setDate(now.getDate() - 30);
      return target >= threshold;
    }

    return true;
  };

  const filteredLogs = useMemo(() => {
    const term = search.trim().toLowerCase();

    return logs.filter((log) => {
      const userName =
        log.processor?.name ||
        log.profiles?.display_name ||
        "Mommy Doombot";

      const personnelName = log.personnel?.name || "Unknown";
      const detailsText = log.details || "";
      const actionText = log.action || "";

      const matchesSearch =
        !term ||
        userName.toLowerCase().includes(term) ||
        personnelName.toLowerCase().includes(term) ||
        detailsText.toLowerCase().includes(term) ||
        actionText.toLowerCase().includes(term);

      const matchesTime = isWithinFilter(log.created_at, timeFilter);

      return matchesSearch && matchesTime;
    });
  }, [logs, search, timeFilter]);

  const stats = useMemo(() => {
    const now = new Date();

    const total = logs.length;

    const today = logs.filter((log) => {
      const created = new Date(log.created_at);
      return created.toDateString() === now.toDateString();
    }).length;

    const last7Days = logs.filter((log) => {
      const created = new Date(log.created_at);
      const threshold = new Date();
      threshold.setDate(now.getDate() - 7);
      return created >= threshold;
    }).length;

    return { total, today, last7Days };
  }, [logs]);

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_center,#001f0f_0%,#000a06_100%)] text-[#00ff66]">
        Checking permissions...
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
                    <div className="h-12 w-12 rounded-2xl border border-red-500/25 bg-red-500/10 flex items-center justify-center shadow-[0_0_25px_rgba(239,68,68,0.18)]">
                      <ShieldAlert className="h-6 w-6 text-red-400" />
                    </div>
                    <div>
                      <h1 className="text-3xl sm:text-4xl font-bold text-[#00ff66] tracking-tight">
                        Personnel Removal Log
                      </h1>
                      <p className="text-sm sm:text-base text-gray-400 mt-1">
                        Track personnel removals, responsible users, and recorded audit details
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
                  Refresh Log
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
                <div className="rounded-2xl border border-[#00ff66]/15 bg-black/40 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-2">
                    Total Removals
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
                    Last 7 Days
                  </div>
                  <div className="text-3xl font-bold text-white">{stats.last7Days}</div>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-8 border-b border-[#00ff66]/10">
              <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
                <div className="relative w-full lg:max-w-xl">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#00ff66]/70" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search user, personnel, action or details..."
                    className="w-full pl-11 pr-4 py-3 rounded-2xl border border-[#00ff66]/20 bg-black/50 text-white placeholder:text-gray-500 outline-none focus:border-[#00ff66]/50 focus:ring-2 focus:ring-[#00ff66]/10 transition"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  {[
                    { key: "all", label: "All" },
                    { key: "today", label: "Today" },
                    { key: "7d", label: "7 Days" },
                    { key: "30d", label: "30 Days" },
                  ].map((filter) => {
                    const active = timeFilter === filter.key;
                    return (
                      <button
                        key={filter.key}
                        onClick={() => setTimeFilter(filter.key as TimeFilter)}
                        className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition ${
                          active
                            ? "border-[#00ff66]/50 bg-[#00ff66]/12 text-[#00ff66]"
                            : "border-[#00ff66]/15 bg-black/40 text-gray-300 hover:border-[#00ff66]/30 hover:text-white"
                        }`}
                      >
                        {filter.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 text-sm">
                <div className="text-gray-400">
                  Showing{" "}
                  <span className="text-white font-semibold">
                    {filteredLogs.length}
                  </span>{" "}
                  matching log entries
                </div>

                <div className="inline-flex items-center gap-2 text-gray-500">
                  <CalendarDays className="h-4 w-4" />
                  Latest first
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left border-collapse">
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
                    [...Array(6)].map((_, i) => (
                      <tr
                        key={i}
                        className="border-b border-[#00ff66]/10 odd:bg-black/35 even:bg-black/50"
                      >
                        <td className="p-4">
                          <div className="h-4 w-28 rounded bg-white/5 animate-pulse" />
                        </td>
                        <td className="p-4">
                          <div className="h-4 w-32 rounded bg-white/5 animate-pulse" />
                        </td>
                        <td className="p-4">
                          <div className="h-7 w-28 rounded-full bg-red-500/10 animate-pulse" />
                        </td>
                        <td className="p-4">
                          <div className="space-y-2">
                            <div className="h-4 w-full rounded bg-white/5 animate-pulse" />
                            <div className="h-4 w-4/5 rounded bg-white/5 animate-pulse" />
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
                            <Trash2 className="h-7 w-7 text-[#00ff66]/60" />
                          </div>
                          <div className="text-lg font-medium text-white">
                            No removal logs found
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            Try changing the search or time filter
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => {
                      const userName =
                        log.processor?.name ||
                        log.profiles?.display_name ||
                        "Mommy Doombot";

                      const personnelName = log.personnel?.name || "Unknown";
                      const detailsText = log.details || "No details recorded";

                      return (
                        <tr
                          key={log.id}
                          className="border-b border-[#00ff66]/10 odd:bg-black/35 even:bg-black/55 hover:bg-[#00ff66]/08 transition"
                        >
                          <td className="p-4 align-top">
                            <div className="font-medium">
                              {renderName(userName)}
                            </div>
                          </td>

                          <td className="p-4 align-top">
                            <div className="font-medium">
                              {renderName(personnelName)}
                            </div>
                          </td>

                          <td className="p-4 align-top">
                            <div className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold text-red-300 bg-red-500/10 border border-red-500/25">
                              Removed
                            </div>
                            <div className="text-[11px] text-gray-500 mt-2 tracking-wide">
                              {log.action}
                            </div>
                          </td>

                          <td className="p-4 align-top">
                            <div className="text-sm text-gray-300 leading-relaxed max-w-[520px] break-words">
                              {detailsText}
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
          </div>
        </div>
      </div>
    </div>
  );
}