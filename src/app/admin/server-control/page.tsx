"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getAppAuthHeaders, getAppSession, hasAppPermission } from "@/lib/client-auth";
import { useRouter } from "next/navigation";
import {
  Activity,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Download,
  PackagePlus,
  RefreshCw,
  Server,
  Settings2,
  ShieldAlert,
  Sparkles,
  Terminal,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { battalionServers } from "@/data/servers";

type ServerType = {
  id: number;
  online: boolean;
  players: number;
  maxPlayers: number;
  playerList?: string[];
  missionFile?: string;
};

type ControlJob = {
  id: string;
  server_id: number | null;
  action: string;
  status: "pending" | "processing" | "succeeded" | "failed" | "cancelled";
  requested_by_name: string;
  attempts: number;
  error_message: string | null;
  requested_at: string;
  updated_at: string;
  logs: Array<{ id: number; level: string; message: string; createdAt: string }>;
};

type ControlActivity = {
  mode: "legacy" | "agent";
  agent: null | {
    id: string;
    display_name: string;
    version: string | null;
    status: string;
    last_seen_at: string | null;
    online: boolean;
  };
  jobs: ControlJob[];
  presets?: ModPreset[];
};

type ModPreset = {
  key: "main" | "fun";
  displayName: string;
  modIds: string[];
  modNames: Record<string, string>;
  updatedBy: string | null;
  updatedAt: string;
};

export default function ServerControl() {
  const router = useRouter();

  const [loadingAuth, setLoadingAuth] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [canFull, setCanFull] = useState(false);
  const [roles, setRoles] = useState<string[]>([]);
  const [serverStatus, setServerStatus] = useState<ServerType[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [startingServerId, setStartingServerId] = useState<number | null>(null);

  const [actionLoading, setActionLoading] = useState<{
    [key: number]: "start" | "stop" | "restart" | "update" | "mods" | "keys" | null;
  }>({});

  const [pollingPaused, setPollingPaused] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [controlActivity, setControlActivity] = useState<ControlActivity>({ mode: "legacy", agent: null, jobs: [] });
  const [controlError, setControlError] = useState<string | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [globalAction, setGlobalAction] = useState<"arma" | "mods" | null>(null);
  const [modManagerOpen, setModManagerOpen] = useState(false);
  const [presetDrafts, setPresetDrafts] = useState<Record<"main" | "fun", string[]>>({ main: [], fun: [] });
  const [newModId, setNewModId] = useState<Record<"main" | "fun", string>>({ main: "", fun: "" });
  const [savingPreset, setSavingPreset] = useState<"main" | "fun" | null>(null);
  const [expandedPlayers, setExpandedPlayers] = useState<number | null>(null);

  const watchIntervalRef = useRef<number | null>(null);

  const servers = battalionServers;

  const getServerStatus = (serverId: number) => {
    return serverStatus.find((s) => s.id === serverId);
  };

  const stats = useMemo(() => {
    const activeStatuses = serverStatus.filter((status) => servers.some((server) => server.id === status.id));
    const online = activeStatuses.filter((s) => s.online).length;
    const offline = activeStatuses.length - online;
    const totalPlayers = activeStatuses.reduce((sum, s) => sum + (s.players || 0), 0);
    const maxPlayers = activeStatuses.reduce((sum, s) => sum + (s.maxPlayers || 0), 0);

    return {
      online,
      offline,
      totalPlayers,
      maxPlayers,
    };
  }, [serverStatus, servers]);

  const allServersOffline = !initialLoading && servers.every((server) => {
    const status = getServerStatus(server.id);
    return status && !status.online;
  });

  const globalJob = controlActivity.jobs.find((job) => job.server_id === null && ["pending", "processing"].includes(job.status));

  useEffect(() => {
    const checkAccess = async () => {
      const session = await getAppSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      const roleList = session.roles;
      if (!hasAppPermission(session, "admin.server-control", "read")) {
        router.replace("/");
        return;
      }
      setCanEdit(hasAppPermission(session, "admin.server-control", "edit"));
      setCanFull(hasAppPermission(session, "admin.server-control", "full"));

      setRoles(roleList);
      setLoadingAuth(false);
    };

    checkAccess();
  }, [router]);

  const fetchControlActivity = async () => {
    try {
      const response = await fetch("/api/server-control", { headers: await getAppAuthHeaders(), cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load remote agent activity.");
      setControlActivity(await response.json());
    } catch (error) {
      setControlError(error instanceof Error ? error.message : "Unable to load remote agent activity.");
    }
  };

  useEffect(() => {
    if (loadingAuth) return;
    fetchControlActivity();
    const interval = window.setInterval(fetchControlActivity, 5000);
    return () => window.clearInterval(interval);
  }, [loadingAuth]);

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
  }, []);

  const sendCommand = async (
    command: string,
    serverId: number,
    action: "start" | "stop" | "restart" | "update" | "mods" | "keys"
  ) => {
    if (!canEdit) return;
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

      const response = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(response.error || "Server command failed.");

      setControlError(null);
      await fetchControlActivity();

      if (controlActivity.mode === "agent") return;

      setPollingPaused(true);
      setStartingServerId(serverId);

      if (action === "start" || action === "restart") {
        watchServerUntilOnline(serverId);
      } else if (action === "stop") {
        watchServerUntilOffline(serverId);
      }
    } catch (err) {
      console.error("Command request error:", err);
      setControlError(err instanceof Error ? err.message : "Server command failed.");
      setPollingPaused(false);
      setStartingServerId(null);
    } finally {
      setActionLoading((prev) => ({
        ...prev,
        [serverId]: null,
      }));
    }
  };

  const sendGlobalCommand = async (command: string, action: "arma" | "mods") => {
    if (!canFull || !allServersOffline || globalJob) return;
    try {
      setGlobalAction(action);
      const res = await fetch("/api/server-control", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getAppAuthHeaders()) },
        body: JSON.stringify({ command }),
      });
      const response = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(response.error || "Maintenance operation could not be queued.");
      setControlError(null);
      await fetchControlActivity();
    } catch (error) {
      setControlError(error instanceof Error ? error.message : "Maintenance operation could not be queued.");
    } finally {
      setGlobalAction(null);
    }
  };

  const openModManager = () => {
    const presets = controlActivity.presets || [];
    setPresetDrafts({
      main: [...(presets.find((preset) => preset.key === "main")?.modIds || [])],
      fun: [...(presets.find((preset) => preset.key === "fun")?.modIds || [])],
    });
    setNewModId({ main: "", fun: "" });
    setModManagerOpen(true);
  };

  const addMod = (preset: "main" | "fun") => {
    const raw = newModId[preset].trim();
    const id = raw.match(/(?:id=)?(\d{6,12})/)?.[1];
    if (!id) {
      setControlError("Enter a numeric Steam Workshop ID or Workshop link.");
      return;
    }
    setPresetDrafts((current) => ({
      ...current,
      [preset]: current[preset].includes(id) ? current[preset] : [...current[preset], id],
    }));
    setNewModId((current) => ({ ...current, [preset]: "" }));
    setControlError(null);
  };

  const savePreset = async (preset: "main" | "fun") => {
    try {
      setSavingPreset(preset);
      const res = await fetch("/api/server-control", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getAppAuthHeaders()) },
        body: JSON.stringify({ action: "save-mod-preset", preset, modIds: presetDrafts[preset] }),
      });
      const response = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(response.error || "The mod preset could not be saved.");
      setControlActivity((current) => ({ ...current, presets: response.presets }));
      setControlError(null);
    } catch (error) {
      setControlError(error instanceof Error ? error.message : "The mod preset could not be saved.");
    } finally {
      setSavingPreset(null);
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

        {controlError && (
          <div className="mb-6 border border-red-500/45 bg-red-950/35 px-4 py-3 text-sm text-red-200">
            {controlError}
          </div>
        )}

        <div className="mb-8 grid gap-px border border-[#00ff66]/20 bg-[#00ff66]/20 md:grid-cols-[1fr_auto_auto]">
          <div className="bg-black/80 px-5 py-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[#7f9f8f]">
              <Terminal className="h-4 w-4" /> Remote control link
            </div>
            <div className="mt-2 text-lg font-semibold text-white">
              {controlActivity.mode === "agent"
                ? controlActivity.agent?.display_name || "Primary Arma Server"
                : "Legacy server listener"}
            </div>
          </div>
          <div className="min-w-44 bg-black/80 px-5 py-4">
            <div className="text-xs uppercase tracking-[0.2em] text-[#7f9f8f]">Connection</div>
            <div className={`mt-2 font-semibold ${controlActivity.agent?.online ? "text-[#00ff66]" : controlActivity.mode === "legacy" ? "text-yellow-300" : "text-red-300"}`}>
              {controlActivity.agent?.online ? "Agent online" : controlActivity.mode === "legacy" ? "Transition mode" : "Agent offline"}
            </div>
          </div>
          <button
            type="button"
            onClick={fetchControlActivity}
            className="inline-flex min-h-20 items-center justify-center gap-2 bg-black/80 px-5 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-950/30"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
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

        {controlActivity.mode === "agent" && canFull && (
          <section className="mb-8 border border-cyan-400/30 bg-black/70">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-cyan-400/20 px-5 py-4">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-cyan-300">Installation maintenance</div>
                <h2 className="mt-1 text-xl font-bold text-white">Shared Arma and Workshop controls</h2>
                <p className="mt-2 text-sm text-gray-400">
                  These operations affect the shared installation and unlock only when Servers 1, 2 and 3 are offline.
                </p>
              </div>
              <div className={`border px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] ${allServersOffline ? "border-green-400/40 text-green-300" : "border-yellow-400/40 text-yellow-200"}`}>
                {allServersOffline ? "All servers offline" : `${stats.online} server${stats.online === 1 ? "" : "s"} still online`}
              </div>
            </div>
            <div className="grid gap-px bg-cyan-400/15 md:grid-cols-[1fr_1fr_auto]">
              <button
                type="button"
                onClick={() => sendGlobalCommand("update arma all", "arma")}
                disabled={!allServersOffline || !controlActivity.agent?.online || Boolean(globalJob) || globalAction !== null}
                className="inline-flex min-h-20 items-center justify-center gap-3 bg-black/90 px-5 font-semibold text-cyan-200 transition hover:bg-cyan-950/35 disabled:cursor-not-allowed disabled:text-gray-600"
              >
                <Download className="h-5 w-5" />
                {globalAction === "arma" ? "Queueing Arma update..." : "Update Arma installation"}
              </button>
              <button
                type="button"
                onClick={() => sendGlobalCommand("update mods all", "mods")}
                disabled={!allServersOffline || !controlActivity.agent?.online || Boolean(globalJob) || globalAction !== null}
                className="inline-flex min-h-20 items-center justify-center gap-3 bg-black/90 px-5 font-semibold text-cyan-200 transition hover:bg-cyan-950/35 disabled:cursor-not-allowed disabled:text-gray-600"
              >
                <RefreshCw className="h-5 w-5" />
                {globalAction === "mods" ? "Queueing mod update..." : "Update all configured mods"}
              </button>
              <button
                type="button"
                onClick={openModManager}
                className="inline-flex min-h-20 items-center justify-center gap-3 bg-black/90 px-6 font-semibold text-violet-300 transition hover:bg-violet-950/35"
              >
                <Settings2 className="h-5 w-5" /> Manage mods
              </button>
            </div>
            {globalJob && (
              <div className="border-t border-cyan-400/20 px-5 py-3 text-sm text-cyan-200">
                {globalJob.status === "processing" ? "Agent processing" : "Queued"}: {globalJob.action.replaceAll(".", " ")}
              </div>
            )}
          </section>
        )}

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
                  const queuedJob = controlActivity.jobs.find((job) => job.server_id === server.id && ["pending", "processing"].includes(job.status));

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
                          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#00ff66]">
                            {server.purpose}
                          </p>
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
                          {status.online && status.players > 0 && (
                            <div className="mt-3 border border-white/10 bg-black/45">
                              <button
                                type="button"
                                onClick={() => setExpandedPlayers((current) => current === server.id ? null : server.id)}
                                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-cyan-100 hover:bg-cyan-950/20"
                                aria-expanded={expandedPlayers === server.id}
                              >
                                <span className="flex items-center gap-2"><Users className="h-4 w-4 text-cyan-300" />Who is online ({status.players})</span>
                                {expandedPlayers === server.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </button>
                              {expandedPlayers === server.id && (
                                <div className="border-t border-white/10 px-4 py-3">
                                  {status.playerList?.length ? (
                                    <div className="grid gap-2 sm:grid-cols-2">
                                      {status.playerList.map((player, index) => <div key={`${player}-${index}`} className="flex min-w-0 items-center gap-2 border border-white/10 bg-black/50 px-3 py-2 text-sm text-white"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#00ff66]"/><span className="truncate">{player}</span></div>)}
                                    </div>
                                  ) : <p className="text-sm text-[#80958a]">The server reports {status.players} connected player{status.players === 1 ? "" : "s"}, but did not provide player names.</p>}
                                  {(status.playerList?.length || 0) < status.players && Boolean(status.playerList?.length) && <p className="mt-3 text-xs text-[#667b70]">{status.players - (status.playerList?.length || 0)} additional player name{status.players - (status.playerList?.length || 0) === 1 ? " is" : "s are"} hidden or unavailable.</p>}
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-gray-400">
                          No status data
                        </div>
                      )}

                      {queuedJob && (
                        <div className="mt-4 border border-cyan-400/30 bg-cyan-950/20 px-3 py-2 text-xs uppercase tracking-[0.14em] text-cyan-200">
                          {queuedJob.status === "processing" ? "Agent processing" : "Queued"}: {queuedJob.action.replaceAll(".", " ")}
                        </div>
                      )}

                      <div className="mt-5 flex flex-wrap justify-end gap-2">
                        {controlActivity.mode === "agent" && canFull && (
                          <button
                            onClick={() => sendCommand(`copy keys server ${server.id}`, server.id, "keys")}
                            disabled={!!loadingAction || !!queuedJob || !controlActivity.agent?.online}
                            className="border border-violet-500 px-3 py-2 text-sm font-semibold text-violet-300 transition hover:bg-violet-950/50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {loadingAction === "keys" ? "Queueing..." : "Copy Keys"}
                          </button>
                        )}
                        {!status?.online ? (
                          <button
                            onClick={() => sendCommand(`start server ${server.id}`, server.id, "start")}
                            disabled={!canEdit || !!loadingAction || !!queuedJob || Boolean(globalJob) || (controlActivity.mode === "agent" && !controlActivity.agent?.online)}
                            className="inline-flex items-center gap-2 border border-green-500 px-4 py-3 font-semibold text-green-400 transition hover:bg-green-600 hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {loadingAction === "start" ? <><Spinner />Starting</> : <>Start<ChevronRight className="h-4 w-4" /></>}
                          </button>
                        ) : (
                          <>
                            {controlActivity.mode === "agent" && (
                              <button
                                onClick={() => sendCommand(`restart server ${server.id}`, server.id, "restart")}
                                disabled={!canEdit || !!loadingAction || !!queuedJob || !controlActivity.agent?.online}
                                className="inline-flex items-center gap-2 border border-yellow-500 px-4 py-3 font-semibold text-yellow-300 transition hover:bg-yellow-950/50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {loadingAction === "restart" ? <><Spinner />Queueing</> : <><RefreshCw className="h-4 w-4" />Restart</>}
                              </button>
                            )}
                            <button
                              onClick={() => sendCommand(`stop server ${server.id}`, server.id, "stop")}
                              disabled={!canEdit || !!loadingAction || !!queuedJob || (controlActivity.mode === "agent" && !controlActivity.agent?.online)}
                              className="inline-flex items-center gap-2 border border-red-500 px-4 py-3 font-semibold text-red-400 transition hover:bg-red-600 hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {loadingAction === "stop" ? <><Spinner />Stopping</> : <>Stop<ChevronRight className="h-4 w-4" /></>}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <aside className="min-w-0 space-y-4 2xl:sticky 2xl:top-4 2xl:self-start">
            {controlActivity.mode === "agent" && (
              <div className="border border-[#00ff66]/25 bg-black/70 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.22em] text-[#7f9f8f]">Agent activity</div>
                    <h2 className="mt-1 text-xl font-bold text-white">Recent operations</h2>
                  </div>
                  <span className="text-xs text-gray-500">{controlActivity.jobs.length}</span>
                </div>
                <div className="mt-4 max-h-[440px] space-y-2 overflow-y-auto pr-1">
                  {controlActivity.jobs.length === 0 ? (
                    <div className="border border-white/10 px-3 py-4 text-sm text-gray-500">No agent operations recorded.</div>
                  ) : controlActivity.jobs.map((job) => (
                    <button
                      key={job.id}
                      type="button"
                      onClick={() => setExpandedJobId((current) => current === job.id ? null : job.id)}
                      className="w-full border border-white/10 bg-black/60 p-3 text-left transition hover:border-[#00ff66]/35"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-white">{job.server_id ? `Server ${job.server_id}` : "All servers"} · {job.action.replaceAll(".", " ")}</div>
                          <div className="mt-1 text-xs text-gray-500">{job.requested_by_name} · {new Date(job.requested_at).toLocaleString()}</div>
                        </div>
                        <span className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${job.status === "succeeded" ? "text-[#00ff66]" : job.status === "failed" ? "text-red-300" : "text-yellow-300"}`}>
                          {job.status}
                        </span>
                      </div>
                      {expandedJobId === job.id && (
                        <div className="mt-3 border-t border-white/10 pt-3">
                          {job.error_message && <div className="mb-2 text-xs text-red-300">{job.error_message}</div>}
                          <div className="max-h-44 space-y-1 overflow-y-auto bg-black px-3 py-2 font-mono text-[11px] leading-5 text-gray-300">
                            {job.logs.length ? job.logs.map((entry) => <div key={entry.id} className={entry.level === "error" ? "text-red-300" : entry.level === "warning" ? "text-yellow-300" : ""}>{entry.message}</div>) : <div className="text-gray-600">Waiting for agent output...</div>}
                          </div>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
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
                  text="Read, edit, and full permission levels control monitoring, process actions, and SteamCMD updates separately."
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

      {modManagerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" role="dialog" aria-modal="true" aria-label="Manage server mod presets">
          <div className="flex max-h-[92vh] w-full max-w-6xl flex-col border border-violet-400/40 bg-[#001009] shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-violet-400/25 px-5 py-4">
              <div>
                <div className="text-xs uppercase tracking-[0.22em] text-violet-300">Workshop configuration</div>
                <h2 className="mt-1 text-2xl font-bold text-white">Server mod presets</h2>
                <p className="mt-2 text-sm text-gray-400">Servers 1 and 3 always use the same preset. Server 2 remains independent.</p>
              </div>
              <button type="button" onClick={() => setModManagerOpen(false)} className="border border-white/15 p-3 text-gray-300 hover:border-white/40 hover:text-white" aria-label="Close mod manager">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid min-h-0 flex-1 gap-px overflow-hidden bg-violet-400/20 lg:grid-cols-2">
              {(["main", "fun"] as const).map((preset) => (
                <section key={preset} className="flex min-h-0 flex-col bg-[#000b06] p-5">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <div className="text-lg font-bold text-white">{preset === "main" ? "Servers 1 & 3" : "Server 2"}</div>
                      <div className="mt-1 text-xs uppercase tracking-[0.16em] text-gray-500">{presetDrafts[preset].length} Workshop items</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => savePreset(preset)}
                      disabled={savingPreset !== null || presetDrafts[preset].length === 0}
                      className="border border-[#00ff66]/60 px-4 py-2 text-sm font-semibold text-[#00ff66] hover:bg-[#00ff66]/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {savingPreset === preset ? "Saving..." : "Save preset"}
                    </button>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <input
                      value={newModId[preset]}
                      onChange={(event) => setNewModId((current) => ({ ...current, [preset]: event.target.value }))}
                      onKeyDown={(event) => { if (event.key === "Enter") addMod(preset); }}
                      placeholder="Workshop ID or Steam Workshop link"
                      className="min-w-0 flex-1 border border-white/15 bg-black px-3 py-3 text-sm text-white outline-none focus:border-violet-400"
                    />
                    <button type="button" onClick={() => addMod(preset)} className="inline-flex items-center gap-2 border border-violet-400/60 px-4 text-sm font-semibold text-violet-200 hover:bg-violet-950/40">
                      <PackagePlus className="h-4 w-4" /> Add
                    </button>
                  </div>

                  <div className="mt-4 min-h-0 flex-1 overflow-y-auto border border-white/10">
                    {presetDrafts[preset].map((id) => {
                      const savedPreset = controlActivity.presets?.find((entry) => entry.key === preset);
                      const displayName = savedPreset?.modNames?.[id] || `Workshop item ${id}`;
                      return (
                      <div key={id} className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2 last:border-b-0">
                        <a href={`https://steamcommunity.com/sharedfiles/filedetails/?id=${id}`} target="_blank" rel="noreferrer" className="min-w-0 hover:underline">
                          <span className="block truncate text-sm font-semibold text-cyan-100">{displayName}</span>
                          <span className="mt-0.5 block font-mono text-[11px] text-gray-600">Workshop {id}</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => setPresetDrafts((current) => ({ ...current, [preset]: current[preset].filter((entry) => entry !== id) }))}
                          className="p-2 text-red-300 hover:bg-red-950/40"
                          aria-label={`Remove Workshop item ${id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );})}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      )}
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
