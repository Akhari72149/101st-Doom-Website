"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  CalendarDays,
  Check,
  Clock3,
  Gamepad2,
  History,
  Link2Off,
  Loader2,
  Monitor,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  UserRoundCheck,
  UserRoundCog,
  X,
} from "lucide-react";
import { getAppAuthHeaders, getAppSession, hasAppPermission } from "@/lib/client-auth";

type Certification = {
  id: string;
  name: string;
  discordRoleId: string | null;
};

type Rank = { id: string; name: string; rank_level: number };
type WebsiteAccount = { id: string; username: string | null; displayName: string; disabled: boolean; matchType: "linked" | "name-match" };
type SteamLink = { steamId: string; displayName: string | null; profileUrl: string; linkedAt: string };
type HistoryEntry = { id: string; action: string; details: string | null; created_at: string; actor: string };

type Personnel = {
  id: string;
  name: string;
  birth_number: string | null;
  rank_id: string | null;
  discord_id: string;
  ts_id: string | null;
  status: string | null;
  slotted_position: string | null;
  reservist_since: string | null;
  join_date: string;
  rank_name: string | null;
  certification_count: number;
  certifications: Certification[];
  steam_link: SteamLink | null;
  website_account: WebsiteAccount | null;
  recent_history: HistoryEntry[];
};

type ViewMode = "active" | "inactive";

function displayStatus(person: Personnel) {
  if (person.reservist_since && !person.status?.trim()) return "Reservist";
  return person.status?.trim() || "Active";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function actionLabel(action: string) {
  return action.toLowerCase().replace(/^personnel_/, "").replaceAll("_", " ");
}

export default function PersonnelProfilesAdminPage() {
  const router = useRouter();
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [canReactivate, setCanReactivate] = useState(false);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("active");
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [joinDate, setJoinDate] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [reactivating, setReactivating] = useState<Personnel | null>(null);
  const [retainedCertifications, setRetainedCertifications] = useState<string[]>([]);
  const [reactivationReason, setReactivationReason] = useState("");
  const [reactivationRankId, setReactivationRankId] = useState("");

  const selected = useMemo(
    () => personnel.find((person) => person.id === selectedId) || null,
    [personnel, selectedId],
  );

  const completeness = useMemo(() => {
    if (!selected) return { complete: 0, total: 7, missing: [] as string[] };
    const checks = [
      ["website account", Boolean(selected.website_account)],
      ["Discord link", Boolean(selected.discord_id)],
      ["Steam link", Boolean(selected.steam_link)],
      ["TeamSpeak ID", Boolean(selected.ts_id)],
      ["rank", Boolean(selected.rank_id)],
      ["service number", Boolean(selected.birth_number)],
      ["join date", Boolean(selected.join_date)],
    ] as const;
    return { complete: checks.filter(([, present]) => present).length, total: checks.length, missing: checks.filter(([, present]) => !present).map(([label]) => label) };
  }, [selected]);

  const loadPersonnel = useCallback(async (mode: ViewMode, search: string, preserveSelection = true) => {
    setLoading(true);
    setStatus(null);
    const response = await fetch(
      `/api/admin/personnel-profiles?view=${mode}&q=${encodeURIComponent(search.trim())}`,
      { cache: "no-store", credentials: "same-origin", headers: await getAppAuthHeaders() },
    );
    const body = await response.json().catch(() => null) as { personnel?: Personnel[]; ranks?: Rank[]; error?: string } | null;
    if (!response.ok) {
      setPersonnel([]);
      setSelectedId(null);
      setStatus(body?.error || "Failed to load personnel profiles");
    } else {
      const rows = body?.personnel || [];
      setPersonnel(rows);
      setRanks(body?.ranks || []);
      setSelectedId((current) => preserveSelection && rows.some((person) => person.id === current) ? current : null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = await getAppSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      if (!hasAppPermission(session, "admin.personnel-profiles", "read")) {
        router.replace("/");
        return;
      }
      if (cancelled) return;
      setCanEdit(hasAppPermission(session, "admin.personnel-profiles", "edit"));
      setCanReactivate(hasAppPermission(session, "admin.personnel-profiles", "full"));
      setLoadingAuth(false);
    })();
    return () => { cancelled = true; };
  }, [router]);

  useEffect(() => {
    if (loadingAuth) return;
    const timer = window.setTimeout(() => loadPersonnel(view, query), 250);
    return () => window.clearTimeout(timer);
  }, [loadingAuth, loadPersonnel, query, view]);

  async function runAction(payload: Record<string, unknown>) {
    setSaving(true);
    setStatus(null);
    const response = await fetch("/api/admin/personnel-profiles", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(await getAppAuthHeaders()) },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => null) as { error?: string } | null;
    setSaving(false);
    if (!response.ok) {
      setStatus(body?.error || "Failed to update personnel profile");
      return false;
    }
    return true;
  }

  async function saveJoinDate() {
    if (!selected || !canEdit || !joinDate) return;
    if (await runAction({ action: "update-join-date", personnelId: selected.id, joinDate })) {
      await loadPersonnel(view, query);
      setStatus(`Join date updated for ${selected.name}.`);
    }
  }

  async function unlinkDiscord() {
    if (!selected || !canEdit || !selected.discord_id) return;
    if (!window.confirm(`Unlink the Discord account from ${selected.name}?`)) return;
    if (await runAction({ action: "unlink-discord", personnelId: selected.id })) {
      await loadPersonnel(view, query);
      setStatus(`Discord account unlinked from ${selected.name}.`);
    }
  }

  function openReactivation(person: Personnel) {
    if (!canReactivate) return;
    setReactivating(person);
    setRetainedCertifications(person.certifications.map((certification) => certification.id));
    setReactivationReason("");
    setReactivationRankId(person.rank_id || "");
  }

  async function confirmReactivation() {
    if (!reactivating || !canReactivate) return;
    const name = reactivating.name;
    const ok = await runAction({
      action: "reactivate",
      personnelId: reactivating.id,
      keepCertificationIds: retainedCertifications,
      reason: reactivationReason,
      rankId: reactivationRankId,
    });
    if (!ok) return;
    setReactivating(null);
    setSelectedId(null);
    await loadPersonnel("inactive", query, false);
    setStatus(`${name} has been reactivated.`);
  }

  async function setReservist(reservist: boolean) {
    if (!selected || !canEdit) return;
    const message = reservist
      ? `Move ${selected.name} into reserves? Their current slot will be cleared.`
      : `Return ${selected.name} from reserves? They will remain unassigned.`;
    if (!window.confirm(message)) return;
    if (await runAction({ action: "set-reservist", personnelId: selected.id, reservist })) {
      await loadPersonnel(view, query);
      setStatus(reservist ? `${selected.name} moved into reserves.` : `${selected.name} returned from reserves.`);
    }
  }

  if (loadingAuth) {
    return <main className="flex min-h-screen items-center justify-center bg-black text-[#00ff66]">Checking permissions...</main>;
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(rgba(0,255,102,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,102,0.025)_1px,transparent_1px),#000805] bg-[size:48px_48px] px-4 py-10 text-white sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="border-b border-[#00ff66]/20 pb-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#00ff66]/65">Personnel Administration</p>
              <h1 className="mt-2 text-3xl font-black uppercase tracking-[0.08em] sm:text-4xl">Personnel Profiles</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#9ab6a6]">Review active and archived dossiers, correct join dates, manage Discord links, and restore personnel records.</p>
            </div>
            <div className="flex border border-[#00ff66]/25 bg-black/60 p-1">
              {(["active", "inactive"] as ViewMode[]).map((mode) => (
                <button key={mode} type="button" onClick={() => { setView(mode); setSelectedId(null); }}
                  className={`min-h-10 px-5 text-xs font-bold uppercase tracking-[0.16em] transition ${view === mode ? "bg-[#00ff66] text-black" : "text-[#8ca899] hover:bg-[#00ff66]/10 hover:text-[#00ff66]"}`}>
                  {mode === "active" ? "Active" : "Retired / Removed"}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.5fr)]">
          <section className="border border-[#00ff66]/20 bg-black/70">
            <div className="border-b border-[#00ff66]/15 p-4">
              <label className="relative block">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#00ff66]/60" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${view} profiles by name...`}
                  className="min-h-12 w-full border border-[#00ff66]/20 bg-[#020806] pl-11 pr-4 text-sm outline-none placeholder:text-gray-600 focus:border-[#00ff66]/60" />
              </label>
            </div>
            <div className="max-h-[650px] overflow-y-auto">
              {loading ? (
                <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-[#7f9a8b]"><Loader2 className="h-4 w-4 animate-spin" /> Loading dossiers</div>
              ) : personnel.length === 0 ? (
                <div className="min-h-40 p-6 text-center text-sm text-[#7f9a8b]">No matching profiles found.</div>
              ) : personnel.map((person) => (
                <button key={person.id} type="button" onClick={() => { setSelectedId(person.id); setJoinDate(person.join_date); }}
                  className={`grid w-full grid-cols-[1fr_auto] items-center gap-4 border-b border-[#00ff66]/10 p-4 text-left transition last:border-b-0 ${selectedId === person.id ? "bg-[#00ff66]/12" : "hover:bg-[#00ff66]/[0.05]"}`}>
                  <span className="min-w-0">
                    <span className="block truncate font-bold">{person.name}</span>
                    <span className="mt-1 block truncate text-xs text-[#779184]">{person.rank_name || "Unranked"} · {person.birth_number || "No service number"}</span>
                  </span>
                  <span className={`border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${view === "active" ? "border-[#00ff66]/30 text-[#00ff66]" : "border-amber-300/30 text-amber-200"}`}>{displayStatus(person)}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="min-h-[500px] border border-[#00ff66]/20 bg-black/70">
            {!selected ? (
              <div className="flex min-h-[500px] flex-col items-center justify-center p-8 text-center">
                <UserRoundCog className="h-10 w-10 text-[#00ff66]/45" />
                <h2 className="mt-4 text-lg font-bold uppercase tracking-[0.1em]">Select a dossier</h2>
                <p className="mt-2 text-sm text-[#789083]">Choose a personnel profile to inspect its account details.</p>
              </div>
            ) : (
              <div>
                <div className="flex flex-col gap-4 border-b border-[#00ff66]/15 p-6 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#00ff66]/60">{selected.rank_name || "Unranked"}</p>
                    <h2 className="mt-1 text-2xl font-black">{selected.name}</h2>
                    <p className="mt-1 text-sm text-[#7f9a8b]">{selected.slotted_position || "No assigned position"}</p>
                  </div>
                  <span className="self-start border border-[#00ff66]/30 bg-[#00ff66]/8 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#00ff66]">{displayStatus(selected)}</span>
                </div>

                <div className="border-b border-[#00ff66]/15 p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#00ff66]/70"><Activity className="h-4 w-4" /> Profile Completeness</div>
                      <p className="mt-2 text-2xl font-black">{Math.round((completeness.complete / completeness.total) * 100)}%</p>
                    </div>
                    <p className="max-w-xl text-sm text-[#8ca497]">{completeness.missing.length ? `Missing: ${completeness.missing.join(", ")}` : "All tracked profile fields are complete."}</p>
                  </div>
                  <div className="mt-4 h-2 border border-[#00ff66]/20 bg-black">
                    <div className="h-full bg-[#00ff66] transition-[width]" style={{ width: `${(completeness.complete / completeness.total) * 100}%` }} />
                  </div>
                </div>

                <div className="border-b border-[#00ff66]/15 p-6">
                  <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#00ff66]/70"><UserRoundCheck className="h-4 w-4" /> Identity Overview</div>
                  <div className="grid gap-px border border-[#00ff66]/15 bg-[#00ff66]/15 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      { label: "Website", value: selected.website_account?.displayName || "Not linked", detail: selected.website_account ? `@${selected.website_account.username || "unknown"}${selected.website_account.disabled ? " · Disabled" : selected.website_account.matchType === "name-match" ? " · Matched by profile name" : " · Linked"}` : "No matching account", linked: Boolean(selected.website_account) && !selected.website_account?.disabled, icon: UserRoundCheck },
                      { label: "Discord", value: selected.discord_id || "Not linked", detail: selected.discord_id ? "Discord ID confirmed" : "No Discord ID", linked: Boolean(selected.discord_id), icon: ShieldCheck },
                      { label: "Steam", value: selected.steam_link?.displayName || selected.steam_link?.steamId || "Not linked", detail: selected.steam_link ? selected.steam_link.steamId : "No Steam ID", linked: Boolean(selected.steam_link), icon: Gamepad2 },
                      { label: "TeamSpeak", value: selected.ts_id || "Not linked", detail: selected.ts_id ? "TeamSpeak identity stored" : "No TeamSpeak ID", linked: Boolean(selected.ts_id), icon: Monitor },
                    ].map(({ label, value, detail, linked, icon: Icon }) => (
                      <div key={label} className="min-w-0 bg-[#001009] p-4">
                        <div className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] ${linked ? "text-[#00ff66]" : "text-amber-200"}`}><Icon className="h-4 w-4" /> {label}</div>
                        <p className="mt-3 truncate text-sm font-bold" title={value}>{value}</p>
                        <p className="mt-1 truncate text-xs text-[#71877a]" title={detail}>{detail}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-5 p-6 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="border border-[#00ff66]/15 bg-[#001009]/55 p-5">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#00ff66]/70"><CalendarDays className="h-4 w-4" /> Join Date</div>
                    <input type="date" value={joinDate} onChange={(event) => setJoinDate(event.target.value)} disabled={!canEdit || saving}
                      className="mt-4 min-h-12 w-full border border-[#00ff66]/25 bg-black px-4 text-white outline-none focus:border-[#00ff66]/60 disabled:cursor-not-allowed disabled:opacity-55" />
                    <button type="button" onClick={saveJoinDate} disabled={!canEdit || saving || !joinDate || joinDate === selected.join_date}
                      className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 border border-[#00ff66]/35 bg-[#00ff66]/10 px-4 text-xs font-bold uppercase tracking-[0.14em] text-[#00ff66] transition hover:bg-[#00ff66]/20 disabled:cursor-not-allowed disabled:opacity-40">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save Join Date
                    </button>
                  </div>

                  <div className="border border-[#00ff66]/15 bg-[#001009]/55 p-5">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#00ff66]/70"><ShieldCheck className="h-4 w-4" /> Discord Link</div>
                    <p className="mt-4 break-all font-mono text-sm text-[#b7cec0]">{selected.discord_id || "Not linked"}</p>
                    <button type="button" onClick={unlinkDiscord} disabled={!canEdit || saving || !selected.discord_id}
                      className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 border border-red-500/35 bg-red-500/10 px-4 text-xs font-bold uppercase tracking-[0.14em] text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40">
                      <Link2Off className="h-4 w-4" /> Unlink Discord
                    </button>
                  </div>

                  <div className="border border-[#00ff66]/15 bg-[#001009]/55 p-5 sm:col-span-2 xl:col-span-1">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#00ff66]/70"><Clock3 className="h-4 w-4" /> Reservist Status</div>
                    <p className="mt-4 text-sm text-[#b7cec0]">{selected.reservist_since ? `Reservist since ${formatDateTime(selected.reservist_since)}` : "Active service"}</p>
                    <button type="button" onClick={() => setReservist(!selected.reservist_since)} disabled={!canEdit || saving || view === "inactive"}
                      className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 border border-cyan-400/35 bg-cyan-400/10 px-4 text-xs font-bold uppercase tracking-[0.14em] text-cyan-200 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-40">
                      <RefreshCw className="h-4 w-4" /> {selected.reservist_since ? "Return to Active" : "Move to Reserves"}
                    </button>
                  </div>
                </div>

                <div className="border-t border-[#00ff66]/15 p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#00ff66]/70">Certifications / Discord Tags</p>
                      <p className="mt-2 text-sm text-[#8ca497]">{selected.certification_count} currently assigned</p>
                    </div>
                    {view === "inactive" && (
                      <button type="button" onClick={() => openReactivation(selected)} disabled={!canReactivate || saving}
                        className="inline-flex min-h-12 items-center justify-center gap-2 border border-[#00ff66]/40 bg-[#00ff66]/15 px-5 text-xs font-black uppercase tracking-[0.14em] text-[#00ff66] transition hover:bg-[#00ff66]/25 disabled:cursor-not-allowed disabled:opacity-40">
                        <RotateCcw className="h-4 w-4" /> Reactivate Profile
                      </button>
                    )}
                  </div>
                  {!canEdit && <p className="mt-4 border border-amber-300/20 bg-amber-300/5 p-3 text-xs text-amber-100">View access only. Edit permission is required to change profile details.</p>}
                  {view === "inactive" && canEdit && !canReactivate && <p className="mt-4 border border-amber-300/20 bg-amber-300/5 p-3 text-xs text-amber-100">Full permission is required to reactivate a profile.</p>}
                </div>

                <div className="border-t border-[#00ff66]/15 p-6">
                  <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#00ff66]/70"><History className="h-4 w-4" /> Recent Change History</div>
                  {selected.recent_history.length === 0 ? (
                    <div className="border border-[#00ff66]/15 bg-black/40 p-4 text-sm text-[#7f9588]">No tracked profile changes yet.</div>
                  ) : (
                    <div className="border border-[#00ff66]/15">
                      {selected.recent_history.map((entry) => (
                        <div key={entry.id} className="grid gap-2 border-b border-[#00ff66]/10 p-4 last:border-b-0 sm:grid-cols-[minmax(150px,0.55fr)_minmax(0,1fr)]">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#00ff66]">{actionLabel(entry.action)}</p>
                            <p className="mt-1 text-[11px] text-[#708579]">{formatDateTime(entry.created_at)} · {entry.actor}</p>
                          </div>
                          <p className="text-sm leading-6 text-[#a7bdaf]">{entry.details || "No additional details recorded."}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>

        {status && <div className="mt-5 flex items-center justify-between border border-[#00ff66]/25 bg-[#00130b] p-4 text-sm text-[#b8ffd3]"><span>{status}</span><button type="button" onClick={() => setStatus(null)} aria-label="Dismiss"><X className="h-4 w-4" /></button></div>}
      </div>

      {reactivating && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4" role="dialog" aria-modal="true" aria-labelledby="reactivation-title">
          <section className="max-h-[90vh] w-full max-w-2xl overflow-hidden border border-[#00ff66]/30 bg-[#020806] shadow-[0_0_60px_rgba(0,255,102,0.12)]">
            <div className="flex items-start justify-between gap-4 border-b border-[#00ff66]/15 p-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#00ff66]/60">Restore Personnel Record</p>
                <h2 id="reactivation-title" className="mt-1 text-xl font-black">Reactivate {reactivating.name}</h2>
                <p className="mt-2 text-sm text-[#8aa092]">Choose their returning rank and which certifications or Discord tags remain.</p>
              </div>
              <button type="button" onClick={() => setReactivating(null)} aria-label="Close reactivation dialog" className="border border-white/10 p-2 text-gray-400 hover:border-[#00ff66]/35 hover:text-[#00ff66]"><X className="h-5 w-5" /></button>
            </div>
            <div className="max-h-[55vh] overflow-y-auto p-5">
              <div className="mb-5 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#00ff66]/70">Returning Rank</span>
                  <select value={reactivationRankId} onChange={(event) => setReactivationRankId(event.target.value)} className="mt-2 min-h-12 w-full border border-[#00ff66]/25 bg-black px-4 text-white outline-none focus:border-[#00ff66]/60">
                    <option value="">Select rank</option>
                    {ranks.map((rank) => <option key={rank.id} value={rank.id}>{rank.name}</option>)}
                  </select>
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#00ff66]/70">Reactivation Reason</span>
                  <textarea value={reactivationReason} onChange={(event) => setReactivationReason(event.target.value)} maxLength={500} rows={3} placeholder="Record why this profile is being reinstated..." className="mt-2 w-full resize-y border border-[#00ff66]/25 bg-black p-4 text-sm text-white outline-none placeholder:text-gray-600 focus:border-[#00ff66]/60" />
                </label>
              </div>
              {reactivating.certifications.length === 0 ? (
                <div className="border border-[#00ff66]/15 bg-black/50 p-5 text-sm text-[#879d90]">No certifications or Discord tags are currently assigned.</div>
              ) : (
                <div className="border border-[#00ff66]/15">
                  {reactivating.certifications.map((certification) => {
                    const checked = retainedCertifications.includes(certification.id);
                    return (
                      <label key={certification.id} className="flex cursor-pointer items-center gap-4 border-b border-[#00ff66]/10 p-4 last:border-b-0 hover:bg-[#00ff66]/[0.04]">
                        <input type="checkbox" checked={checked} onChange={() => setRetainedCertifications((current) => checked ? current.filter((id) => id !== certification.id) : [...current, certification.id])} className="h-4 w-4 accent-[#00ff66]" />
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold">{certification.name}</span>
                          <span className="mt-1 block text-xs text-[#72877a]">{certification.discordRoleId ? "Linked Discord tag" : "Website certification only"}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
              <p className="mt-4 border border-amber-300/20 bg-amber-300/5 p-4 text-xs leading-5 text-amber-100">Unselected certifications will be permanently removed. The profile will return as active and remain without a slot until reassigned.</p>
            </div>
            <div className="flex flex-col gap-3 border-t border-[#00ff66]/15 p-5 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setReactivating(null)} disabled={saving} className="min-h-11 border border-white/15 px-5 text-xs font-bold uppercase tracking-[0.14em] text-gray-300 hover:border-white/30">Cancel</button>
              <button type="button" onClick={confirmReactivation} disabled={saving || !reactivationRankId || reactivationReason.trim().length < 3} className="inline-flex min-h-11 items-center justify-center gap-2 border border-[#00ff66]/40 bg-[#00ff66]/15 px-5 text-xs font-black uppercase tracking-[0.14em] text-[#00ff66] hover:bg-[#00ff66]/25 disabled:cursor-not-allowed disabled:opacity-45">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Confirm Reactivation
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
