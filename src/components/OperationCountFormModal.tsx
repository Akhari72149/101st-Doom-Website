"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { GraduationCap, Search, Send, Shield, Swords, X } from "lucide-react";

export type OperationCountPerson = {
  id: string;
  name: string;
  birth_number: string | null;
  rank_stage: "CR" | "CR-C";
  mainOps: number;
  nonMainCredits: number;
  creditedTotal: number;
};

const attendanceTypes = [
  { value: "mainop", label: "Main Operation", detail: "Required at least once", icon: Swords },
  { value: "funop", label: "Fun Operation", detail: "Up to three non-Main credits", icon: Shield },
  { value: "rto-course", label: "RTO Qualification", detail: "CR-C only", icon: GraduationCap },
  { value: "cls-course", label: "CLS Qualification", detail: "CR-C only", icon: GraduationCap },
] as const;

function localToday() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function OperationCountFormModal({
  personnel,
  onClose,
  onSaved,
}: {
  personnel: OperationCountPerson[];
  onClose: () => void;
  onSaved: (name: string) => void | Promise<void>;
}) {
  const [personnelSearch, setPersonnelSearch] = useState("");
  const [personnelId, setPersonnelId] = useState("");
  const [attendanceType, setAttendanceType] = useState("mainop");
  const [hostName, setHostName] = useState("");
  const [occurredOn, setOccurredOn] = useState(localToday());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const selectedPerson = personnel.find((person) => person.id === personnelId) || null;
  const filteredPersonnel = useMemo(() => {
    const query = personnelSearch.trim().toLowerCase();
    return personnel.filter((person) => !query || `${person.name} ${person.birth_number || ""}`.toLowerCase().includes(query));
  }, [personnel, personnelSearch]);

  useEffect(() => {
    if (!selectedPerson) return;
    const isCourse = attendanceType === "rto-course" || attendanceType === "cls-course";
    if ((selectedPerson.rank_stage === "CR" && isCourse) || (selectedPerson.nonMainCredits >= 3 && attendanceType !== "mainop")) {
      setAttendanceType("mainop");
    }
  }, [attendanceType, selectedPerson]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/operation-counts", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personnelId, attendanceType, hostName, occurredOn }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to save operation count");
      await onSaved(selectedPerson?.name || "the selected member");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save operation count");
    } finally {
      setSubmitting(false);
    }
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 backdrop-blur-sm">
    <form onSubmit={submit} className="max-h-[94vh] w-full max-w-3xl overflow-y-auto border border-[#00ff66]/35 bg-[#020806]">
      <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-[#020806] p-5">
        <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#00ff66]">Operation count form</p><h2 className="mt-2 text-2xl font-black uppercase">Submit progression credit</h2></div>
        <button type="button" onClick={onClose} aria-label="Close operation form" className="grid h-10 w-10 place-items-center border border-white/15 text-gray-400"><X size={18}/></button>
      </header>
      <div className="space-y-5 p-5">
        <fieldset><legend className="text-xs font-black uppercase tracking-[.12em] text-gray-400">Personnel</legend><label className="relative mt-3 block"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-600"/><span className="sr-only">Search personnel</span><input value={personnelSearch} onChange={(event) => setPersonnelSearch(event.target.value)} placeholder="Search name or service number" className="h-11 w-full border border-white/15 bg-black pl-10 pr-3 text-sm outline-none focus:border-[#00ff66]/60"/></label><div className="mt-2 max-h-44 overflow-y-auto border border-white/10">{filteredPersonnel.map((person) => <label key={person.id} className={`flex cursor-pointer items-center justify-between gap-3 border-b border-white/8 px-3 py-2.5 last:border-b-0 ${personnelId === person.id ? "bg-[#00ff66]/10" : "hover:bg-white/[.03]"}`}><span className="flex items-center gap-3"><input type="radio" name="personnel" checked={personnelId === person.id} onChange={() => setPersonnelId(person.id)} required className="accent-[#00ff66]"/><span><strong className="block text-sm">{person.name}</strong><span className="text-[10px] text-gray-600">{person.birth_number || "No service number"}</span></span></span><span className="border border-cyan-300/25 px-2 py-1 text-[9px] font-black text-cyan-200">{person.rank_stage}</span></label>)}</div>{selectedPerson && <p className="mt-2 border border-cyan-300/20 bg-cyan-300/[.04] p-3 text-xs text-gray-400"><strong className="text-cyan-200">Current:</strong> {selectedPerson.creditedTotal} credited, {selectedPerson.mainOps} Main Op{selectedPerson.rank_stage === "CR-C" ? " · CR counts included" : ""}</p>}</fieldset>
        <fieldset><legend className="text-xs font-black uppercase tracking-[.12em] text-gray-400">Attendance type</legend><div className="mt-3 grid gap-2 sm:grid-cols-2">{attendanceTypes.map((type) => { const courseDisabled=selectedPerson?.rank_stage === "CR" && (type.value === "rto-course" || type.value === "cls-course"); const capDisabled=Boolean(selectedPerson && selectedPerson.nonMainCredits >= 3 && type.value !== "mainop"); const disabled=!selectedPerson || courseDisabled || capDisabled; const Icon=type.icon; return <label key={type.value} className={`flex items-center gap-3 border p-3 ${disabled ? "cursor-not-allowed border-white/5 opacity-35" : attendanceType === type.value ? "cursor-pointer border-cyan-300 bg-cyan-300/[.08]" : "cursor-pointer border-white/15"}`}><input type="radio" className="sr-only" checked={attendanceType === type.value} onChange={() => setAttendanceType(type.value)} disabled={disabled}/><Icon size={18}/><span><strong className="block text-sm">{type.label}</strong><span className="text-[9px] text-gray-600">{capDisabled ? "Non-Main cap reached" : type.detail}</span></span></label>; })}</div></fieldset>
        <div className="grid gap-4 sm:grid-cols-2"><label><span className="text-xs font-black uppercase tracking-[.12em] text-gray-400">Zeus / operation host</span><input value={hostName} onChange={(event) => setHostName(event.target.value)} required maxLength={120} className="mt-2 h-11 w-full border border-white/15 bg-black px-3 text-sm outline-none focus:border-[#00ff66]/60"/></label><label><span className="text-xs font-black uppercase tracking-[.12em] text-gray-400">Operation date</span><input type="date" value={occurredOn} max={localToday()} onChange={(event) => setOccurredOn(event.target.value)} required className="mt-2 h-11 w-full border border-white/15 bg-black px-3 text-sm outline-none focus:border-[#00ff66]/60"/></label></div>
        {error && <p className="border border-red-300/25 bg-red-300/10 p-3 text-sm text-red-100">{error}</p>}
      </div>
      <footer className="sticky bottom-0 flex justify-end gap-2 border-t border-white/10 bg-[#020806] p-4"><button type="button" onClick={onClose} className="border border-white/15 px-4 py-2 text-sm text-gray-300">Cancel</button><button type="submit" disabled={submitting || !personnelId || !hostName.trim()} className="flex items-center gap-2 border border-[#00ff66] bg-[#00ff66] px-4 py-2 text-sm font-black uppercase text-black disabled:opacity-40"><Send size={16}/>{submitting ? "Submitting..." : "Submit operation"}</button></footer>
    </form>
  </div>;
}
