"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Check, CheckCircle2, ChevronLeft, Send, ShieldCheck } from "lucide-react";
import { serviceNumberError, type RecruitmentBlock } from "@/lib/recruitment";

export default function RecruitmentPage() {
  const [blocks, setBlocks] = useState<RecruitmentBlock[]>([]);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    void fetch("/api/recruitment", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as { blocks?: RecruitmentBlock[]; error?: string };
        if (!response.ok) throw new Error(body.error || "Unable to load the recruitment form");
        setBlocks(body.blocks || []);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load the recruitment form"))
      .finally(() => setLoading(false));
  }, []);

  function setAnswer(key: string, value: string) {
    setAnswers((current) => ({ ...current, [key]: value }));
  }

  function toggleMulti(key: string, value: string) {
    setAnswers((current) => {
      const selected = Array.isArray(current[key]) ? current[key] as string[] : [];
      return { ...current, [key]: selected.includes(value) ? selected.filter((entry) => entry !== value) : [...selected, value] };
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/recruitment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, website: "" }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to submit your application");
      setComplete(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to submit your application");
    } finally {
      setSaving(false);
    }
  }

  if (complete) return <main className="min-h-screen bg-[#020806] px-4 py-16 text-white">
    <section className="mx-auto max-w-2xl border border-[#00ff66]/35 bg-black/70 p-8 text-center sm:p-12">
      <CheckCircle2 className="mx-auto h-14 w-14 text-[#00ff66]" />
      <p className="mt-5 text-xs font-black uppercase tracking-[.2em] text-[#00ff66]">Response received</p>
      <h1 className="mt-3 text-3xl font-black uppercase">Recruitment application submitted</h1>
      <p className="mx-auto mt-4 max-w-xl leading-7 text-[#9ab0a4]">Join the unit Discord, ping <strong className="text-white">Recruiter</strong> in Recruitment Text, and enter TeamSpeak so the recruitment team can continue your application.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3"><Link href="/Join" className="border border-[#00ff66]/40 px-5 py-3 font-bold text-[#00ff66]">How to Join</Link><a href="https://discord.gg/dZhRghrDfX" className="bg-[#00ff66] px-5 py-3 font-bold text-black">Join Discord</a></div>
    </section>
  </main>;

  return <main className="min-h-screen bg-[#020806] px-4 py-8 text-white sm:px-6 lg:px-10">
    <div className="mx-auto max-w-5xl">
      <Link href="/Join" className="inline-flex items-center gap-2 text-sm font-bold text-[#8ba095] hover:text-[#00ff66]"><ChevronLeft size={17}/>Back to How to Join</Link>
      <header className="mt-6 border border-[#00ff66]/30 bg-black/70 p-6 sm:p-9">
        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.2em] text-[#00ff66]"><ShieldCheck size={16}/>101st personnel intake</p>
        <h1 className="mt-3 text-3xl font-black uppercase sm:text-5xl">Recruitment Prescreening</h1>
        <p className="mt-4 max-w-3xl leading-7 text-[#9ab0a4]">Complete this form before speaking with a recruiter. Select every Eastern Time platoon Main Operation that you can regularly attend.</p>
      </header>

      {error && <div className="mt-5 border border-red-500/40 bg-red-950/25 px-5 py-4 text-red-200">{error}</div>}
      {loading ? <div className="mt-5 border border-white/10 p-8 text-[#8ba095]">Loading recruitment form...</div> :
        <form onSubmit={submit} className="mt-5 space-y-4">
          <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
          {blocks.map((block, index) => block.block_type === "information" ?
            <section key={block.id} className="border border-cyan-300/20 bg-cyan-950/10 p-5 sm:p-6">
              <p className="text-[11px] font-black uppercase tracking-[.18em] text-cyan-200">Section {index + 1}</p>
              <h2 className="mt-2 text-xl font-black text-white">{block.title}</h2>
              {block.description && <p className="mt-2 leading-6 text-[#9ab0a4]">{block.description}</p>}
            </section> : block.field_key && block.input_type ?
            <Question key={block.id} block={block} value={answers[block.field_key]} onSet={setAnswer} onToggle={toggleMulti} /> : null)}
          <div className="flex flex-col gap-4 border border-[#00ff66]/25 bg-black/70 p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-2xl text-sm leading-6 text-[#8ba095]">Your response is stored for recruitment administration. Archived applications are retained until an authorised administrator permanently removes them.</p>
            <button disabled={saving} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 bg-[#00ff66] px-6 font-black uppercase text-black hover:bg-[#70ff9f] disabled:opacity-50"><Send size={17}/>{saving ? "Submitting..." : "Submit application"}</button>
          </div>
        </form>}
    </div>
  </main>;
}

function Question({ block, value, onSet, onToggle }: { block: RecruitmentBlock; value: string | string[] | undefined; onSet: (key: string, value: string) => void; onToggle: (key: string, value: string) => void }) {
  const key = block.field_key as string;
  const selected = Array.isArray(value) ? value : [];
  const [availability, setAvailability] = useState<"idle" | "checking" | "available" | "duplicate" | "invalid" | "error">("idle");
  const [validationMessage, setValidationMessage] = useState("");
  const checksPersonnel = key === "nickname" || key === "service_number";

  async function checkAvailability() {
    if (!checksPersonnel || typeof value !== "string" || !value.trim()) { setAvailability("idle"); return; }
    if (key === "service_number") {
      const message = serviceNumberError(value.trim());
      if (message) { setValidationMessage(message); setAvailability("invalid"); return; }
    }
    setValidationMessage("");
    setAvailability("checking");
    try {
      const response = await fetch(`/api/recruitment?check=${key}&value=${encodeURIComponent(value.trim())}`, { cache: "no-store" });
      const body = await response.json() as { duplicate?: boolean };
      if (!response.ok) throw new Error("check failed");
      setAvailability(body.duplicate ? "duplicate" : "available");
    } catch { setAvailability("error"); }
  }

  function updateText(next: string) {
    const cleaned = key === "service_number" ? next.replace(/\D/g, "").slice(0, 5) : next;
    onSet(key, cleaned);
    if (checksPersonnel) { setAvailability("idle"); setValidationMessage(""); }
  }

  return <section className="border border-[#00ff66]/18 bg-black/65 p-5 sm:p-6">
    <label className="text-lg font-bold text-white">{block.title}{block.required && <span className="ml-2 text-[#00ff66]">*</span>}</label>
    {block.description && <p className="mt-2 text-sm leading-6 text-[#8ba095]">{block.description}</p>}
    <div className="mt-4">
      {block.input_type === "text" && <><input required={block.required} inputMode={key === "service_number" ? "numeric" : undefined} maxLength={key === "service_number" ? 5 : 500} value={typeof value === "string" ? value : ""} onChange={(event) => updateText(event.target.value)} onBlur={() => void checkAvailability()} className={`h-12 w-full border bg-black px-4 text-white outline-none ${availability === "duplicate" || availability === "invalid" ? "border-red-500" : availability === "available" ? "border-[#00ff66]" : "border-white/15 focus:border-[#00ff66]"}`} />{checksPersonnel && availability !== "idle" && <p className={`mt-2 text-sm ${availability === "duplicate" || availability === "invalid" ? "text-red-300" : availability === "available" ? "text-[#00ff66]" : availability === "error" ? "text-yellow-300" : "text-[#8ba095]"}`}>{availability === "checking" ? "Checking active personnel records..." : availability === "invalid" ? validationMessage : availability === "duplicate" ? `An active personnel record already uses this ${key === "nickname" ? "nickname" : "service number"}.` : availability === "available" ? `${key === "nickname" ? "Nickname" : "Service number"} is available.` : "Availability could not be checked. It will be checked again when submitted."}</p>}</>}
      {block.input_type === "textarea" && <textarea required={block.required} value={typeof value === "string" ? value : ""} onChange={(event) => onSet(key, event.target.value)} rows={5} className="w-full border border-white/15 bg-black p-4 text-white outline-none focus:border-[#00ff66]" />}
      {["yes_no", "single_choice"].includes(block.input_type || "") && <div className="grid gap-2 sm:grid-cols-2">{block.options.map((option) => <button type="button" key={option} onClick={() => onSet(key, option)} className={`min-h-12 border px-4 text-left font-bold ${value === option ? "border-[#00ff66] bg-[#00ff66]/12 text-[#00ff66]" : "border-white/15 text-[#9ab0a4] hover:border-white/35"}`}>{option}</button>)}</div>}
      {block.input_type === "multi_choice" && <div className="grid gap-2 sm:grid-cols-2">{block.options.map((option) => { const active = selected.includes(option); return <button type="button" key={option} onClick={() => onToggle(key, option)} className={`flex min-h-14 items-center gap-3 border px-4 text-left ${active ? "border-[#00ff66] bg-[#00ff66]/12 text-white" : "border-white/15 text-[#9ab0a4] hover:border-white/35"}`}><span className={`flex h-5 w-5 shrink-0 items-center justify-center border ${active ? "border-[#00ff66] bg-[#00ff66] text-black" : "border-white/30"}`}>{active && <Check size={14}/>}</span><span className="font-bold">{option}</span></button>; })}</div>}
    </div>
  </section>;
}
