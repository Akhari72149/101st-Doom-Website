"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Award, BadgeCheck, CalendarDays, Search, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { AwardIcon } from "@/components/AwardIcon";
import type { CommunityResponse, RecognitionEvent } from "@/lib/community-types";

type EventType = "all" | RecognitionEvent["type"];
type Range = "30" | "90" | "365" | "all";

const typeLabels = { promotion: "Promotion", certification: "Certification", medal: "Medal" } as const;
const typeStyles = {
  promotion: "border-[#00ff66]/40 bg-[#00ff66]/10 text-[#00ff66]",
  certification: "border-cyan-400/40 bg-cyan-400/10 text-cyan-300",
  medal: "border-amber-400/40 bg-amber-400/10 text-amber-300",
};

export default function RecognitionPage() {
  const [events, setEvents] = useState<RecognitionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [referenceTime, setReferenceTime] = useState(0);
  const [type, setType] = useState<EventType>("all");
  const [range, setRange] = useState<Range>("90");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/community", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load battalion recognition.");
        const body = await response.json() as CommunityResponse;
        if (active) {
          setEvents(body.recognition || []);
          setReferenceTime(new Date().getTime());
        }
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Unable to load battalion recognition.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const visible = useMemo(() => {
    const cutoff = range === "all" || referenceTime === 0 ? null : referenceTime - Number(range) * 86400000;
    const term = search.trim().toLowerCase();
    return events.filter((event) => {
      if (type !== "all" && event.type !== type) return false;
      if (cutoff && new Date(event.occurredAt).getTime() < cutoff) return false;
      return `${event.person.name} ${event.person.rank} ${event.title} ${event.detail}`.toLowerCase().includes(term);
    });
  }, [events, range, referenceTime, search, type]);

  const counts = useMemo(() => ({
    promotion: visible.filter((event) => event.type === "promotion").length,
    certification: visible.filter((event) => event.type === "certification").length,
    medal: visible.filter((event) => event.type === "medal").length,
  }), [visible]);

  return (
    <main className="min-h-screen bg-[#010704] text-white">
      <header className="border-b border-[#00ff66]/20 bg-[linear-gradient(100deg,#020906_0%,#101006_58%,#020906_100%)]">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-8 px-5 py-10 sm:px-8 lg:py-14">
          <div className="max-w-4xl">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-amber-300"><Sparkles className="h-4 w-4" /> Battalion Recognition</p>
            <h1 className="mt-3 text-4xl font-black uppercase tracking-normal sm:text-6xl">Service Recognised</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[#a9ad99]">A public record of the people progressing, qualifying, and earning distinction across the 101st Doom Battalion.</p>
          </div>
          <Image src="/icons/DBLogo.jpg" alt="101st Doom Battalion" width={144} height={144} className="hidden h-36 w-36 border border-amber-300/25 object-cover opacity-80 lg:block" />
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8">
        <section className="grid border border-[#00ff66]/20 bg-[#020b07] sm:grid-cols-3">
          <Stat icon={TrendingUp} label="Promotions" value={counts.promotion} color="text-[#00ff66]" />
          <Stat icon={BadgeCheck} label="Qualifications" value={counts.certification} color="text-cyan-300" />
          <Stat icon={Award} label="Medals" value={counts.medal} color="text-amber-300" />
        </section>

        <section className="mt-5 grid gap-3 border border-[#00ff66]/15 bg-black/35 p-4 lg:grid-cols-[1fr_auto_auto]">
          <label className="relative block"><Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#00ff66]/55" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search personnel, rank, certification, or medal" className="h-12 w-full border border-[#00ff66]/20 bg-[#020b07] pl-12 pr-4 text-sm outline-none placeholder:text-[#63756a] focus:border-[#00ff66]/70" /></label>
          <div className="flex min-w-0 overflow-x-auto border border-[#00ff66]/20">
            {(["all", "promotion", "certification", "medal"] as EventType[]).map((item) => <button key={item} type="button" onClick={() => setType(item)} className={`min-h-12 whitespace-nowrap border-r border-[#00ff66]/15 px-4 text-xs font-bold uppercase last:border-r-0 ${type === item ? "bg-[#00ff66] text-black" : "text-[#91a99a] hover:bg-[#00ff66]/10"}`}>{item === "all" ? "All" : typeLabels[item]}</button>)}
          </div>
          <label className="flex items-center gap-2 border border-[#00ff66]/20 bg-[#020b07] px-3"><CalendarDays className="h-4 w-4 text-[#00ff66]" /><select value={range} onChange={(event) => setRange(event.target.value as Range)} className="h-12 bg-transparent text-sm text-white outline-none"><option value="30" className="bg-black">Last 30 days</option><option value="90" className="bg-black">Last 90 days</option><option value="365" className="bg-black">Last year</option><option value="all" className="bg-black">All recorded</option></select></label>
        </section>

        {error && <div className="mt-6 border border-red-400/35 bg-red-950/20 p-5 text-red-300">{error}</div>}
        {loading && <div className="mt-6 border border-[#00ff66]/15 p-10 text-center uppercase text-[#789383]">Loading recognition...</div>}

        {!loading && !error && (
          <section className="mt-8">
            <div className="mb-4 flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#00ff66]">Recognition Timeline</p><h2 className="mt-1 text-2xl font-black">{visible.length} recorded achievements</h2></div><ShieldCheck className="h-7 w-7 text-[#00ff66]/45" /></div>
            <div className="border border-[#00ff66]/15 bg-[#020b07]">
              {visible.map((event) => <RecognitionRow key={event.id} event={event} />)}
              {!visible.length && <div className="p-14 text-center text-[#789383]">No recognition records match the selected filters.</div>}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function Stat({ icon: Icon, label, value, color }: { icon: typeof Award; label: string; value: number; color: string }) {
  return <div className="flex min-h-24 items-center justify-between border-b border-[#00ff66]/15 px-5 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"><div><p className="text-xs font-bold uppercase text-[#748b7d]">{label}</p><p className="mt-1 font-mono text-3xl font-black text-white">{value}</p></div><Icon className={`h-7 w-7 ${color}`} /></div>;
}

function RecognitionRow({ event }: { event: RecognitionEvent }) {
  const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(event.occurredAt));
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(event.occurredAt));
  return (
    <article className="grid gap-4 border-b border-[#00ff66]/10 p-5 last:border-b-0 hover:bg-white/[0.02] md:grid-cols-[56px_minmax(180px,0.8fr)_minmax(260px,1.4fr)_150px] md:items-center">
      <div className={`flex h-12 w-12 items-center justify-center border ${typeStyles[event.type]}`}>{event.type === "medal" ? <AwardIcon iconKey={event.award?.iconKey} className="h-6 w-6" /> : event.type === "promotion" ? <TrendingUp className="h-6 w-6" /> : <BadgeCheck className="h-6 w-6" />}</div>
      <div><h3 className="text-lg font-black">{event.person.name}</h3><p className="mt-1 text-xs text-[#809688]">{event.person.rank} · {event.person.slotLabel}</p></div>
      <div><span className={`inline-block border px-2 py-1 text-[10px] font-black uppercase ${typeStyles[event.type]}`}>{typeLabels[event.type]}</span><h4 className="mt-2 font-bold text-white">{event.title}</h4><p className="mt-1 line-clamp-2 text-sm leading-5 text-[#8fa598]">{event.detail}</p></div>
      <div className="text-left md:text-right"><p className="font-mono text-sm text-white">{date}</p><p className="mt-1 font-mono text-xs text-[#70877a]">{time}</p></div>
    </article>
  );
}
