"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { getAppSession, signOutOfApp } from "@/lib/client-auth";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      const session = await getAppSession();
      if (!session) return router.replace("/login");
      if (!session.mustChangePassword) return router.replace("/");
      setChecking(false);
    })();
  }, [router]);

  async function submit() {
    setError("");
    if (newPassword !== confirmPassword) {
      setError("The new passwords do not match.");
      return;
    }
    setSubmitting(true);
    const response = await fetch("/api/account/change-password", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const body = await response.json().catch(() => null) as { error?: string } | null;
    if (!response.ok) {
      setError(body?.error || "Unable to change password");
      setSubmitting(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  if (checking) {
    return <main className="grid min-h-screen place-items-center bg-[#020806] text-[#00ff66]"><Loader2 className="animate-spin" /></main>;
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#020806] px-4 py-12 text-white">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(0,255,102,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,102,0.035)_1px,transparent_1px)] bg-[size:44px_44px]" />
      <section className="relative w-full max-w-lg border border-[#00ff66]/25 bg-black/80 p-6 shadow-[0_0_50px_rgba(0,255,102,0.1)] sm:p-8">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center border border-[#00ff66]/30 bg-[#00ff66]/10 text-[#00ff66]"><KeyRound size={23} /></div>
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-[#00ff66]">Account Security</div>
            <h1 className="mt-2 text-2xl font-black uppercase tracking-[0.12em]">Set Your Password</h1>
            <p className="mt-2 text-sm leading-6 text-gray-400">Replace the temporary password before continuing into the website.</p>
          </div>
        </div>

        <div className="mt-7 space-y-5">
          <PasswordInput label="Temporary Password" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" />
          <PasswordInput label="New Password" value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
          <PasswordInput label="Confirm New Password" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
        </div>

        <div className="mt-3 text-xs leading-5 text-gray-500">Use at least 12 characters. Existing sessions on other devices will be signed out.</div>
        {error && <div className="mt-5 border border-red-400/35 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}

        <button type="button" onClick={() => void submit()} disabled={submitting || !currentPassword || !newPassword || !confirmPassword}
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 border border-[#00ff66]/40 bg-[#00ff66]/15 px-5 font-black uppercase tracking-[0.12em] text-[#00ff66] transition hover:bg-[#00ff66]/25 disabled:cursor-not-allowed disabled:opacity-45">
          {submitting ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
          Change Password
        </button>
        <button type="button" onClick={() => void signOutOfApp().then(() => router.replace("/login"))}
          className="mt-3 min-h-11 w-full text-xs font-bold uppercase tracking-[0.14em] text-gray-500 transition hover:text-white">
          Sign Out
        </button>
      </section>
    </main>
  );
}

function PasswordInput({ label, value, onChange, autoComplete }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
}) {
  return <label className="block">
    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">{label}</span>
    <input type="password" value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete}
      className="mt-2 min-h-12 w-full border border-[#00ff66]/20 bg-black/70 px-4 text-white outline-none transition focus:border-[#00ff66]/60" />
  </label>;
}
