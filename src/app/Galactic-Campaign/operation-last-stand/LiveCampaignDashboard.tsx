"use client";

import { useEffect, useMemo, useState } from "react";

type Safehouse = {
  marker?: string;
  name?: string;
  grid?: string;
  tier?: number;
  unlocked?: boolean;
};

type Town = {
  name?: string;
  type?: string;
  grid?: string;
  infection?: number;
};

type EventMarker = {
  marker?: string;
  kind?: string;
  name?: string;
  grid?: string;
};

type Mission = {
  id?: string;
  title?: string;
  progress?: number;
  target?: number;
  completed?: boolean;
};

type CampaignPayload = {
  playerCount?: number;
  globalInfection?: number;
  researchData?: number;
  activeHordeCount?: number;
  safehouseSiegeActive?: boolean;
  story?: {
    week?: number;
    active?: number;
    complete?: number;
    evidence?: number;
  };
  safehouses?: Safehouse[];
  towns?: Town[];
  events?: EventMarker[];
  missions?: Mission[];
};

type CampaignSnapshot = {
  server_id: string;
  mission_id: string;
  occurred_at: string;
  received_at: string;
  world: string | null;
  player_count: number;
  global_infection: number | null;
  research_data: number;
  safehouse_count: number;
  unlocked_safehouse_count: number;
  active_horde_count: number;
  safehouse_siege_active: boolean;
  story_week: number;
  story_active_count: number;
  story_complete_count: number;
  story_evidence_count: number;
  payload: CampaignPayload;
};

type ApiState = {
  ok: boolean;
  snapshot: CampaignSnapshot | null;
  error?: string;
};

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function percent(value: unknown) {
  return Math.max(0, Math.min(100, Math.round(numberValue(value))));
}

function formatTime(value?: string | null) {
  if (!value) {
    return "Awaiting feed";
  }

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}

export default function LiveCampaignDashboard() {
  const [state, setState] = useState<ApiState>({ ok: true, snapshot: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/arma/campaign-status", { cache: "no-store" });
        const data = (await response.json()) as ApiState;

        if (!cancelled) {
          setState(data);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setState({ ok: false, snapshot: null, error: "Unable to reach live feed" });
          setLoading(false);
        }
      }
    }

    void load();
    const timer = window.setInterval(load, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const snapshot = state.snapshot;
  const payload = snapshot?.payload ?? {};
  const infection = percent(snapshot?.global_infection ?? payload.globalInfection);
  const safehouses = useMemo(() => payload.safehouses ?? [], [payload.safehouses]);
  const towns = useMemo(() => payload.towns ?? [], [payload.towns]);
  const events = useMemo(() => payload.events ?? [], [payload.events]);
  const missions = useMemo(() => payload.missions ?? [], [payload.missions]);

  return (
    <main className="min-h-screen px-4 py-10 text-[#e6fff0] sm:px-8">
      <section className="mx-auto max-w-7xl space-y-8">
        <div className="border border-emerald-400/30 bg-black/60 p-6 shadow-[0_0_45px_rgba(0,255,102,0.12)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.32em] text-emerald-300/80">101st Doom Battalion</p>
              <h1 className="mt-3 text-3xl font-bold text-emerald-100 sm:text-5xl">Operation Last Stand</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-emerald-50/75 sm:text-base">
                Live campaign state from the Altis remnant platoon survival mission: infection pressure, safehouse network, active missions, event contacts and recovered research data.
              </p>
            </div>
            <div className="border border-emerald-400/20 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-100">
              <div>Feed: {loading ? "connecting" : state.ok ? "online" : "offline"}</div>
              <div className="mt-1 text-emerald-200/70">Updated: {formatTime(snapshot?.received_at)}</div>
            </div>
          </div>
        </div>

        {!snapshot ? (
          <div className="border border-amber-300/30 bg-amber-950/20 p-6 text-amber-100">
            {state.error ?? "Awaiting first campaign status snapshot from the Arma bridge."}
          </div>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="border border-red-400/30 bg-black/50 p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-red-200/70">Global Infection</p>
                <div className="mt-4 h-3 bg-red-950/60">
                  <div className="h-full bg-red-500" style={{ width: `${infection}%` }} />
                </div>
                <p className="mt-3 text-3xl font-bold text-red-200">{infection}%</p>
              </div>
              <div className="border border-emerald-400/25 bg-black/50 p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">Safehouses</p>
                <p className="mt-4 text-3xl font-bold text-emerald-100">{snapshot.unlocked_safehouse_count}/{snapshot.safehouse_count}</p>
                <p className="mt-2 text-sm text-emerald-50/60">active network nodes</p>
              </div>
              <div className="border border-cyan-400/25 bg-black/50 p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">Research Data</p>
                <p className="mt-4 text-3xl font-bold text-cyan-100">{snapshot.research_data}</p>
                <p className="mt-2 text-sm text-cyan-50/60">stored for rebuild unlocks</p>
              </div>
              <div className="border border-orange-400/25 bg-black/50 p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-orange-200/70">Threat State</p>
                <p className="mt-4 text-3xl font-bold text-orange-100">{snapshot.active_horde_count}</p>
                <p className="mt-2 text-sm text-orange-50/60">roaming hordes{snapshot.safehouse_siege_active ? " + siege active" : ""}</p>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="border border-emerald-400/20 bg-black/50 p-5">
                <h2 className="text-xl font-bold text-emerald-100">Active Operations</h2>
                <div className="mt-4 space-y-3">
                  {events.length === 0 ? <p className="text-sm text-emerald-50/55">No live event markers reported.</p> : events.map((event, index) => (
                    <div key={`${event.marker}-${index}`} className="flex items-center justify-between gap-4 border border-emerald-400/10 bg-emerald-950/20 px-3 py-2 text-sm">
                      <span className="text-emerald-100">{event.name || event.marker || "Unknown contact"}</span>
                      <span className="text-emerald-200/60">{event.kind} / {event.grid}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-emerald-400/20 bg-black/50 p-5">
                <h2 className="text-xl font-bold text-emerald-100">Story Progress</h2>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-emerald-950/20 p-3"><dt className="text-emerald-200/60">Week</dt><dd className="mt-1 text-2xl text-emerald-100">{snapshot.story_week}</dd></div>
                  <div className="bg-emerald-950/20 p-3"><dt className="text-emerald-200/60">Evidence</dt><dd className="mt-1 text-2xl text-emerald-100">{snapshot.story_evidence_count}</dd></div>
                  <div className="bg-emerald-950/20 p-3"><dt className="text-emerald-200/60">Active Beats</dt><dd className="mt-1 text-2xl text-emerald-100">{snapshot.story_active_count}</dd></div>
                  <div className="bg-emerald-950/20 p-3"><dt className="text-emerald-200/60">Complete</dt><dd className="mt-1 text-2xl text-emerald-100">{snapshot.story_complete_count}</dd></div>
                </dl>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <div className="border border-emerald-400/20 bg-black/50 p-5">
                <h2 className="text-xl font-bold text-emerald-100">Mission Board</h2>
                <div className="mt-4 space-y-3">
                  {missions.length === 0 ? <p className="text-sm text-emerald-50/55">No mission board cycle reported yet.</p> : missions.map((mission) => {
                    const target = Math.max(1, numberValue(mission.target, 1));
                    const progress = Math.min(target, numberValue(mission.progress));
                    return (
                      <div key={mission.id} className="border border-emerald-400/10 bg-emerald-950/20 p-3">
                        <div className="flex justify-between gap-4 text-sm"><span>{mission.title}</span><span>{progress}/{target}</span></div>
                        <div className="mt-2 h-2 bg-black/50"><div className="h-full bg-emerald-400" style={{ width: `${(progress / target) * 100}%` }} /></div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="border border-emerald-400/20 bg-black/50 p-5">
                <h2 className="text-xl font-bold text-emerald-100">Highest Infection Zones</h2>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {towns.map((town, index) => (
                    <div key={`${town.name}-${index}`} className="border border-red-400/10 bg-red-950/10 px-3 py-2 text-sm">
                      <div className="flex justify-between gap-3"><span>{town.name}</span><span className="text-red-200">{percent(town.infection)}%</span></div>
                      <div className="text-xs text-red-100/45">{town.grid}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="border border-emerald-400/20 bg-black/50 p-5">
              <h2 className="text-xl font-bold text-emerald-100">Safehouse Network</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {safehouses.map((safehouse, index) => (
                  <div key={`${safehouse.marker}-${index}`} className="border border-emerald-400/10 bg-emerald-950/20 p-3 text-sm">
                    <div className="flex justify-between gap-3"><span>{safehouse.name || safehouse.marker}</span><span className={safehouse.unlocked ? "text-emerald-300" : "text-red-200"}>{safehouse.unlocked ? `T${safehouse.tier}` : "locked"}</span></div>
                    <div className="mt-1 text-emerald-100/45">{safehouse.grid}</div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </section>
    </main>
  );
}
