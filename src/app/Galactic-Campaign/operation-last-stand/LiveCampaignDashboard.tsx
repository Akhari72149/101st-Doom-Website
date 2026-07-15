"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  RadioTower,
  Shield,
  Signal,
  Skull,
  Target,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";

type Safehouse = { marker?: string; name?: string; grid?: string; tier?: number; unlocked?: boolean };
type Town = { name?: string; type?: string; grid?: string; infection?: number };
type EventMarker = { marker?: string; kind?: string; name?: string; grid?: string };
type Mission = { id?: string; title?: string; progress?: number; target?: number; completed?: boolean };
type CampaignPayload = {
  playerCount?: number;
  globalInfection?: number;
  researchData?: number;
  activeHordeCount?: number;
  safehouseSiegeActive?: boolean;
  story?: { week?: number; active?: number; complete?: number; evidence?: number };
  safehouses?: Safehouse[];
  towns?: Town[];
  events?: EventMarker[];
  missions?: Mission[];
};
type CampaignSnapshot = {
  id?: number;
  server_id: string;
  mission_id: string;
  campaign_id?: string;
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
type StoryEpisode = {
  id: number;
  campaign_id: string;
  week_number: number;
  title: string;
  summary: string;
  status: string;
  starts_at: string | null;
  created_at: string;
  updated_at: string;
};
type StoryObjective = {
  id: string;
  campaign_id: string;
  week_number: number;
  size: "SMALL" | "BIG";
  title: string;
  description: string;
  marker: string;
  implementation_note: string;
  action: unknown[];
  sort_order: number;
  status: string;
  created_at: string;
  updated_at: string;
};
type ApiState = {
  ok: boolean;
  snapshot: CampaignSnapshot | null;
  history?: CampaignSnapshot[];
  storyEpisode?: StoryEpisode | null;
  storyObjectives?: StoryObjective[];
  error?: string;
};

type Tone = "green" | "red" | "cyan" | "amber";

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function percent(value: unknown) {
  return Math.max(0, Math.min(100, Math.round(numberValue(value))));
}

function formatTime(value?: string | null) {
  if (!value) return "Awaiting feed";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function statusAge(value?: string | null, currentTime = Date.now()) {
  if (!value) return "No snapshot received";
  const diffSeconds = Math.max(0, Math.floor((currentTime - new Date(value).getTime()) / 1000));
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const minutes = Math.floor(diffSeconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m ago`;
}

function progressPercent(progress: unknown, target: unknown) {
  const safeTarget = Math.max(1, numberValue(target, 1));
  return Math.min(100, Math.round((numberValue(progress) / safeTarget) * 100));
}

function toneClasses(tone: Tone) {
  return {
    green: "border-[#00ff66]/25 text-[#00ff66]",
    red: "border-red-400/30 text-red-300",
    cyan: "border-cyan-300/25 text-cyan-300",
    amber: "border-amber-300/30 text-amber-200",
  }[tone];
}

function StatTile({ label, value, subtext, tone = "green", icon: Icon }: { label: string; value: string | number; subtext: string; tone?: Tone; icon: typeof Shield }) {
  return (
    <div className={`border-l ${toneClasses(tone)} bg-black/35 px-4 py-4`}>
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-gray-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-3 text-3xl font-bold text-white">{value}</div>
      <div className="mt-1 text-xs leading-5 text-gray-400">{subtext}</div>
    </div>
  );
}

function PanelHeader({ icon: Icon, title, tone = "green" }: { icon: typeof Shield; title: string; tone?: Tone }) {
  return (
    <h2 className={`flex items-center gap-3 text-sm uppercase tracking-[0.22em] ${toneClasses(tone).split(" ").slice(1).join(" ")}`}>
      <Icon className="h-5 w-5" />
      {title}
    </h2>
  );
}

function getLatestOperationResult(snapshot: CampaignSnapshot) {
  if (snapshot.story_complete_count > 0) {
    return {
      title: "Campaign progress recorded",
      body: `${snapshot.story_complete_count} story objective${snapshot.story_complete_count === 1 ? "" : "s"} completed, with ${snapshot.story_evidence_count} evidence item${snapshot.story_evidence_count === 1 ? "" : "s"} recovered.`,
      meta: formatTime(snapshot.received_at),
      tone: "green" as Tone,
    };
  }

  if (snapshot.story_active_count > 0) {
    return {
      title: "Story operation active",
      body: `${snapshot.story_active_count} story objective${snapshot.story_active_count === 1 ? " is" : "s are"} currently active in the mission file.`,
      meta: formatTime(snapshot.received_at),
      tone: "cyan" as Tone,
    };
  }

  return {
    title: "Awaiting story objective progress",
    body: "The live server is reporting campaign state, but no completed story objective has been recorded yet.",
    meta: formatTime(snapshot.received_at),
    tone: "amber" as Tone,
  };
}

function getRecommendedObjective(snapshot: CampaignSnapshot, events: EventMarker[], towns: Town[], missions: Mission[]) {
  if (snapshot.safehouse_siege_active) {
    return { title: "Defend the safehouse siege", body: "A safehouse siege is active. Rally at the threatened safehouse before the defence window collapses.", meta: "Priority: critical", tone: "red" as Tone };
  }

  if (events.length > 0) {
    const event = events[0];
    return { title: event.name || "Respond to active operation", body: `Move to grid ${event.grid || "unknown"} and clear the active ${event.kind || "operation"} marker.`, meta: "Priority: active operation", tone: "amber" as Tone };
  }

  const incompleteMissions = missions
    .filter((mission) => progressPercent(mission.progress, mission.target) < 100)
    .sort((a, b) => progressPercent(b.progress, b.target) - progressPercent(a.progress, a.target));

  if (incompleteMissions.length > 0) {
    const mission = incompleteMissions[0];
    const target = Math.max(1, numberValue(mission.target, 1));
    const progress = Math.min(target, numberValue(mission.progress));
    return { title: mission.title || "Push mission-board progress", body: `Current progress is ${progress}/${target}. Focus this objective for the next server-wide reward.`, meta: "Priority: mission board", tone: "cyan" as Tone };
  }

  if (towns.length > 0) {
    const town = towns[0];
    return { title: `Contain ${town.name || "infection hotspot"}`, body: `Highest reported hotspot is ${percent(town.infection)}% infection at grid ${town.grid || "unknown"}.`, meta: "Priority: containment", tone: "red" as Tone };
  }

  return { title: "Rebuild and scout", body: "No active operations are reported. Upgrade safehouses, gather supplies, and scout event markers for the next push.", meta: "Priority: sustainment", tone: "green" as Tone };
}

export default function LiveCampaignDashboard() {
  const [state, setState] = useState<ApiState>({ ok: true, snapshot: null, history: [], storyEpisode: null, storyObjectives: [] });
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());

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
          setState({ ok: false, snapshot: null, history: [], storyEpisode: null, storyObjectives: [], error: "Unable to reach live feed" });
          setLoading(false);
        }
      }
    }

    void load();
    const timer = window.setInterval(load, 30000);
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.clearInterval(clock);
    };
  }, []);

  const snapshot = state.snapshot;
  const payload = snapshot?.payload ?? {};
  const infection = percent(snapshot?.global_infection ?? payload.globalInfection);
  const safehouses = useMemo(() => payload.safehouses ?? [], [payload.safehouses]);
  const towns = useMemo(() => payload.towns ?? [], [payload.towns]);
  const events = useMemo(() => payload.events ?? [], [payload.events]);
  const missions = useMemo(() => payload.missions ?? [], [payload.missions]);
  const storyEpisode = state.storyEpisode ?? null;
  const storyObjectives = state.storyObjectives ?? [];
  const latestOperationResult = snapshot ? getLatestOperationResult(snapshot) : null;
  const recommendedObjective = snapshot ? getRecommendedObjective(snapshot, events, towns, missions) : null;
  const summaryAvailable = towns.length > 0 || events.length > 0 || missions.length > 0;
  const detailsAvailable = safehouses.length > 0 || summaryAvailable;
  const feedOnline = Boolean(snapshot) && state.ok;
  const feedAge = snapshot?.received_at ? statusAge(snapshot.received_at, now) : statusAge(null, now);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#020704] text-white font-orbitron">
      <div className="fixed inset-0 z-0 bg-center bg-cover bg-no-repeat opacity-12 pointer-events-none" style={{ backgroundImage: "url('/background/bg.jpg')" }} />
      <div className="fixed inset-0 z-0 bg-[linear-gradient(90deg,rgba(0,255,102,0.045)_1px,transparent_1px),linear-gradient(rgba(0,255,102,0.035)_1px,transparent_1px)] bg-[size:72px_72px]" />
      <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_top,rgba(0,255,102,0.13),transparent_34%),linear-gradient(180deg,rgba(2,7,4,0.70),#020704_82%)]" />

      <main className="relative z-10 mx-auto w-full max-w-[1840px] px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-5 border-b border-[#00ff66]/15 pb-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.34em] text-[#00ff66]/60">Altis Remnant Platoon Feed</p>
            <h1 className="mt-2 text-4xl font-bold tracking-[0.14em] text-[#00ff66] sm:text-5xl lg:text-6xl">OPERATION LAST STAND</h1>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-gray-400">Live survival campaign state for the 101st Doom Battalion: infection pressure, safehouse recovery, research stockpiles, roaming threats, and story progress from the active Arma server.</p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:w-[760px]">
            <StatTile icon={feedOnline ? Wifi : WifiOff} label="Feed" value={loading ? "SYNC" : feedOnline ? "LIVE" : "OFF"} subtext={feedAge} tone={feedOnline ? "green" : "red"} />
            <StatTile icon={Users} label="Players" value={snapshot?.player_count ?? 0} subtext="currently reported" />
            <StatTile icon={Shield} label="Safehouses" value={snapshot ? `${snapshot.unlocked_safehouse_count}/${snapshot.safehouse_count}` : "0/0"} subtext="active network" tone="cyan" />
            <StatTile icon={Skull} label="Hordes" value={snapshot?.active_horde_count ?? 0} subtext={snapshot?.safehouse_siege_active ? "siege in progress" : "roaming contacts"} tone={snapshot?.safehouse_siege_active ? "red" : "amber"} />
          </div>
        </header>

        {!snapshot ? (
          <section className="mt-6 border border-amber-300/25 bg-black/45 p-6">
            <div className="flex items-start gap-4">
              <AlertTriangle className="mt-1 h-6 w-6 shrink-0 text-amber-200" />
              <div>
                <h2 className="text-xl font-semibold text-amber-100">Awaiting Campaign Feed</h2>
                <p className="mt-2 text-sm leading-6 text-gray-400">{state.error ?? "No campaign snapshot has been received yet. Start the bridge, load the mission, then emit or wait for the next scheduled status snapshot."}</p>
              </div>
            </div>
          </section>
        ) : (
          <>
            <section className="mt-6 grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
              <div className="border border-[#00ff66]/15 bg-black/35 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.24em] text-[#00ff66]/60">Planetary Infection State</p>
                    <h2 className="mt-2 text-3xl font-semibold text-white">Altis Outbreak Control</h2>
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-400">Infection status is fed from mission persistence. Clearing towns, completing campaign work, and defending safehouses affects pressure over time.</p>
                  </div>
                  <div className="border border-red-400/25 bg-red-500/5 px-4 py-3 text-right">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-red-200/70">Global Infection</div>
                    <div className="mt-1 text-4xl font-bold text-red-200">{infection}%</div>
                  </div>
                </div>
                <div className="mt-6 h-4 border border-red-400/25 bg-black/60 p-0.5">
                  <div className="h-full bg-gradient-to-r from-[#00ff66] via-amber-300 to-red-500 transition-all duration-500" style={{ width: `${infection}%` }} />
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <div className="border border-[#00ff66]/10 bg-black/45 p-4"><div className="text-[10px] uppercase tracking-[0.2em] text-gray-500">World</div><div className="mt-2 text-lg font-semibold text-[#00ff66]">{snapshot.world || "Altis"}</div></div>
                  <div className="border border-[#00ff66]/10 bg-black/45 p-4"><div className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Last Snapshot</div><div className="mt-2 text-lg font-semibold text-white">{formatTime(snapshot.received_at)}</div></div>
                </div>
              </div>

              <aside className="space-y-5">
                <div className="border border-cyan-300/15 bg-black/35 p-5"><PanelHeader icon={Database} title="Research Cache" tone="cyan" /><div className="mt-5 text-5xl font-bold text-white">{snapshot.research_data}</div><p className="mt-2 text-sm leading-6 text-gray-400">Research data available for rebuild progression and higher-tier safehouse infrastructure.</p></div>
                <div className="border border-[#00ff66]/15 bg-black/35 p-5"><PanelHeader icon={RadioTower} title="Story Progress" /><div className="mt-5 grid grid-cols-2 gap-3"><div className="border border-[#00ff66]/10 bg-black/45 p-4"><div className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Week</div><div className="mt-2 text-3xl font-bold text-white">{snapshot.story_week}</div></div><div className="border border-[#00ff66]/10 bg-black/45 p-4"><div className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Evidence</div><div className="mt-2 text-3xl font-bold text-white">{snapshot.story_evidence_count}</div></div><div className="border border-[#00ff66]/10 bg-black/45 p-4"><div className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Active</div><div className="mt-2 text-3xl font-bold text-white">{snapshot.story_active_count}</div></div><div className="border border-[#00ff66]/10 bg-black/45 p-4"><div className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Complete</div><div className="mt-2 text-3xl font-bold text-white">{snapshot.story_complete_count}</div></div></div></div>
              </aside>
            </section>

            <section className="mt-5 border border-[#00ff66]/15 bg-black/35 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><PanelHeader icon={Clock3} title="Current Campaign Snapshot" /><p className="mt-3 max-w-3xl text-sm leading-6 text-gray-400">Latest confirmed state from the active server feed. This is the quick-read command summary for players checking the operation before joining.</p></div><div className="border border-[#00ff66]/10 bg-black/45 px-4 py-3 text-right"><div className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Received</div><div className="mt-1 text-lg font-semibold text-white">{formatTime(snapshot.received_at)}</div></div></div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="border border-red-400/15 bg-black/45 p-4"><div className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Infection</div><div className="mt-2 text-3xl font-bold text-red-200">{infection}%</div></div><div className="border border-cyan-300/15 bg-black/45 p-4"><div className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Players Online</div><div className="mt-2 text-3xl font-bold text-cyan-200">{snapshot.player_count}</div></div><div className="border border-[#00ff66]/15 bg-black/45 p-4"><div className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Safehouses</div><div className="mt-2 text-3xl font-bold text-[#00ff66]">{snapshot.unlocked_safehouse_count}/{snapshot.safehouse_count}</div></div><div className="border border-amber-300/15 bg-black/45 p-4"><div className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Threats</div><div className="mt-2 text-3xl font-bold text-amber-200">{snapshot.active_horde_count}</div><div className="mt-1 text-xs text-gray-400">{snapshot.safehouse_siege_active ? "Safehouse siege active" : "Roaming horde contacts"}</div></div></div>
            </section>

            <section className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="border border-[#00ff66]/15 bg-black/35 p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><PanelHeader icon={RadioTower} title={storyEpisode ? `Week ${storyEpisode.week_number}: ${storyEpisode.title}` : "Campaign Briefing"} /><p className="mt-4 text-sm leading-6 text-gray-400">{storyEpisode?.summary ?? "No active story episode has been published to the website yet."}</p></div><div className="border border-[#00ff66]/10 bg-black/45 px-4 py-3 text-sm text-gray-400"><div className="text-[10px] uppercase tracking-[0.2em] text-[#00ff66]/60">Campaign State</div><div className="mt-2">{storyEpisode ? storyEpisode.status : "Not published"}</div></div></div>
                <div className="mt-5 grid gap-3 lg:grid-cols-3">{storyObjectives.length === 0 ? <p className="text-sm text-gray-400">No story objectives are currently listed.</p> : storyObjectives.map((objective) => <div key={objective.id} className="border border-[#00ff66]/10 bg-black/45 p-4"><div className="text-[10px] uppercase tracking-[0.18em] text-[#00ff66]/60">{objective.size} Objective</div><div className="mt-2 text-sm font-semibold text-white">{objective.title}</div><p className="mt-2 text-xs leading-5 text-gray-400">{objective.description}</p></div>)}</div>
              </div>
              <div className="space-y-5">
                <div className="border border-amber-300/15 bg-black/35 p-5"><PanelHeader icon={Target} title="Next Recommended Objective" tone={recommendedObjective?.tone ?? "amber"} /><div className="mt-5 border border-amber-300/10 bg-black/45 p-4"><div className="text-lg font-semibold text-white">{recommendedObjective?.title}</div><p className="mt-3 text-sm leading-6 text-gray-400">{recommendedObjective?.body}</p><div className="mt-4 text-xs uppercase tracking-[0.18em] text-amber-200/60">{recommendedObjective?.meta}</div></div></div>
                <div className="border border-[#00ff66]/15 bg-black/35 p-5"><PanelHeader icon={CheckCircle2} title="Setup Readiness" /><div className="mt-4 space-y-3 text-sm text-gray-300"><div className="flex items-center justify-between gap-3 border border-[#00ff66]/10 bg-black/35 px-3 py-2"><span>Live Arma feed</span><span className={feedOnline ? "text-[#00ff66]" : "text-red-300"}>{feedOnline ? "Online" : "Offline"}</span></div><div className="flex items-center justify-between gap-3 border border-[#00ff66]/10 bg-black/35 px-3 py-2"><span>Story episode</span><span className={storyEpisode ? "text-[#00ff66]" : "text-amber-200"}>{storyEpisode ? "Loaded" : "Missing"}</span></div><div className="flex items-center justify-between gap-3 border border-[#00ff66]/10 bg-black/35 px-3 py-2"><span>Story objectives</span><span className={storyObjectives.length > 0 ? "text-[#00ff66]" : "text-amber-200"}>{storyObjectives.length}</span></div></div></div>
                <div className={`border bg-black/35 p-5 ${toneClasses(latestOperationResult?.tone ?? "amber")}`}><div className="text-sm font-semibold text-white">{latestOperationResult?.title}</div><p className="mt-2 text-xs leading-5 text-gray-400">{latestOperationResult?.body}</p><div className="mt-3 text-[10px] uppercase tracking-[0.18em] text-[#00ff66]/60">{latestOperationResult?.meta}</div></div>
              </div>
            </section>

            <section className="mt-5 grid gap-5 xl:grid-cols-3"><div className="border border-[#00ff66]/15 bg-black/35 p-5"><PanelHeader icon={Activity} title="Active Operations" /><div className="mt-4 space-y-3">{events.length === 0 ? <p className="text-sm leading-6 text-gray-400">No live operation markers are currently reported.</p> : events.map((event, index) => <div key={`${event.marker}-${index}`} className="border border-[#00ff66]/15 bg-black/45 p-4"><div className="text-sm font-semibold text-white">{event.name || event.marker || "Unknown contact"}</div><div className="mt-1 text-xs uppercase tracking-[0.18em] text-[#00ff66]/70">{event.kind} / {event.grid}</div></div>)}</div></div><div className="border border-red-400/15 bg-black/35 p-5"><PanelHeader icon={Target} title="Infection Hotspots" tone="red" /><div className="mt-4 space-y-3">{towns.length === 0 ? <p className="text-sm leading-6 text-gray-400">No town infection hotspots are currently reported.</p> : towns.map((town, index) => <div key={`${town.name}-${index}`} className="border border-red-400/15 bg-black/45 p-4"><div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold text-white">{town.name}</span><span className="text-sm text-red-200">{percent(town.infection)}%</span></div><div className="mt-1 text-xs uppercase tracking-[0.18em] text-red-200/50">{town.grid}</div></div>)}</div></div><div className="border border-cyan-300/15 bg-black/35 p-5"><PanelHeader icon={Signal} title="Mission Board" tone="cyan" /><div className="mt-4 space-y-3">{missions.length === 0 ? <p className="text-sm leading-6 text-gray-400">No mission-board entries are currently reported.</p> : missions.map((mission) => { const target = Math.max(1, numberValue(mission.target, 1)); const progress = Math.min(target, numberValue(mission.progress)); return <div key={`${mission.title}-${progress}-${target}`} className="border border-cyan-300/15 bg-black/45 p-4"><div className="flex justify-between gap-4 text-sm"><span className="text-white">{mission.title}</span><span className="text-cyan-200">{progress}/{target}</span></div><div className="mt-3 h-2 bg-black/60"><div className="h-full bg-cyan-300" style={{ width: `${(progress / target) * 100}%` }} /></div></div>; })}</div></div></section>

            <section className="mt-5 border border-[#00ff66]/15 bg-black/35 p-5"><div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div><p className="text-[10px] uppercase tracking-[0.24em] text-[#00ff66]/60">Safehouse Network</p><h2 className="mt-2 text-2xl font-semibold text-white">Rebuild Status</h2></div><div className="text-sm text-gray-400">{detailsAvailable ? (summaryAvailable ? "Summary feed active" : "Detailed network feed active") : "Compact feed active"}</div></div><div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{safehouses.length === 0 ? <><div className="border border-[#00ff66]/15 bg-black/45 p-4"><div className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Unlocked</div><div className="mt-2 text-3xl font-bold text-[#00ff66]">{snapshot.unlocked_safehouse_count}</div></div><div className="border border-[#00ff66]/15 bg-black/45 p-4"><div className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Total Markers</div><div className="mt-2 text-3xl font-bold text-white">{snapshot.safehouse_count}</div></div></> : safehouses.map((safehouse, index) => <div key={`${safehouse.marker}-${index}`} className="border border-[#00ff66]/15 bg-black/45 p-4"><div className="flex justify-between gap-3"><span className="text-sm font-semibold text-white">{safehouse.name || safehouse.marker}</span><span className={safehouse.unlocked ? "text-[#00ff66]" : "text-red-300"}>{safehouse.unlocked ? `T${safehouse.tier}` : "locked"}</span></div><div className="mt-2 text-xs uppercase tracking-[0.18em] text-gray-500">{safehouse.grid}</div></div>)}</div></section>
          </>
        )}
      </main>
    </div>
  );
}