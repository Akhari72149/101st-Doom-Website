"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Link2, Loader2, RefreshCw, Save, ShieldCheck } from "lucide-react";
import { getAppAuthHeaders, getAppSession, hasAppPermission } from "@/lib/client-auth";

type ManagedLink = {
  key: string;
  label: string;
  description: string;
  url: string;
  updatedAt: string | null;
  updatedBy: string | null;
};

function formatUpdated(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "Seeded website default";
}

function isWebUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export default function JoinPageLinksAdmin() {
  const router = useRouter();
  const [links, setLinks] = useState<ManagedLink[]>([]);
  const [savedLinks, setSavedLinks] = useState<ManagedLink[]>([]);
  const [access, setAccess] = useState("none");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/join-links?admin=1", {
        cache: "no-store",
        headers: await getAppAuthHeaders(),
      });
      const body = await response.json() as { links?: ManagedLink[]; error?: string };
      if (!response.ok || !body.links) throw new Error(body.error || "Failed to load Join page links");
      setLinks(body.links);
      setSavedLinks(body.links);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load Join page links");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const session = await getAppSession();
      if (!session || !hasAppPermission(session, "admin.join-links", "read")) {
        router.replace(session ? "/" : "/login");
        return;
      }
      setAccess(session.permissions["admin.join-links"] || "none");
      await load();
    })();
  }, [load, router]);

  const canEdit = access === "edit" || access === "full";
  const changedLinks = useMemo(() => links.filter((link) => {
    const saved = savedLinks.find((entry) => entry.key === link.key);
    return saved?.url !== link.url.trim();
  }), [links, savedLinks]);
  const invalidLinks = useMemo(() => links.filter((link) => !isWebUrl(link.url.trim())), [links]);

  async function save() {
    if (!canEdit || !changedLinks.length || invalidLinks.length) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/join-links", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", ...(await getAppAuthHeaders()) },
        body: JSON.stringify({ links: Object.fromEntries(changedLinks.map((link) => [link.key, link.url.trim()])) }),
      });
      const body = await response.json() as { links?: ManagedLink[]; changed?: number; error?: string };
      if (!response.ok || !body.links) throw new Error(body.error || "Failed to save Join page links");
      setLinks(body.links);
      setSavedLinks(body.links);
      setMessage(`${body.changed || 0} Join page link${body.changed === 1 ? "" : "s"} updated.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to save Join page links");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="min-h-screen bg-[#020806] p-10 text-[#00ff66]">Loading Join page links...</main>;
  }

  return (
    <main className="min-h-screen bg-[#020806] px-4 py-8 text-white sm:px-8">
      <section className="mx-auto max-w-6xl border border-[#00ff66]/25 bg-black/80">
        <header className="flex flex-col gap-5 border-b border-[#00ff66]/20 p-6 md:flex-row md:items-end md:justify-between">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center border border-[#00ff66]/35 bg-[#00ff66]/8 text-[#00ff66]">
              <Link2 size={23} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#00ff66]">Public Content</p>
              <h1 className="mt-1 text-3xl font-black uppercase">Join Page Links</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#8ba395]">
                Update the five mod and whitelist links shown on the public Join page without rebuilding the website.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="border border-[#00ff66]/25 bg-[#00ff66]/5 px-3 py-2 text-xs font-black uppercase tracking-[0.15em] text-[#00ff66]">
              {access} access
            </span>
            <button type="button" onClick={() => void load()} disabled={saving} title="Reload saved links"
              className="grid h-10 w-10 place-items-center border border-white/15 text-gray-300 transition hover:border-[#00ff66]/45 hover:text-[#00ff66] disabled:opacity-40">
              <RefreshCw size={17} />
            </button>
          </div>
        </header>

        {(message || error) && (
          <div className={`border-b px-6 py-3 text-sm ${error ? "border-red-400/25 bg-red-400/8 text-red-200" : "border-cyan-400/20 bg-cyan-400/5 text-cyan-200"}`}>
            {error || message}
          </div>
        )}

        <div className="grid border-l border-t border-[#00ff66]/15 lg:grid-cols-2">
          {links.map((link) => {
            const invalid = !isWebUrl(link.url.trim());
            const dirty = savedLinks.find((entry) => entry.key === link.key)?.url !== link.url.trim();
            return (
              <article key={link.key} className="border-b border-r border-[#00ff66]/15 bg-[#020806] p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-black text-white">{link.label}</h2>
                      {dirty && <span className="border border-amber-300/35 bg-amber-300/8 px-2 py-1 text-[9px] font-black uppercase tracking-[0.15em] text-amber-200">Unsaved</span>}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[#789082]">{link.description}</p>
                  </div>
                  <a href={isWebUrl(link.url) ? link.url : "#"} target="_blank" rel="noreferrer" title={`Open ${link.label}`}
                    className={`grid h-10 w-10 shrink-0 place-items-center border transition ${invalid ? "pointer-events-none border-white/10 text-gray-700" : "border-cyan-300/30 text-cyan-200 hover:border-cyan-300/60 hover:bg-cyan-300/8"}`}>
                    <ExternalLink size={17} />
                  </a>
                </div>
                <label className="mt-5 block text-[10px] font-black uppercase tracking-[0.16em] text-[#00ff66]/70" htmlFor={`join-link-${link.key}`}>
                  Destination URL
                </label>
                <textarea id={`join-link-${link.key}`} rows={3} value={link.url} disabled={!canEdit || saving}
                  onChange={(event) => setLinks((current) => current.map((entry) => entry.key === link.key ? { ...entry, url: event.target.value } : entry))}
                  className={`mt-2 w-full resize-y border bg-black p-3 font-mono text-xs leading-5 outline-none transition disabled:text-gray-500 ${invalid ? "border-red-400/60 focus:border-red-300" : "border-white/15 focus:border-[#00ff66]/55"}`} />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-[0.12em] text-[#617568]">
                  <span>{link.updatedBy ? `Last changed by ${link.updatedBy}` : "No recorded editor"}</span>
                  <span>{formatUpdated(link.updatedAt)}</span>
                </div>
                {invalid && <p className="mt-2 text-xs text-red-300">Enter a complete HTTP or HTTPS address.</p>}
              </article>
            );
          })}
        </div>

        <footer className="flex flex-col gap-4 border-t border-[#00ff66]/20 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 text-sm text-[#8ba395]">
            <ShieldCheck className="h-5 w-5 shrink-0 text-[#00ff66]" />
            <span>Saved changes appear on the public Join page immediately and are recorded in the audit log.</span>
          </div>
          {canEdit && (
            <button type="button" onClick={() => void save()} disabled={saving || !changedLinks.length || Boolean(invalidLinks.length)}
              className="flex min-h-11 shrink-0 items-center justify-center gap-2 border border-[#00ff66]/45 bg-[#00ff66]/10 px-5 text-sm font-black uppercase tracking-[0.12em] text-[#00ff66] transition hover:bg-[#00ff66]/15 disabled:cursor-not-allowed disabled:opacity-35">
              {saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
              Save {changedLinks.length ? `${changedLinks.length} change${changedLinks.length === 1 ? "" : "s"}` : "changes"}
            </button>
          )}
        </footer>
      </section>
    </main>
  );
}
