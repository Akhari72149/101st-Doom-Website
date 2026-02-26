"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ServerControlPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [servers, setServers] = useState<any[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<number, boolean>>(
    {}
  );

  /* ================= AUTH + ROLE CHECK ================= */

  useEffect(() => {
    const checkAccess = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/");
        return;
      }

      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const userRoles = data?.map((r) => r.role) || [];

      if (!userRoles.includes("server-control")) {
        router.replace("/");
        return;
      }

      setLoading(false);
    };

    checkAccess();
  }, []);

  /* ================= FETCH SERVER STATUS ================= */

  const fetchServerStatus = async () => {
    try {
      const res = await fetch("/api/server-status");
      const data = await res.json();

      setServers(data);
      setLoadingStatus(false);
    } catch (err) {
      console.error("Failed fetching server status", err);
    }
  };

  /* ================= POLLING ================= */

  useEffect(() => {
    fetchServerStatus();

    const interval = setInterval(() => {
      fetchServerStatus();
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  /* ================= ACTIONS ================= */

  const handleStart = async (serverId: number) => {
    setActionLoading((prev) => ({ ...prev, [serverId]: true }));

    await fetch("/api/server/start", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  credentials: "include",
  body: JSON.stringify({ serverId }),
});

    setTimeout(fetchServerStatus, 3000);
  };

  const handleStop = async (serverId: number) => {
    setActionLoading((prev) => ({ ...prev, [serverId]: true }));

    await fetch("/api/server/stop", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  credentials: "include", // REQUIRED
  body: JSON.stringify({ serverId }),
});

    setTimeout(fetchServerStatus, 3000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[#00ff66] bg-black">
        Checking Permissions...
      </div>
    );
  }

  /* ================= UI ================= */

  return (
    <div className="relative min-h-screen text-white font-orbitron overflow-hidden">

      {/* BACKGROUND */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#001f11_0%,#000000_100%)]" />

      {/* GLOW OVERLAY */}
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(circle_at_25%_25%,#00ff66,transparent_70%)]" />

      <div className="relative z-10 p-12 max-w-7xl mx-auto">

        {/* HEADER */}
        <div className="flex justify-between items-center mb-12">
          <h1 className="text-4xl tracking-[0.3em] text-[#00ff66] font-bold">
            SERVER CONTROL
          </h1>

          <button
            onClick={() => router.push("/")}
            className="px-6 py-2 border border-[#00ff66] rounded-xl
                       text-[#00ff66] hover:bg-[#00ff66]
                       hover:text-black transition-all"
          >
            ← Home
          </button>
        </div>

        {loadingStatus ? (
          <div className="text-[#00ff66]">Loading Server Status...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">

            {servers.map((server: any) => (
              <div
                key={server.id}
                className="rounded-3xl p-8 bg-black/60 backdrop-blur-xl
                           border border-[#00ff66]/30
                           shadow-[0_0_30px_rgba(0,255,102,0.15)]
                           hover:border-[#00ff66]
                           transition-all duration-300"
              >

                {/* SERVER HEADER */}
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl text-[#00ff66]">
                    Server {server.id}
                  </h2>

                  <div
                    className={`px-3 py-1 rounded-full text-xs tracking-widest ${
                      server.online
                        ? "bg-green-500/20 text-green-400"
                        : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {server.online ? "ONLINE" : "OFFLINE"}
                  </div>
                </div>

                {/* ACTION BUTTONS */}
                <div className="flex gap-4">

                  {/* START */}
                  <button
                    onClick={() => handleStart(server.id)}
                    disabled={server.online || actionLoading[server.id]}
                    className={`flex-1 px-4 py-3 rounded-xl transition-all ${
                      server.online
                        ? "opacity-30 cursor-not-allowed"
                        : "border border-green-500 text-green-400 hover:bg-green-500 hover:text-black"
                    }`}
                  >
                    {actionLoading[server.id] && !server.online
                      ? "Starting..."
                      : "Start"}
                  </button>

                  {/* STOP */}
                  <button
                    onClick={() => handleStop(server.id)}
                    disabled={!server.online || actionLoading[server.id]}
                    className={`flex-1 px-4 py-3 rounded-xl transition-all ${
                      !server.online
                        ? "opacity-30 cursor-not-allowed"
                        : "border border-red-500 text-red-400 hover:bg-red-500 hover:text-black"
                    }`}
                  >
                    {actionLoading[server.id] && server.online
                      ? "Stopping..."
                      : "Stop"}
                  </button>

                </div>

                {/* SERVER STATUS FEEDBACK */}
                {actionLoading[server.id] && !server.online && (
                  <div className="mt-4 text-yellow-400 text-sm animate-pulse">
                    Server Coming Online...
                  </div>
                )}

              </div>
            ))}

          </div>
        )}
      </div>
    </div>
  );
}