"use client";

import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  BadgeCheck,
  BookOpenCheck,
  ExternalLink,
  HeartPulse,
  Link2,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { getAppSession, hasAppPermission, type AppSession } from "@/lib/client-auth";

type PanelDefinition = {
  id: string;
  title: string;
  description: string;
  permission: string;
  route: string;
  group: "Personnel Configuration" | "Website & Systems";
  icon: ComponentType<{ className?: string; size?: number }>;
};

const panels: PanelDefinition[] = [
  {
    id: "rank-corrections",
    title: "Rank Corrections",
    description: "Correct an assigned rank while retaining the existing TIG date.",
    permission: "admin.rank-corrections",
    route: "/admin/rank-corrections",
    group: "Personnel Configuration",
    icon: ShieldCheck,
  },
  {
    id: "rank-management",
    title: "Rank Management",
    description: "Create, edit, activate and reorder rank definitions.",
    permission: "admin.ranks",
    route: "/admin/ranks",
    group: "Personnel Configuration",
    icon: SlidersHorizontal,
  },
  {
    id: "certification-leads",
    title: "Certification Leads",
    description: "Assign the active lead responsible for each certification family.",
    permission: "admin.certifications",
    route: "/admin/certifications?leads=1",
    group: "Personnel Configuration",
    icon: BadgeCheck,
  },
  {
    id: "xp-corrections",
    title: "XP Corrections",
    description: "Apply audited XP adjustments and review recent corrections.",
    permission: "admin.xp",
    route: "/admin/xp",
    group: "Personnel Configuration",
    icon: Activity,
  },
  {
    id: "join-links",
    title: "Join Page Content",
    description: "Publish MainOp and FunOp files and maintain the unit whitelist.",
    permission: "admin.join-links",
    route: "/admin/join-links",
    group: "Website & Systems",
    icon: Link2,
  },
  {
    id: "uniform-guide",
    title: "Uniform Guide",
    description: "Maintain published uniforms, loadouts, images, and restricted items.",
    permission: "admin.uniform-guide",
    route: "/admin/uniform-guide",
    group: "Website & Systems",
    icon: BookOpenCheck,
  },
  {
    id: "system-health",
    title: "System Health",
    description: "Inspect database, scheduler, Discord outbox and integration health.",
    permission: "admin.system-health",
    route: "/admin/system-health",
    group: "Website & Systems",
    icon: HeartPulse,
  },
];

function embeddedRoute(route: string) {
  return `${route}${route.includes("?") ? "&" : "?"}embedded=1`;
}

export default function AdminControlCentre() {
  const router = useRouter();
  const [session, setSession] = useState<AppSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePanelId, setActivePanelId] = useState("");
  const [panelLoading, setPanelLoading] = useState(false);

  const closePanel = useCallback(() => {
    setActivePanelId("");
    setPanelLoading(false);
    window.history.replaceState(null, "", "/admin/control-centre");
  }, []);

  const openPanel = useCallback((id: string) => {
    setActivePanelId(id);
    setPanelLoading(true);
    window.history.replaceState(null, "", `/admin/control-centre?panel=${encodeURIComponent(id)}`);
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
  const groups = ["Personnel Configuration", "Website & Systems"] as const;

  if (loading) return <main className="min-h-screen bg-[#020806] p-10 text-[#00ff66]">Loading Admin Control Centre...</main>;

  return (
    <main className="min-h-screen bg-[#020806] px-4 py-8 text-white sm:px-8">
      <section className="mx-auto max-w-7xl border border-[#00ff66]/25 bg-black/80">
        <header className="border-b border-[#00ff66]/20 p-6 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#00ff66]">Administration</p>
          <h1 className="mt-2 text-3xl font-black uppercase sm:text-4xl">Control Centre</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#8ba395]">
            Open routine configuration and maintenance tools without leaving this workspace. Every panel keeps its own permissions and audit rules.
          </p>
        </header>

        {groups.map((group) => {
          const groupPanels = availablePanels.filter((panel) => panel.group === group);
          if (!groupPanels.length) return null;
          return (
            <section key={group} className="border-b border-[#00ff66]/15 p-5 last:border-b-0 sm:p-7">
              <h2 className="text-xs font-black uppercase tracking-[0.18em] text-[#00ff66]/75">{group}</h2>
              <div className="mt-4 grid border-l border-t border-[#00ff66]/15 sm:grid-cols-2 xl:grid-cols-3">
                {groupPanels.map((panel) => {
                  const Icon = panel.icon;
                  const access = session?.permissions[panel.permission] || "none";
                  return (
                    <button key={panel.id} type="button" onClick={() => openPanel(panel.id)}
                      className="group min-h-40 border-b border-r border-[#00ff66]/15 bg-[#020806] p-5 text-left transition hover:bg-[#00ff66]/7 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-[#00ff66]">
                      <div className="flex items-start justify-between gap-4">
                        <span className="grid h-11 w-11 place-items-center border border-[#00ff66]/30 bg-[#00ff66]/5 text-[#00ff66] transition group-hover:border-[#00ff66]/60">
                          <Icon size={20} />
                        </span>
                        <span className="border border-white/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-[#789082]">{access}</span>
                      </div>
                      <h3 className="mt-5 text-lg font-black text-white">{panel.title}</h3>
                      <p className="mt-2 text-xs leading-5 text-[#789082]">{panel.description}</p>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
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
