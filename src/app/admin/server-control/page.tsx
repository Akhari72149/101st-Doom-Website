"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Server } from "lucide-react";

type ServerType = {
  id: number;
  online: boolean;
  players: number;
  maxPlayers: number;
  playerList?: string[];
  missionFile?: string;
};

export default function ServerControl() {
  const router = useRouter();

  const [loadingAuth, setLoadingAuth] = useState(true);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<ServerType[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [startingServerId, setStartingServerId] = useState<number | null>(null);

  // ✅ NEW STATES
  const [actionLoading, setActionLoading] = useState<{
    serverId: number | null;
    action: "start" | "stop" | null;
  }>({ serverId: null, action: null });

  const [pollingPaused, setPollingPaused] = useState(false);

  const getServerStatus = (serverId: number) => {
    return serverStatus.find((s) => s.id === serverId);
  };

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

      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const roleList = data?.map((r) => r.role) || [];

      if (
        !roleList.includes("ServerMaintenance") &&
        !roleList.includes("Akhari")
      ) {
        router.replace("/");
        return;
      }

      setRoles(roleList);
      setLoadingAuth(false);
    };

    checkAccess();
  }, [router]);

  /* ================= SERVER COMMAND ================= */

  const sendCommand = async (
  command: string,
  serverId: number,
  action: "start" | "stop"
) => {
  try {
    setActionLoading({ serverId, action });

    // ✅ Always send the command FIRST
    await fetch("/api/server-control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command }),
    });

    // ✅ AFTER command succeeds → enable watcher
    if (action === "start") {
      setPollingPaused(true);
      setStartingServerId(serverId);
      watchServerUntilOnline(serverId);
    }

    if (action === "stop") {
      setPollingPaused(true);
      setStartingServerId(serverId);
      watchServerUntilOffline(serverId);
    }

  } catch (err) {
    console.error(err);
    alert("Failed to send server command");
  }

  setActionLoading({ serverId: null, action: null });
};

  /* Better checking of status after start is pressed*/

  const watchServerUntilOnline = (serverId: number) => {
  const interval = setInterval(async () => {
    try {
      const res = await fetch("/api/server-status");
      const data = await res.json();

      const updated = data.find((s: ServerType) => s.id === serverId);

      if (updated?.online) {
        
        setStartingServerId(null);
        setPollingPaused(false);
        clearInterval(interval);

        
        fetchServers();
      }
    } catch (err) {
      console.error("Auto detect polling failed", err);
    }
  }, 3000);

  return interval;
};

/* ================= Watch until offline ================= */

const watchServerUntilOffline = (serverId: number) => {
  const interval = setInterval(async () => {
    try {
      const res = await fetch("/api/server-status");
      const data = await res.json();

      const updated = data.find((s: ServerType) => s.id === serverId);

      if (!updated?.online) {
        // Server is finally offline
        setStartingServerId(null);
        setPollingPaused(false);
        clearInterval(interval);

        fetchServers();
      }
    } catch (err) {
      console.error("Offline auto-check failed", err);
    }
  }, 3000);

  return interval;
};

  /* ================= SERVER STATUS ================= */

  const fetchServers = async (isInitial = false) => {
    if (pollingPaused) return;

    try {
      const res = await fetch("/api/server-status");
      const data = await res.json();

      setServerStatus(data);
    } catch (err) {
      console.error("Server fetch failed", err);
    }

    if (isInitial) {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    fetchServers(true);

    const interval = setInterval(() => {
      if (!pollingPaused) {
        fetchServers(false);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [pollingPaused]);

  /* ================= Effect Cleanup ================= */

useEffect(() => {
  return () => {
    setStartingServerId(null);
    setPollingPaused(false);
  };
}, []);

  /* ================= SERVER LIST ================= */

  const servers = [
    { id: 1, name: "Server 1" },
    { id: 2, name: "Server 2" },
    { id: 3, name: "Server 3" },
    { id: 4, name: "Server 4" },
    { id: 5, name: "Server 5" },
  ];

  return (
    <div className="min-h-screen p-10 bg-[radial-gradient(circle_at_center,#001f11_0%,#000000_100%)] text-white">

      <button
        onClick={() => router.push("/")}
        className="mb-6 px-4 py-2 rounded-lg border border-[#00ff66]/50 text-[#00ff66] font-semibold hover:bg-[#00ff66]/10 transition"
      >
        ← Return to Dashboard
      </button>

      <div className="max-w-6xl mx-auto p-8 rounded-3xl border border-[#00ff66]/20 bg-black/60 backdrop-blur-xl">
        <h1 className="text-3xl font-bold mb-10 text-[#00ff66] flex items-center gap-3">
          <Server size={28} />
          Server Control Panel
        </h1>

        {/* ================= SERVER CARDS ================= */}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {servers.map((server) => {
            const status = getServerStatus(server.id);

            return (
              <div
                key={server.id}
                className={`p-6 rounded-2xl border border-[#00ff66]/20 bg-black/50 flex justify-between items-center hover:border-[#00ff66] transition ${
                  startingServerId === server.id
                  ? status?.online
                  ? "animate-pulse border-green-400 shadow-[0_0_20px_rgba(0,255,100,0.6)]"
                 : "animate-pulse border-red-500 shadow-[0_0_20px_rgba(255,0,0,0.6)]"
               : ""
              }`}
              >
                <div>
                  <h2
                     className={`text-xl font-semibold ${
                                status?.online
                              ? "text-green-400"
                              : status
                              ? "text-red-500"
                              : "text-gray-400"
                             }`}
                            >
                         {server.name}
                    </h2>

                  {initialLoading && !status ? (
                    <p className="text-sm text-gray-400 mt-2">
                      Loading status...
                    </p>
                  ) : status ? (
                    <div className="mt-2 text-sm">
                      <p className="text-gray-300">
                        Players: {status.players ?? 0} / {status.maxPlayers ?? "?"}
                      </p>

                      <p
                        className={`font-semibold ${
                          status.online
                            ? "text-green-400"
                            : "text-red-500"
                        }`}
                      >
                        {status.online ? "🟢 Online" : "🔴 Offline"}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 mt-2">
                      No status data
                    </p>
                  )}
                </div>

                <div className="flex gap-3">
                  {/* ✅ Show Start ONLY if Offline */}
                  {!status?.online && (
                    <button
                      onClick={() =>
                        sendCommand(`start server ${server.id}`, server.id, "start")
                      }
                      disabled={
                        actionLoading.serverId === server.id
                      }
                      className="px-4 py-2 rounded-lg border border-green-500 text-green-400 hover:bg-green-600 hover:text-black transition"
                    >
                      {actionLoading.serverId === server.id &&
                      actionLoading.action === "start" ? (
                      <div className="flex items-center gap-2">
                       <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                       <span>Starting</span>
                     </div>
                    ) : (
                    "Start"
                    )}
                    </button>
                  )}

                  {/* ✅ Show Stop ONLY if Online */}
                  {status?.online && (
                    <button
                      onClick={() =>
                        sendCommand(`stop server ${server.id}`, server.id, "stop")
                      }
                      disabled={
                        actionLoading.serverId === server.id
                      }
                      className="px-4 py-2 rounded-lg border border-red-500 text-red-400 hover:bg-red-600 hover:text-black transition"
                    >
                      {actionLoading.serverId === server.id &&
actionLoading.action === "stop" ? (
  <div className="flex items-center gap-2">
    <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
    <span>Stopping</span>
  </div>
) : (
  "Stop"
)}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}