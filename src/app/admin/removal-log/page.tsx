"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type RemovalLogRow = {
  id: string;
  action: string;
  details: string | null;
  created_at: string;
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

export default function RemovalLogsPage() {
  const router = useRouter();

  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [logs, setLogs] = useState<RemovalLogRow[]>([]);

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
        supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
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
      await fetchLogs();
    };

    checkAccessAndLoad();
  }, [router]);

  const fetchLogs = async () => {
    setLoadingLogs(true);

    const { data, error } = await supabase
      .from("audit_logs")
      .select(`
        id,
        action,
        details,
        created_at,
        user_id,
        processed_by,
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
      return;
    }

    setLogs((data as RemovalLogRow[]) || []);
    setLoadingLogs(false);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString();
  };

  const renderName = (name: string | null | undefined) => {
    if (!name) return <span className="text-gray-400">Unknown</span>;

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

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_center,#001f0f_0%,#000a06_100%)] text-[#00ff66]">
        Checking permissions...
      </div>
    );
  }

  return (
    <div className="min-h-screen p-10 bg-[radial-gradient(circle_at_center,#001f11_0%,#000000_100%)] text-white">
      <button
        onClick={() => router.push("/pcs")}
        className="mb-6 px-4 py-2 rounded-lg border border-[#00ff66]/50 text-[#00ff66] font-semibold hover:bg-[#00ff66]/10 hover:scale-105 transition"
      >
        ← Return to Dashboard
      </button>

      <div className="max-w-7xl mx-auto p-8 rounded-3xl border border-[#00ff66]/30 bg-black/60 backdrop-blur-lg shadow-[0_0_60px_rgba(0,255,100,0.15)]">
        <h1 className="text-3xl font-bold text-[#00ff66] mb-2">
          Personnel Removal Log
        </h1>

        <div className="text-sm text-gray-400 mb-6">
          Showing {logs.length} removal log entries
        </div>

        <button
          onClick={fetchLogs}
          className="mb-6 px-4 py-2 rounded-xl border border-[#00ff66]/40 text-[#00ff66] hover:bg-[#00ff66]/10 transition"
        >
          Refresh Log
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
                    Loading removal logs...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-400">
                      <div className="text-4xl mb-3 opacity-50">📭</div>
                      <div className="text-lg font-medium">No removal logs found</div>
                      <div className="text-sm opacity-60">
                        No PERSONNEL_REMOVED entries are currently available
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const userName =
                    log.processor?.name ||
                    log.profiles?.display_name ||
                    "Mommy Doombot";

                  const personnelName = log.personnel?.name || "Unknown";
                  const detailsText = log.details || "No details recorded";

                  return (
                    <tr
                      key={log.id}
                      className="border-b border-[#00ff66]/10 odd:bg-black/40 even:bg-black/60 hover:bg-[#00ff66]/10 transition"
                    >
                      <td className="p-3">{renderName(userName)}</td>
                      <td className="p-3">{renderName(personnelName)}</td>

                      <td className="p-3">
                        <span className="px-3 py-1 rounded-full text-xs font-semibold text-red-300 bg-red-500/10 border border-red-500/30">
                          {log.action}
                        </span>
                      </td>

                      {/* ✅ UPDATED: no glow box */}
                      <td className="p-3 text-sm text-gray-300">
                        {detailsText}
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