"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Award, BadgeCheck, BriefcaseBusiness, Search, Shield, Users } from "lucide-react";
import type { CommunityResponse } from "@/lib/community-types";

type View = "leadership" | "certifications" | "roles";

const roleLabels: Record<string, string> = {
  trainer: "Trainer",
  nco: "NCO",
  recruiter: "Recruiter",
  "drill-instructor": "Drill Instructor",
  "server-maintenance": "Server Maintenance",
};

const roleStyles: Record<string, string> = {
  trainer: "border-cyan-400/40 bg-cyan-400/10 text-cyan-300",
  nco: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  recruiter: "border-violet-400/40 bg-violet-400/10 text-violet-300",
  "drill-instructor": "border-red-400/40 bg-red-400/10 text-red-300",
  "server-maintenance": "border-blue-400/40 bg-blue-400/10 text-blue-300",
};

export default function WhosWhoPage() {
  const [data, setData] = useState<CommunityResponse | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<View>("leadership");

  useEffect(() => {
    let active = true;
    void fetch("/api/community", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load the unit directory.");
        const body = await response.json() as CommunityResponse;
        if (active) setData(body);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Unable to load the unit directory.");
      });
    return () => { active = false; };
  }, []);

  const term = search.trim().toLowerCase();
  const leadership = useMemo(() => (data?.leadership || []).filter((person) =>
    `${person.name} ${person.rank} ${person.slotLabel} ${person.section} ${person.subsection} ${person.mos || ""}`.toLowerCase().includes(term)
  ), [data, term]);
  const leads = useMemo(() => (data?.certificationLeads || []).filter((lead) =>
    `${lead.family} ${lead.person.name} ${lead.person.rank} ${lead.certifications.join(" ")}`.toLowerCase().includes(term)
  ), [data, term]);
  const contacts = useMemo(() => (data?.roleContacts || []).filter((contact) =>
    `${contact.name} ${contact.person?.rank || ""} ${contact.person?.slotLabel || ""} ${contact.tags.map((tag) => roleLabels[tag] || tag).join(" ")}`.toLowerCase().includes(term)
  ), [data, term]);
  const leadershipGroups = useMemo(() => {
    const groups = new Map<string, typeof leadership>();
    for (const person of leadership) groups.set(person.section, [...(groups.get(person.section) || []), person]);
    return [...groups.entries()];
  }, [leadership]);

  const views: Array<{ key: View; label: string; count: number; icon: typeof Users }> = [
    { key: "leadership", label: "Command & Leadership", count: data?.leadership.length || 0, icon: Shield },
    { key: "certifications", label: "Certification Leads", count: data?.certificationLeads.length || 0, icon: BadgeCheck },
    { key: "roles", label: "Unit Roles", count: data?.roleContacts.length || 0, icon: BriefcaseBusiness },
  ];

  return (
    <main className="min-h-screen bg-[#010704] text-white">
      <header className="border-b border-[#00ff66]/20 bg-[linear-gradient(100deg,#020906_0%,#04140c_65%,#020906_100%)]">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-8 px-5 py-10 sm:px-8 lg:py-14">
          <div className="max-w-4xl">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#00ff66]"><Users className="h-4 w-4" /> Unit Directory</p>
            <h1 className="mt-3 text-4xl font-black uppercase tracking-normal sm:text-6xl">Who&apos;s Who</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[#9ab3a4]">Find the people responsible for unit leadership, certification standards, training, recruitment, and essential support roles.</p>
          </div>
          <Image src="/icons/DBLogo.jpg" alt="101st Doom Battalion" width={144} height={144} className="hidden h-36 w-36 border border-[#00ff66]/25 object-cover opacity-80 lg:block" />
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8">
        <section className="grid border border-[#00ff66]/20 bg-[#020b07] sm:grid-cols-3">
          {views.map(({ key, label, count, icon: Icon }) => (
            <button key={key} type="button" onClick={() => setView(key)} className={`flex min-h-20 items-center justify-between gap-4 border-b border-[#00ff66]/15 px-5 text-left transition last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 ${view === key ? "bg-[#00ff66]/10 text-[#00ff66]" : "text-[#8da396] hover:bg-white/[0.025] hover:text-white"}`}>
              <span className="flex items-center gap-3"><Icon className="h-5 w-5" /><span className="text-sm font-bold uppercase">{label}</span></span>
              <span className="font-mono text-xl">{count}</span>
            </button>
          ))}
        </section>

        <label className="relative mt-5 block">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#00ff66]/55" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by person, rank, appointment, certification, or role" className="h-14 w-full border border-[#00ff66]/20 bg-black/60 pl-12 pr-4 text-sm outline-none placeholder:text-[#63756a] focus:border-[#00ff66]/70" />
        </label>

        {error && <div className="mt-6 border border-red-400/35 bg-red-950/20 p-5 text-red-300">{error}</div>}
        {!data && !error && <div className="mt-6 border border-[#00ff66]/15 p-10 text-center uppercase text-[#789383]">Loading directory...</div>}

        {data && view === "leadership" && (
          <div className="mt-8 space-y-9">
            {leadershipGroups.map(([section, people]) => (
              <section key={section}>
                <div className="mb-3 flex items-center gap-3"><div className="h-px flex-1 bg-[#00ff66]/20" /><h2 className="text-xs font-black uppercase tracking-[0.16em] text-[#00ff66]">{section}</h2><div className="h-px flex-1 bg-[#00ff66]/20" /></div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {people.map((person) => (
                    <article key={person.id} className="border border-[#00ff66]/18 bg-[#020b07] p-5 transition hover:border-[#00ff66]/45 hover:bg-[#04120b]">
                      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase text-[#00ff66]">{person.slotLabel}</p><h3 className="mt-2 text-2xl font-black">{person.name}</h3></div><Shield className="h-6 w-6 shrink-0 text-[#00ff66]/45" /></div>
                      <p className="mt-3 text-sm text-[#91a99a]">{person.rank} · {person.subsection}</p>
                    </article>
                  ))}
                </div>
              </section>
            ))}
            {!leadership.length && <EmptyState />}
          </div>
        )}

        {data && view === "certifications" && (
          <section className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {leads.map((lead) => (
              <article key={`${lead.person.id}-${lead.family}`} className="border border-[#00ff66]/18 bg-[#020b07] p-5">
                <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase text-cyan-300">{lead.family}</p><h2 className="mt-2 text-2xl font-black">{lead.person.name}</h2></div><BadgeCheck className="h-7 w-7 text-cyan-300/70" /></div>
                <p className="mt-2 text-sm text-[#91a99a]">{lead.person.rank} · {lead.person.slotLabel}</p>
                <p className="mt-4 border-t border-white/10 pt-3 text-xs leading-5 text-[#70877a]">Responsible for {lead.certifications.join(", ")}</p>
              </article>
            ))}
            {!leads.length && <EmptyState />}
          </section>
        )}

        {data && view === "roles" && (
          <section className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {contacts.map((contact) => (
              <article key={contact.userId} className="border border-[#00ff66]/18 bg-[#020b07] p-5">
                <div className="flex items-start justify-between gap-4"><div><h2 className="text-2xl font-black">{contact.name}</h2><p className="mt-2 text-sm text-[#91a99a]">{contact.person ? `${contact.person.rank} · ${contact.person.slotLabel}` : "Website account"}</p></div><Award className="h-6 w-6 text-[#00ff66]/55" /></div>
                <div className="mt-4 flex flex-wrap gap-2">{contact.tags.map((tag) => <span key={tag} className={`border px-2.5 py-1 text-[10px] font-black uppercase ${roleStyles[tag] || "border-white/20 text-white"}`}>{roleLabels[tag] || tag}</span>)}</div>
              </article>
            ))}
            {!contacts.length && <EmptyState />}
          </section>
        )}
      </div>
    </main>
  );
}

function EmptyState() {
  return <div className="col-span-full border border-[#00ff66]/15 bg-black/40 p-12 text-center text-[#789383]">No matching directory entries found.</div>;
}
