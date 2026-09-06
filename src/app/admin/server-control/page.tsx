"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getAppAuthHeaders, getAppSession, hasAppPermission } from "@/lib/client-auth";
import { useRouter } from "next/navigation";
import {
  Activity,
  CalendarClock,
  ChevronRight,
  Server,
  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react";

type ServerType = {
  id: number;
  online: boolean;
  players: number;
  maxPlayers: number;
  playerList?: string[];
  missionFile?: string;
};

type ServerCardConfig = {
  id: number;
  name: string;
};

export default function ServerControl() {
  const router = useRouter();

  const [loadingAuth, setLoadingAuth] = useState(true);
  const [roles, setRoles] = useState<string[]>([]);
  const [serverStatus, setServerStatus] = useState<ServerType[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [startingServerId, setStartingServerId] = useState<number | null>(null);

  const [actionLoading, setActionLoading] = useState<{
    [key: number]: "start" | "stop" | null;
  }>({});

  const [pollingPaused, setPollingPaused] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const watchIntervalRef = useRef<number | null>(null);

  const servers: ServerCardConfig[] = [
    { id: 1, name: "Server 1" },
    { id: 2, name: "Server 2" },
    { id: 3, name: "Server 3" },
    { id: 4, name: "Server 4" },
    { id: 5, name: "Server 5" },
  ];

  const getServerStatus = (serverId: number) => {
    return serverStatus.find((s) => s.id === serverId);
  };

  const stats = useMemo(() => {
    const online = serverStatus.filter((s) => s.online).length;
    const offline = serverStatus.length - online;
    const totalPlayers = serverStatus.reduce((sum, s) => sum + (s.players || 0), 0);
    const maxPlayers = serverStatus.reduce((sum, s) => sum + (s.maxPlayers || 0), 0);

    return {
      online,
      offline,
      totalPlayers,
      maxPlayers,
    };
  }, [serverStatus]);

  useEffect(() => {
    const checkAccess = async () => {
      const session = await getAppSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      const roleList = session.roles;
      const legacyAccess = roleList.some((role) => ["servermaintenance", "akhari"].includes(role.toLowerCase()));
      if (!legacyAccess && !hasAppPermission(session, "admin.server-control", "read")) {
        router.replace("/");
        return;
      }

      setRoles(roleList);
      setLoadingAuth(false);
    };

    checkAccess();
  }, [router]);

  const clearWatchInterval = () => {
    if (watchIntervalRef.current) {
      window.clearInterval(watchIntervalRef.current);
      watchIntervalRef.current = null;
    }
  };

  const watchServerUntilOnline = (serverId: number) => {
    clearWatchInterval();

    watchIntervalRef.current = window.setInterval(async () => {
      try {
        const res = await fetch("/api/server-status");
        const data = await res.json();

        const updated = data.find((s: ServerType) => s.id === serverId);

        if (updated?.online) {
          clearWatchInterval();
          setStartingServerId(null);
          setPollingPaused(false);
          fetchServers();
        }
      } catch (err) {
        console.error("Auto detect polling failed", err);
      }
    }, 3000);
  };

  const watchServerUntilOffline = (serverId: number) => {
    clearWatchInterval();

    watchIntervalRef.current = window.setInterval(async () => {
      try {
        const res = await fetch("/api/server-status");
        const data = await res.json();

        const updated = data.find((s: ServerType) => s.id === serverId);

        if (!updated?.online) {
          clearWatchInterval();
          setStartingServerId(null);
          setPollingPaused(false);
          fetchServers();
        }
      } catch (err) {
        console.error("Offline auto-check failed", err);
      }
    }, 3000);
  };

  const fetchServers = async (isInitial = false) => {
    if (pollingPaused) return;

    try {
      const res = await fetch("/api/server-status");
      const data = await res.json();
      setServerStatus(data);
      setLastUpdated(new Date().toLocaleTimeString());
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

    return () => {
      clearInterval(interval);
      clearWatchInterval();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollingPaused]);

  useEffect(() => {
    return () => {
      clearWatchInterval();
      setStartingServerId(null);
      setPollingPaused(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendCommand = async (
    command: string,
    serverId: number,
    action: "start" | "stop"
  ) => {
    try {
      setActionLoading((prev) => ({
        ...prev,
        [serverId]: action,
      }));

      const res = await fetch("/api/server-control", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getAppAuthHeaders()) },
        body: JSON.stringify({ command }),
      });

      if (!res.ok) {
        console.error("Server command failed:", await res.text());
      }

      setPollingPaused(true);
      setStartingServerId(serverId);

      if (action === "start") {
        watchServerUntilOnline(serverId);
      } else {
        watchServerUntilOffline(serverId);
      }
    } catch (err) {
      console.error("Command request error:", err);
      setPollingPaused(false);
      setStartingServerId(null);
    } finally {
      setActionLoading((prev) => ({
        ...prev,
        [serverId]: null,
      }));
    }
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_center,#001f11_0%,#000000_100%)] text-[#00ff66]">
        Checking permissions...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_center,#001f11_0%,#000000_100%)] px-4 py-6 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1700px]">
        <button
          onClick={() => router.push("/")}
          className="mb-6 inline-flex items-center gap-2 rounded-xl border border-[#00ff66]/50 px-4 py-2 font-semibold text-[#00ff66] transition hover:scale-105 hover:bg-[#00ff66]/10"
        >
          ← Return to Dashboard
        </button>

        <div className="mb-8">
          <div className="text-xs uppercase tracking-[0.4em] text-[#7da28c]">
            Server Operations
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="flex items-center gap-3 text-4xl font-bold tracking-[0.25em] text-[#00ff66]">
              <Server size={28} />
              SERVER CONTROL
            </h1>

            {roles.length > 0 && (
              <span className="rounded-full border border-[#00ff66]/40 bg-[#00ff66]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#00ff66]">
                Privileged Access
              </span>
            )}
          </div>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#8ba593]">
            Monitor live server status, start or stop individual instances, and keep track
            of player load in a cleaner command-console layout.
          </p>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
          <SummaryCard
            icon={<Activity className="h-4 w-4" />}
            label="Online"
            value={String(stats.online)}
            accent="green"
          />
          <SummaryCard
            icon={<ShieldAlert className="h-4 w-4" />}
            label="Offline"
            value={String(stats.offline)}
            accent="red"
          />
          <SummaryCard
            icon={<Users className="h-4 w-4" />}
            label="Players"
            value={`${stats.totalPlayers}`}
            subValue={`/ ${stats.maxPlayers || "?"}`}
          />
          <SummaryCard
            icon={<CalendarClock className="h-4 w-4" />}
            label="Polling"
            value={pollingPaused ? "Paused" : "Active"}
            subValue={lastUpdated ? `Updated ${lastUpdated}` : "Waiting for data"}
          />
        </div>

        <div className="mb-8 rounded-3xl border border-[#00ff66]/20 bg-black/55 p-5 backdrop-blur-xl shadow-[0_0_35px_rgba(0,255,100,0.08)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.25em] text-[#7fa28c]">
                Live Status
              </div>
              <h2 className="mt-2 text-xl font-bold text-[#00ff66]">
                {initialLoading ? "Loading server data..." : "Realtime monitoring enabled"}
              </h2>
            </div>

            <div className="flex flex-wrap gap-2">
              <StatusChip label="Auto Refresh" active={!pollingPaused} />
              <StatusChip label="Watch Mode" active={startingServerId !== null} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 2xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-[#7f9f8f]">
                  Server Rack
                </div>
                <div className="mt-1 text-2xl font-bold text-[#00ff66]">
                  Monitoring {servers.length} servers
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-gray-300">
                {stats.totalPlayers} players connected
              </div>
            </div>

            <div className="rounded-3xl border border-[#00ff66]/25 bg-black/35 p-4 shadow-[0_0_30px_rgba(0,255,100,0.06)]">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {servers.map((server) => {
                  const status = getServerStatus(server.id);
                  const isBusy = startingServerId === server.id;
                  const loadingAction = actionLoading[server.id];

                  return (
                    <div
                      key={server.id}
                      className={`rounded-3xl border p-5 transition-all duration-300 ${
                        isBusy
                          ? status?.online
                            ? "border-green-400/60 bg-green-500/10 shadow-[0_0_24px_rgba(0,255,100,0.22)]"
                            : "border-red-500/60 bg-red-500/10 shadow-[0_0_24px_rgba(255,0,0,0.2)]"
                          : "border-[#00ff66]/20 bg-black/45 hover:border-[#00ff66]/45"
                      }`}
                    >
                      <div className="mb-4 flex items-start justify-between gap-4">
                        <div>
                          <div className="text-[11px] uppercase tracking-[0.18em] text-[#7f9f8f]">
                            Server Node
                          </div>
                          <h3 className="mt-1 text-2xl font-bold text-white">
                            {server.name}
                          </h3>
                        </div>

                        <StatusBadge
                          online={status?.online ?? false}
                          loading={initialLoading && !status}
                        />
                      </div>

                      {initialLoading && !status ? (
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-gray-400">
                          Loading status...
                        </div>
                      ) : status ? (
                        <>
                          <div className="grid grid-cols-2 gap-3">
                            <InfoTile
                              label="Players"
                              value={`${status.players ?? 0}`}
                              sub={`Max ${status.maxPlayers ?? "?"}`}
                            />
                            <InfoTile
                              label="State"
                              value={status.online ? "Online" : "Offline"}
                              sub={status.online ? "Accepting joins" : "Not reachable"}
                            />
                          </div>

                          <div className="mt-4 rounded-2xl border border-white/10 bg-black/35 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-sm font-semibold text-[#00ff66]">
                                Connection Health
                              </div>
                              <div className="text-xs uppercase tracking-[0.16em] text-gray-400">
                                Live
                              </div>
                            </div>

                            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  status.online ? "w-[72%] bg-[#00ff66]" : "w-[18%] bg-red-500"
                                }`}
                              />
                            </div>

                            <div className="mt-3 text-sm text-gray-300">
                              {status.online
                                ? `${status.players ?? 0} players currently connected.`
                                : "Server currently offline."}
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-gray-400">
                          No status data
                        </div>
                      )}

                      <div className="mt-5 flex justify-end">
                        {!status?.online ? (
                          <button
                            onClick={() =>
                              sendCommand(`start server ${server.id}`, server.id, "start")
                            }
                            disabled={!!loadingAction}
                            className="inline-flex items-center gap-2 rounded-xl border border-green-500 px-4 py-3 font-semibold text-green-400 transition hover:bg-green-600 hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {loadingAction === "start" ? (
                              <>
                                <Spinner />
                                Starting
                              </>
                            ) : (
                              <>
                                Start
                                <ChevronRight className="h-4 w-4" />
                              </>
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={() =>
                              sendCommand(`stop server ${server.id}`, server.id, "stop")
                            }
                            disabled={!!loadingAction}
                            className="inline-flex items-center gap-2 rounded-xl border border-red-500 px-4 py-3 font-semibold text-red-400 transition hover:bg-red-600 hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {loadingAction === "stop" ? (
                              <>
                                <Spinner />
                                Stopping
                              </>
                            ) : (
                              <>
                                Stop
                                <ChevronRight className="h-4 w-4" />
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <aside className="min-w-0 2xl:sticky 2xl:top-4 2xl:self-start">
            <div className="rounded-3xl border border-[#00ff66]/25 bg-black/55 p-6 backdrop-blur-xl shadow-[0_0_35px_rgba(0,255,100,0.08)]">
              <div className="mb-5">
                <div className="text-xs uppercase tracking-[0.25em] text-[#7f9f8f]">
                  Control Notes
                </div>
                <h2 className="mt-2 text-2xl font-bold text-[#00ff66]">
                  Command Guidance
                </h2>
              </div>

              <div className="space-y-4">
                <NoteCard
                  title="Start / Stop"
                  text="Only one action runs per server at a time. The relevant card will glow while polling checks for the new state."
                />
                <NoteCard
                  title="Polling"
                  text="The page refreshes status every 10 seconds unless a start/stop watch is active."
                />
                <NoteCard
                  title="Access"
                  text="This panel is limited to ServerMaintenance and Akhari roles."
                />
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#00ff66]">
                  <Sparkles className="h-4 w-4" />
                  Quick View
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <MiniStat label="Online" value={stats.online} />
                  <MiniStat label="Offline" value={stats.offline} />
                  <MiniStat label="Players" value={stats.totalPlayers} />
                  <MiniStat label="Cards" value={servers.length} />
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-black/35 p-4 text-sm leading-7 text-gray-300">
                When a server is started or stopped, the associated card remains highlighted
                until the status endpoint confirms the change.
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
  );
}

function StatusChip({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
        active
          ? "border-[#00ff66]/40 bg-[#00ff66]/10 text-[#00ff66]"
          : "border-white/10 bg-white/[0.03] text-gray-400"
      }`}
    >
      {label}
    </span>
  );
}

function StatusBadge({
  online,
  loading,
}: {
  online: boolean;
  loading: boolean;
}) {
  if (loading) {
    return (
      <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">
        Loading
      </span>
    );
  }

  return (
    <span
      className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
        online
          ? "border-green-400/30 bg-green-500/10 text-green-300"
          : "border-red-400/30 bg-red-500/10 text-red-300"
      }`}
    >
      {online ? "Online" : "Offline"}
    </span>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  subValue,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
  accent?: "green" | "red";
}) {
  const accentClass =
    accent === "green"
      ? "text-[#00ff66]"
      : accent === "red"
      ? "text-red-300"
      : "text-white";

  return (
    <div className="rounded-2xl border border-[#00ff66]/20 bg-black/35 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] uppercase tracking-[0.18em] text-[#7f9f8f]">
          {label}
        </div>
        <div className={accentClass}>{icon}</div>
      </div>
      <div className={`mt-2 text-2xl font-bold ${accentClass}`}>{value}</div>
      {subValue && <div className="mt-1 text-xs text-gray-400">{subValue}</div>}
    </div>
  );
}

function InfoTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[#7f9f8f]">
        {label}
      </div>
      <div className="mt-1 text-lg font-bold text-white">{value}</div>
      <div className="mt-1 text-xs text-gray-400">{sub}</div>
    </div>
  );
}

function NoteCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
      <div className="text-sm font-semibold text-[#00ff66]">{title}</div>
      <p className="mt-2 text-sm leading-6 text-gray-300">{text}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/35 p-3">
      <div className="text-[10px] uppercase tracking-[0.14em] text-gray-500">
        {label}
      </div>
      <div className="mt-1 text-lg font-bold text-white">{value}</div>
    </div>
  );
}
