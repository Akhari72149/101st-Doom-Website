"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, TriangleAlert, X } from "lucide-react";
import type { PublicUpdateStatus } from "@/lib/website-update-status";

export default function WebsiteUpdateNotice() {
  const [status, setStatus] = useState<PublicUpdateStatus | null>(null);
  const [dismissedJob, setDismissedJob] = useState("");
  const reloadTimer = useRef<number | null>(null);
  const observedActiveJobs = useRef(new Set<string>());

  const poll = useCallback(async () => {
    try {
      const response = await fetch("/api/website-update-status", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return;
      const body = (await response.json()) as PublicUpdateStatus;
      if (body.active && body.job) observedActiveJobs.current.add(body.job.id);
      setStatus(body);
    } catch {
      // Keep the last known stage visible while the website process changes over.
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void poll(), 0);
    const timer = window.setInterval(() => void poll(), status?.active ? 2_000 : 5_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [poll, status?.active]);

  const job = status?.job;
  useEffect(() => {
    if (!job || job.status !== "succeeded") return;
    if (!observedActiveJobs.current.has(job.id)) return;
    const reloadKey = `website-update-reloaded:${job.id}`;
    if (window.sessionStorage.getItem(reloadKey)) return;
    window.sessionStorage.setItem(reloadKey, "true");
    reloadTimer.current = window.setTimeout(() => window.location.reload(), 2_500);
    return () => {
      if (reloadTimer.current) window.clearTimeout(reloadTimer.current);
    };
  }, [job]);

  if (!job || dismissedJob === job.id) return null;

  const active = job.status === "pending" || job.status === "running";
  const failed = job.status === "failed";
  const complete = job.status === "succeeded";
  const title = failed
    ? "Website update needs attention"
    : complete
      ? "Website update complete"
      : job.stage === "countdown"
        ? "Website update starting"
        : "Website update in progress";

  return (
    <aside
      aria-live="polite"
      aria-label="Website update status"
      className={`fixed bottom-4 right-4 z-[100] w-[calc(100vw-2rem)] max-w-sm border bg-[#020806]/96 p-4 shadow-[0_0_35px_rgba(0,0,0,0.7)] backdrop-blur-xl sm:bottom-6 sm:right-6 ${
        failed ? "border-red-400/55" : complete ? "border-[#00ff66]/55" : "border-cyan-400/55"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 ${failed ? "text-red-300" : complete ? "text-[#00ff66]" : "text-cyan-300"}`}>
          {failed ? <TriangleAlert size={20} /> : complete ? <CheckCircle2 size={20} /> : <Loader2 className="animate-spin" size={20} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-black uppercase tracking-[0.1em] text-white">{title}</div>
          <div className="mt-1 text-xs leading-5 text-gray-300">{job.message}</div>
        </div>
        {!active && (
          <button
            type="button"
            onClick={() => setDismissedJob(job.id)}
            aria-label="Dismiss update status"
            className="grid h-8 w-8 shrink-0 place-items-center border border-white/10 text-gray-400 transition hover:border-white/25 hover:text-white"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="mt-4 h-1.5 overflow-hidden bg-white/10">
        <div
          className={`h-full transition-[width] duration-700 ${failed ? "bg-red-400" : complete ? "bg-[#00ff66]" : "bg-cyan-300"}`}
          style={{ width: `${Math.max(2, Math.min(100, job.progress))}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500">
        <span>{job.stage}</span>
        <span>{job.progress}%</span>
      </div>
    </aside>
  );
}
