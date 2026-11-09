"use client";

import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  Award,
  BadgeCheck,
  BookOpenCheck,
  BookOpenText,
  CalendarCheck,
  Clock3,
  ClipboardList,
  ExternalLink,
  HeartPulse,
  History,
  Link2,
  Map,
  Megaphone,
  Plane,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { getAppSession, hasAppPermission, type AppSession } from "@/lib/client-auth";

type PanelDefinition = {
  id: string;
  title: string;
  description: string;
  permission: string;
  route: string;
  group: "Personnel" | "Records & Progression" | "Content & Configuration" | "Systems & Logistics";
  icon: ComponentType<{ className?: string; size?: number }>;
  openMode?: "panel" | "page";
};

const panels: PanelDefinition[] = [
  {
    id: "create-accounts",
    title: "Create Accounts",
    description: "Create new website accounts and linked personnel records.",
    permission: "admin.create",
    route: "/admin/create",
    group: "Personnel",
    icon: UserPlus,
  },
  {
    id: "ranks-and-slots",
    title: "Ranks & Slots",
    description: "Manage personnel ranks, slots, billets, and Discord role updates.",
    permission: "admin.positions",
    route: "/admin/positions",
    group: "Personnel",
    icon: Users,
  },
  {
    id: "personnel-profiles",
    title: "Personnel Profiles",
    description: "Maintain join dates, Discord links, statuses, and profile reactivation.",
    permission: "admin.personnel-profiles",
    route: "/admin/personnel-profiles",
    group: "Personnel",
    icon: Users,
  },
  {
    id: "certifications",
    title: "Certification Awards",
    description: "Award and remove certifications from personnel records.",
    permission: "admin.certifications",
    route: "/admin/certifications",
    group: "Personnel",
    icon: BadgeCheck,
  },
  {
    id: "medals",
    title: "Medals",
    description: "Award and remove medals displayed on personnel profiles.",
    permission: "admin.medals",
    route: "/admin/medals",
    group: "Personnel",
    icon: Award,
  },
  {
    id: "rank-corrections",
    title: "Rank Corrections",
    description: "Correct an assigned rank while retaining the existing TIG date.",
    permission: "admin.rank-corrections",
    route: "/admin/rank-corrections",
    group: "Personnel",
    icon: ShieldCheck,
  },
  {
    id: "rank-management",
    title: "Rank Management",
    description: "Create, edit, activate and reorder rank definitions.",
    permission: "admin.ranks",
    route: "/admin/ranks",
    group: "Personnel",
    icon: SlidersHorizontal,
  },
  {
    id: "certification-leads",
    title: "Certification Leads",
    description: "Assign the active lead responsible for each certification family.",
    permission: "admin.certifications",
    route: "/admin/certifications?leads=1",
    group: "Personnel",
    icon: BadgeCheck,
  },
  {
    id: "certification-catalogue",
    title: "Certification Catalogue",
    description: "Create, edit, activate, and retire certification definitions and Discord roles.",
    permission: "admin.certification-catalogue",
    route: "/admin/certification-catalogue",
    group: "Personnel",
    icon: BadgeCheck,
  },
  {
    id: "xp-corrections",
    title: "XP Corrections",
    description: "Apply audited XP adjustments and review recent corrections.",
    permission: "admin.xp",
    route: "/admin/xp",
    group: "Records & Progression",
    icon: Activity,
  },
  {
    id: "armour-points-config",
    title: "Armour Points Configuration",
    description: "Set cumulative rank totals, catalogue costs, and rank requirements.",
    permission: "admin.armour-points-config",
    route: "/admin/armour-points-config",
    group: "Personnel",
    icon: SlidersHorizontal,
  },
  {
    id: "hammer-ridealongs",
    title: "Hammer Ridealongs",
    description: "Maintain aviation trainees, milestones, and submitted ridealong records.",
    permission: "admin.hammer-ridealongs",
    route: "/hammer-ridealongs",
    group: "Records & Progression",
    icon: Plane,
  },
  {
    id: "operation-counts",
    title: "Operation Count Responses",
    description: "Review and record CR and CR-C progression operations and credited counts.",
    permission: "admin.operation-counts",
    route: "/operation-counts/responses",
    group: "Records & Progression",
    icon: ClipboardList,
  },
  {
    id: "recruitment",
    title: "Recruitment",
    description: "Review applications, track contact progress, and maintain the public recruitment form.",
    permission: "admin.recruitment",
    route: "/admin/recruitment",
    group: "Records & Progression",
    icon: UserPlus,
  },
  {
    id: "join-links",
    title: "Join Page Content",
    description: "Publish MainOp, FunOp, and FOTM files and maintain the unit whitelist.",
    permission: "admin.join-links",
    route: "/admin/join-links",
    group: "Content & Configuration",
    icon: Link2,
  },
  {
    id: "uniform-guide",
    title: "Uniform Guide",
    description: "Maintain published uniforms, loadouts, images, and restricted items.",
    permission: "admin.uniform-guide",
    route: "/admin/uniform-guide",
    group: "Content & Configuration",
    icon: BookOpenCheck,
  },
  {
    id: "documents",
    title: "Document Library",
    description: "Edit, publish, and review official website documents.",
    permission: "admin.documents",
    route: "/admin/documents",
    group: "Content & Configuration",
    icon: BookOpenText,
  },
  {
    id: "system-health",
    title: "System Health",
    description: "Inspect database, scheduler, Discord outbox and integration health.",
    permission: "admin.system-health",
    route: "/admin/system-health",
    group: "Systems & Logistics",
    icon: HeartPulse,
  },
  {
    id: "attendance",
    title: "Weekly Attendance",
    description: "Update weekly attendance and review individual attendance records.",
    permission: "admin.weekly-attendance",
    route: "/admin/weekly-attendance",
    group: "Records & Progression",
    icon: CalendarCheck,
  },
  {
    id: "remove-retire",
    title: "Remove / Retire",
    description: "Remove, retire, or archive personnel through the controlled workflow.",
    permission: "admin.removal",
    route: "/admin/removal",
    group: "Records & Progression",
    icon: UserMinus,
  },
  {
    id: "removal-log",
    title: "Removal Log",
    description: "Review completed personnel removals and retirements.",
    permission: "admin.removal-log",
    route: "/admin/removal-log",
    group: "Records & Progression",
    icon: History,
  },
  {
    id: "discord-pings",
    title: "Discord Pings",
    description: "Create and maintain scheduled Discord announcements.",
    permission: "admin.discord-announcements",
    route: "/admin/discord-announcemets",
    group: "Content & Configuration",
    icon: Megaphone,
  },
  {
    id: "map-requests",
    title: "Map Requests",
    description: "Review Workshop requests and mark maps as installed on the server.",
    permission: "admin.map-requests",
    route: "/map-requests",
    group: "Systems & Logistics",
    icon: Map,
  },
  {
    id: "gc-asset-log",
    title: "GC Asset Log",
    description: "Open the full campaign asset transaction history workspace.",
    permission: "gc.asset-log",
    route: "/GC-Asset-Log",
    group: "Systems & Logistics",
    icon: ClipboardList,
    openMode: "page",
  },
  {
    id: "gc-logistics",
    title: "GC Logistics",
    description: "Open the full campaign logistics and distribution workspace.",
    permission: "gc.logistics",
    route: "/GC-Logi",
    group: "Systems & Logistics",
    icon: ClipboardList,
    openMode: "page",
  },
  {
    id: "cis-logistics",
    title: "CIS Logistics",
    description: "Open the full CIS logistics and inventory workspace.",
    permission: "cis.logistics",
    route: "/CIS-Logi",
    group: "Systems & Logistics",
    icon: ClipboardList,
    openMode: "page",
  },
];

function embeddedRoute(route: string) {
  return `${route}${route.includes("?") ? "&" : "?"}embedded=1`;
}

function readStoredIds(key: string) {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

export default function AdminControlCentre() {
  const router = useRouter();
  const [session, setSession] = useState<AppSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePanelId, setActivePanelId] = useState("");
  const [panelLoading, setPanelLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);

  const closePanel = useCallback(() => {
    setActivePanelId("");
    setPanelLoading(false);
    window.history.replaceState(null, "", "/admin/control-centre");
  }, []);

  const openPanel = useCallback((id: string) => {
    const panel = panels.find((entry) => entry.id === id);
    if (!panel) return;
    setRecentIds((current) => {
      const next = [id, ...current.filter((entry) => entry !== id)].slice(0, 5);
      window.localStorage.setItem("admin-control-centre-recent", JSON.stringify(next));
      return next;
    });
    if (panel.openMode === "page") {
      router.push(panel.route);
      return;
    }
    setActivePanelId(id);
    setPanelLoading(true);
    window.history.replaceState(null, "", `/admin/control-centre?panel=${encodeURIComponent(id)}`);
  }, [router]);

  const toggleFavorite = useCallback((id: string) => {
    setFavoriteIds((current) => {
      const next = current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id];
      window.localStorage.setItem("admin-control-centre-favorites", JSON.stringify(next));
      return next;
    });
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setFavoriteIds(readStoredIds("admin-control-centre-favorites"));
      setRecentIds(readStoredIds("admin-control-centre-recent"));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    void (async () => {
      const current = await getAppSession();
      if (!current) {
        router.replace("/login");
        return;
      }
      const available = panels.filter((panel) => hasAppPermission(current, panel.permission, "read"));
      if (!available.length) {
        router.replace("/");
        return;
      }
      setSession(current);
      const requested = new URLSearchParams(window.location.search).get("panel") || "";
      if (available.some((panel) => panel.id === requested)) {
        setActivePanelId(requested);
        setPanelLoading(true);
      }
      setLoading(false);
    })();
  }, [router]);

  useEffect(() => {
    if (!activePanelId) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePanel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activePanelId, closePanel]);

  useEffect(() => {
    const onPopState = () => {
      const requested = new URLSearchParams(window.location.search).get("panel") || "";
      setActivePanelId(requested);
      setPanelLoading(Boolean(requested));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const availablePanels = useMemo(
    () => session ? panels.filter((panel) => hasAppPermission(session, panel.permission, "read")) : [],
    [session],
  );
  const activePanel = availablePanels.find((panel) => panel.id === activePanelId) || null;
  const filteredPanels = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return availablePanels;
    return availablePanels.filter((panel) => `${panel.title} ${panel.description} ${panel.group}`.toLowerCase().includes(query));
  }, [availablePanels, searchQuery]);
  const favoritePanels = favoriteIds.map((id) => availablePanels.find((panel) => panel.id === id)).filter((panel): panel is PanelDefinition => Boolean(panel));
  const recentPanels = recentIds.map((id) => availablePanels.find((panel) => panel.id === id)).filter((panel): panel is PanelDefinition => Boolean(panel));
  const groups = ["Personnel", "Records & Progression", "Content & Configuration", "Systems & Logistics"] as const;

  if (loading) return <main className="min-h-screen bg-[#020806] p-10 text-[#00ff66]">Loading Admin Control Centre...</main>;

  const panelCard = (panel: PanelDefinition, compact = false) => {
    const Icon = panel.icon;
    const access = session?.permissions[panel.permission] || "none";
    const favorite = favoriteIds.includes(panel.id);
    return (
      <article key={panel.id} className={`group relative border-b border-r border-[#00ff66]/15 bg-[#020806] transition hover:bg-[#00ff66]/7 ${compact ? "min-h-28" : "min-h-40"}`}>
        <button type="button" onClick={() => openPanel(panel.id)} className="h-full w-full p-5 pr-14 text-left focus:outline-none focus:ring-1 focus:ring-inset focus:ring-[#00ff66]">
          <div className="flex items-start justify-between gap-4">
            <span className={`grid place-items-center border border-[#00ff66]/30 bg-[#00ff66]/5 text-[#00ff66] transition group-hover:border-[#00ff66]/60 ${compact ? "h-9 w-9" : "h-11 w-11"}`}>
              <Icon size={compact ? 17 : 20} />
            </span>
            <span className="border border-white/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-[#789082]">{panel.openMode === "page" ? "Full page" : access}</span>
          </div>
          <h3 className={`${compact ? "mt-3 text-base" : "mt-5 text-lg"} font-black text-white`}>{panel.title}</h3>
          {!compact && <p className="mt-2 text-xs leading-5 text-[#789082]">{panel.description}</p>}
        </button>
        <button type="button" onClick={() => toggleFavorite(panel.id)} title={favorite ? "Remove from favourites" : "Add to favourites"} aria-label={favorite ? `Remove ${panel.title} from favourites` : `Add ${panel.title} to favourites`} className={`absolute right-3 top-3 grid h-9 w-9 place-items-center border transition ${favorite ? "border-yellow-300/50 bg-yellow-300/10 text-yellow-200" : "border-white/10 text-[#66766d] hover:border-yellow-300/40 hover:text-yellow-200"}`}>
          <Star size={15} fill={favorite ? "currentColor" : "none"} />
        </button>
      </article>
    );
  };

  return (
    <main className="min-h-screen bg-[#020806] px-4 py-8 text-white sm:px-8">
      <section className="mx-auto max-w-7xl border border-[#00ff66]/25 bg-black/80">
        <header className="border-b border-[#00ff66]/20 p-6 sm:p-8">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#00ff66]">Administration</p>
              <h1 className="mt-2 text-3xl font-black uppercase sm:text-4xl">Control Centre</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#8ba395]">
                Open routine configuration and maintenance tools without leaving this workspace. Every panel keeps its own permissions and audit rules.
              </p>
            </div>
            <label className="flex min-h-12 w-full items-center gap-3 border border-[#00ff66]/30 bg-black px-4 focus-within:border-[#00ff66]/70 lg:max-w-md">
              <Search size={18} className="shrink-0 text-[#00ff66]" />
              <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search administration tools" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#688074]" />
              {searchQuery && <button type="button" onClick={() => setSearchQuery("")} title="Clear search" className="text-gray-500 hover:text-white"><X size={15} /></button>}
            </label>
          </div>
        </header>

        {!searchQuery && (favoritePanels.length > 0 || recentPanels.length > 0) && (
          <section className="grid border-b border-[#00ff66]/15 lg:grid-cols-2">
            {favoritePanels.length > 0 && (
              <div className="border-b border-[#00ff66]/15 p-5 lg:border-b-0 lg:border-r sm:p-7">
                <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-yellow-200"><Star size={15} fill="currentColor" /> Favourites</h2>
                <div className="mt-4 grid border-l border-t border-[#00ff66]/15 sm:grid-cols-2">{favoritePanels.slice(0, 4).map((panel) => panelCard(panel, true))}</div>
              </div>
            )}
            {recentPanels.length > 0 && (
              <div className="p-5 sm:p-7">
                <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-200"><Clock3 size={15} /> Recently opened</h2>
                <div className="mt-4 grid border-l border-t border-[#00ff66]/15 sm:grid-cols-2">{recentPanels.slice(0, 4).map((panel) => panelCard(panel, true))}</div>
              </div>
            )}
          </section>
        )}

        {groups.map((group) => {
          const groupPanels = filteredPanels.filter((panel) => panel.group === group);
          if (!groupPanels.length) return null;
          return (
            <section key={group} className="border-b border-[#00ff66]/15 p-5 last:border-b-0 sm:p-7">
              <h2 className="text-xs font-black uppercase tracking-[0.18em] text-[#00ff66]/75">{group}</h2>
              <div className="mt-4 grid border-l border-t border-[#00ff66]/15 sm:grid-cols-2 xl:grid-cols-3">
                {groupPanels.map((panel) => panelCard(panel))}
              </div>
            </section>
          );
        })}
        {filteredPanels.length === 0 && <div className="p-14 text-center text-sm text-[#789082]">No accessible administration tools match that search.</div>}
      </section>

      {activePanel && (
        <div className="fixed inset-0 z-[120] flex bg-black/90 p-0 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true" aria-labelledby="control-centre-panel-title">
          <section className="flex min-h-0 w-full flex-col overflow-hidden border border-[#00ff66]/35 bg-[#020806] shadow-[0_0_70px_rgba(0,255,102,0.13)]">
            <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[#00ff66]/20 bg-black px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#00ff66]/70">Admin Control Centre</p>
                <h2 id="control-centre-panel-title" className="truncate text-lg font-black text-white sm:text-xl">{activePanel.title}</h2>
              </div>
              <div className="flex items-center gap-2">
                <Link href={activePanel.route} target="_blank" title="Open as a full page"
                  className="grid h-10 w-10 place-items-center border border-white/15 text-gray-300 transition hover:border-cyan-300/50 hover:text-cyan-200">
                  <ExternalLink size={17} />
                </Link>
                <button type="button" onClick={closePanel} title="Close panel"
                  className="grid h-10 w-10 place-items-center border border-white/15 text-gray-300 transition hover:border-red-400/50 hover:bg-red-400/8 hover:text-red-300">
                  <X size={18} />
                </button>
              </div>
            </header>
            <div className="relative min-h-0 flex-1 bg-[#020806]">
              {panelLoading && <div className="absolute inset-0 z-10 grid place-items-center bg-[#020806] text-xs font-black uppercase tracking-[0.18em] text-[#00ff66]">Loading {activePanel.title}...</div>}
              <iframe key={activePanel.id} src={embeddedRoute(activePanel.route)} title={activePanel.title}
                onLoad={() => setPanelLoading(false)} className="h-full min-h-0 w-full border-0 bg-[#020806]" />
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
