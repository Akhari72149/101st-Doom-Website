"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type SelectedPersonnel = {
  id: string;
  name: string;
  displayedRank: string;
  billet: string;
  verificationAvailable: boolean;
};

type PersonnelSearchResult = SelectedPersonnel & {
  baseRank: string;
  mos: string | null;
  status: string;
  joinedAt: string | null;
  canLink: boolean;
  unavailableReason: "ALREADY_LINKED" | "NO_DISCORD_ID" | "INACTIVE" | null;
};

type SessionResponse =
  | {
      authenticated: false;
      reason?: string;
      completed?: boolean;
    }
  | {
      authenticated: true;
      steam: {
        id: string;
        displayName: string | null;
        profileUrl: string | null;
        avatarUrl: string | null;
      };
      selectedPersonnelId: string | null;
      selectedPersonnel: SelectedPersonnel | null;
      existingLink: {
        personnelId: string;
        linkedAt: string;
        linkedMethod: string;
      } | null;
      expiresAt: string;
    };

const safeErrors: Record<string, string> = {
  missing_session: "Your Steam linking session could not be found. Start again to continue.",
  invalid_session: "That Steam linking session is no longer valid. Start again to continue.",
  session_expired: "Your Steam linking session expired. Start again to continue.",
  verification_failed: "Steam verification did not complete. Please try signing in again.",
  NO_DISCORD_ID: "That personnel record does not have a Discord account on file.",
  ALREADY_LINKED: "That Steam account or personnel record is already linked.",
  SESSION_EXPIRED: "Your Steam linking session expired. Start again to continue.",
  BOT_NOT_CONFIGURED: "Discord verification is not configured yet.",
  BOT_DELIVERY_FAILED: "The Discord bot could not accept the verification request.",
  CODE_EXPIRED: "That verification code expired. Send a new code to continue.",
  CODE_INCORRECT: "That verification code was incorrect.",
  TOO_MANY_ATTEMPTS: "Too many incorrect attempts. Send a new code to continue.",
  RESEND_COOLDOWN: "Please wait before sending another verification code.",
  LINK_FINALIZE_FAILED:
    "The code was accepted, but the final link could not be completed. Staff may need to apply the latest database migration.",
};

const statusMessages: Record<string, string> = {
  verified: "Steam authentication verified.",
  "already-linked": "Steam authentication verified, but this Steam account is already linked.",
};

export default function MemberLinkPage() {
  return (
    <Suspense fallback={<LoadingShell />}>
      <MemberLinkContent />
    </Suspense>
  );
}

function LoadingShell() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_center,#001f0f_0%,#000a06_100%)] px-4 py-8 text-[#eafff2] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl rounded-3xl border border-[#00ff66]/30 bg-black/50 p-8">
        <div className="animate-pulse space-y-5">
          <div className="h-4 w-48 rounded bg-white/10" />
          <div className="h-10 w-72 max-w-full rounded bg-white/10" />
          <div className="h-28 rounded-2xl bg-white/10" />
        </div>
      </div>
    </main>
  );
}

function MemberLinkContent() {
  const searchParams = useSearchParams();
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<PersonnelSearchResult[]>([]);
  const [selected, setSelected] = useState<PersonnelSearchResult | SelectedPersonnel | null>(
    null,
  );
  const [confirmed, setConfirmed] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{
    expiresAt: string;
    resendAvailableAt: string;
  } | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [success, setSuccess] = useState<{ personnelName: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const steamError = searchParams.get("steam_error");
  const steamStatus = searchParams.get("steam");

  const queryMessage = useMemo(() => {
    if (steamError) return safeErrors[steamError] || safeErrors.invalid_session;
    if (steamStatus) return statusMessages[steamStatus] || null;
    return null;
  }, [steamError, steamStatus]);

  async function loadSession() {
    setLoading(true);

    try {
      const response = await fetch("/api/steam/link/session", { cache: "no-store" });
      const data = (await response.json()) as SessionResponse;
      setSession(data);

      if (data.authenticated && data.selectedPersonnel) {
        setSelected(data.selectedPersonnel);
        setConfirmed(true);
      }
    } catch {
      setSession({ authenticated: false, reason: "invalid_session" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSession();
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const query = search.trim();

    if (!session?.authenticated || session.existingLink || query.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    let active = true;
    setSearching(true);

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/member-link/personnel-search?q=${encodeURIComponent(query)}`,
          { cache: "no-store" },
        );
        const data = (await response.json()) as {
          results?: PersonnelSearchResult[];
        };

        if (active) setResults(data.results || []);
      } catch {
        if (active) setResults([]);
      } finally {
        if (active) setSearching(false);
      }
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [search, session]);

  async function clearSession() {
    setClearing(true);

    try {
      await fetch("/api/steam/link/session/clear", { method: "POST" });
    } finally {
      window.location.href = "/member-link";
    }
  }

  async function selectPersonnel(person: PersonnelSearchResult) {
    setMessage(null);

    const response = await fetch("/api/member-link/personnel/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personnelId: person.id }),
    });
    const data = (await response.json()) as {
      selectedPersonnel?: PersonnelSearchResult;
      error?: string;
    };

    if (!response.ok || !data.selectedPersonnel) {
      setMessage(safeErrors[data.error || "invalid_session"] || safeErrors.invalid_session);
      return;
    }

    setSelected(data.selectedPersonnel);
    setConfirmed(false);
    setSent(null);
    setCode("");
  }

  async function sendCode() {
    setSending(true);
    setMessage(null);

    try {
      const response = await fetch("/api/member-link/discord/send-code", {
        method: "POST",
      });
      const data = (await response.json()) as {
        sent?: boolean;
        expiresAt?: string;
        resendAvailableAt?: string;
        error?: string;
      };

      if (!response.ok || !data.sent || !data.expiresAt || !data.resendAvailableAt) {
        setMessage(safeErrors[data.error || "BOT_DELIVERY_FAILED"]);
        return;
      }

      setSent({
        expiresAt: data.expiresAt,
        resendAvailableAt: data.resendAvailableAt,
      });
      setRemainingAttempts(null);
      setCode("");
    } finally {
      setSending(false);
    }
  }

  async function verifyCode() {
    setVerifying(true);
    setMessage(null);

    try {
      const response = await fetch("/api/member-link/discord/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = (await response.json()) as {
        verified?: boolean;
        personnel?: { name: string };
        remainingAttempts?: number;
        error?: string;
      };

      if (!response.ok || !data.verified) {
        setRemainingAttempts(data.remainingAttempts ?? null);
        setMessage(safeErrors[data.error || "CODE_INCORRECT"]);
        return;
      }

      setSuccess({ personnelName: data.personnel?.name || selected?.name || "Personnel" });
    } finally {
      setVerifying(false);
    }
  }

  const authenticated = session?.authenticated === true;
  const alreadyLinked = authenticated && Boolean(session.existingLink);
  const steamName =
    authenticated && session.steam.displayName
      ? session.steam.displayName
      : "Verified Steam Account";
  const visibleMessage = message || queryMessage;
  const resendReady = sent
    ? new Date(sent.resendAvailableAt).getTime() <= now
    : false;
  const resendSeconds = sent
    ? Math.max(0, Math.ceil((new Date(sent.resendAvailableAt).getTime() - now) / 1000))
    : 0;
  const expiryLabel = sent
    ? new Date(sent.expiresAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_center,#001f0f_0%,#000a06_100%)] px-4 py-8 text-[#eafff2] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <section className="mb-8">
          <p className="text-xs uppercase tracking-[0.4em] text-gray-400">
            Personnel Command System
          </p>
          <h1 className="mt-3 text-3xl font-bold uppercase tracking-[0.18em] text-[#00ff66] sm:text-5xl">
            Member Steam Link
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-gray-400">
            Link a verified Steam account to your existing personnel record
            through a Discord code sent to the account already stored on that
            record.
          </p>
        </section>

        {visibleMessage && (
          <div className="mb-6 rounded-2xl border border-[#00ff66]/30 bg-black/50 p-4 text-sm text-[#eafff2] backdrop-blur-xl">
            <span className="text-[#00ff66]">STATUS:</span> {visibleMessage}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
          <section className="rounded-3xl border border-[#00ff66]/30 bg-black/50 p-6 backdrop-blur-xl sm:p-8">
            {loading ? (
              <LoadingBlock />
            ) : success && authenticated ? (
              <SuccessStage
                personnelName={success.personnelName}
                steamName={steamName}
                steamId={session.steam.id}
              />
            ) : authenticated ? (
              <div className="space-y-8">
                <SteamCard
                  steam={session.steam}
                  steamName={steamName}
                  alreadyLinked={alreadyLinked}
                />

                {alreadyLinked ? (
                  <WarningPanel>
                    This Steam account is already linked to a personnel profile.
                    No further linking actions are available for this session.
                  </WarningPanel>
                ) : selected && confirmed ? (
                  <DiscordStage
                    selected={selected}
                    sent={sent}
                    code={code}
                    setCode={setCode}
                    sending={sending}
                    verifying={verifying}
                    remainingAttempts={remainingAttempts}
                    expiryLabel={expiryLabel}
                    resendReady={resendReady}
                    resendSeconds={resendSeconds}
                    sendCode={sendCode}
                    verifyCode={verifyCode}
                    chooseAnother={() => {
                      setConfirmed(false);
                      setSelected(null);
                      setSent(null);
                      setCode("");
                    }}
                  />
                ) : selected ? (
                  <ConfirmStage
                    selected={selected}
                    confirm={() => setConfirmed(true)}
                    chooseAnother={() => setSelected(null)}
                  />
                ) : (
                  <SearchStage
                    search={search}
                    setSearch={setSearch}
                    searching={searching}
                    results={results}
                    selectPersonnel={selectPersonnel}
                  />
                )}

                <button
                  onClick={clearSession}
                  disabled={clearing}
                  className="rounded-xl border border-[#00ff66]/50 px-5 py-3 text-sm font-bold uppercase tracking-[0.18em] text-[#00ff66] transition hover:bg-[#00ff66]/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {clearing ? "Clearing..." : "Disconnect Steam"}
                </button>
              </div>
            ) : (
              <SteamAuthStage />
            )}
          </section>

          <aside className="rounded-3xl border border-[#00ff66]/20 bg-black/50 p-6 backdrop-blur-xl">
            <p className="text-xs uppercase tracking-[0.25em] text-gray-400">
              Link Flow
            </p>
            <div className="mt-5 space-y-3 text-sm text-gray-400">
              <Step active={!authenticated}>1. Steam authentication</Step>
              <Step active={authenticated && !selected}>2. Personnel search</Step>
              <Step active={Boolean(selected) && !confirmed}>3. Profile confirmation</Step>
              <Step active={Boolean(selected) && confirmed && !success}>
                4. Discord verification
              </Step>
              <Step active={Boolean(success)}>5. Link complete</Step>
            </div>

            <div className="my-6 border-t border-[#00ff66]/20" />

            <div className="space-y-4 text-sm leading-6 text-gray-400">
              <p>No website login is required.</p>
              <p>The Discord ID is never shown in the browser.</p>
              <p>The verification code is never stored in readable form.</p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function LoadingBlock() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="h-4 w-48 rounded bg-white/10" />
      <div className="h-10 w-72 max-w-full rounded bg-white/10" />
      <div className="h-24 rounded-2xl bg-white/10" />
      <div className="h-12 w-56 rounded-xl bg-white/10" />
    </div>
  );
}

function SteamAuthStage() {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.3em] text-gray-400">
        Authentication Required
      </p>
      <h2 className="mt-4 text-2xl font-bold text-[#00ff66] sm:text-3xl">
        Sign in through Steam to begin
      </h2>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-gray-400">
        Steam confirms ownership of your Steam ID, then this site creates a
        short-lived linking session.
      </p>
      <div className="mt-6 max-w-3xl rounded-2xl border border-[#00ff66]/25 bg-black/40 p-5">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#00ff66]">
          How your Steam account is protected
        </p>
        <p className="mt-3 text-sm leading-7 text-gray-300">
          Steam linking is only used to confirm your Steam ID. You sign in on
          Steam&apos;s official website, not on the 101st website, and we never
          see or store your Steam password, Steam Guard, wallet, inventory,
          trades, or private account details.
        </p>
        <p className="mt-3 text-sm leading-7 text-gray-400">
          Steam simply confirms which Steam ID belongs to you, then sends that
          ID back so it can be linked to your personnel record for Arma XP and
          stat tracking. It does not give this website control over your Steam
          account.
        </p>
      </div>
      <a
        href="/api/steam/link/start"
        className="mt-8 inline-flex rounded-xl border border-[#00ff66]/50 bg-[#00ff66]/10 px-5 py-3 text-sm font-bold uppercase tracking-[0.18em] text-[#00ff66] transition hover:bg-[#00ff66]/20"
      >
        Sign In Through Steam
      </a>
    </div>
  );
}

function SteamCard({
  steam,
  steamName,
  alreadyLinked,
}: {
  steam: {
    id: string;
    displayName: string | null;
    profileUrl: string | null;
    avatarUrl: string | null;
  };
  steamName: string;
  alreadyLinked: boolean;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.3em] text-gray-400">
        Steam Verified
      </p>
      <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-center">
        <div
          className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border border-[#00ff66]/30 bg-black/60 bg-cover bg-center text-3xl font-bold text-[#00ff66]"
          style={
            steam.avatarUrl ? { backgroundImage: `url("${steam.avatarUrl}")` } : undefined
          }
          aria-label="Steam avatar"
        >
          {!steam.avatarUrl && "S"}
        </div>
        <div className="min-w-0">
          <h2 className="break-words text-2xl font-bold text-[#00ff66] sm:text-3xl">
            {steamName}
          </h2>
          <p className="mt-2 break-all font-mono text-sm text-gray-300">{steam.id}</p>
          <p className="mt-2 text-xs uppercase tracking-[0.18em] text-gray-500">
            {alreadyLinked ? "Existing link detected" : "Ready for personnel matching"}
          </p>
        </div>
      </div>
    </div>
  );
}

function SearchStage({
  search,
  setSearch,
  searching,
  results,
  selectPersonnel,
}: {
  search: string;
  setSearch: (value: string) => void;
  searching: boolean;
  results: PersonnelSearchResult[];
  selectPersonnel: (person: PersonnelSearchResult) => void;
}) {
  return (
    <div className="border-t border-[#00ff66]/25 pt-8">
      <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#00ff66]">
        Search Personnel Records
      </p>
      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search name, rank, MOS, billet..."
        className="mt-5 w-full rounded-2xl border border-[#00ff66]/40 bg-black/40 p-4 text-[#00ff66] outline-none placeholder:text-[#00ff66]/40"
      />
      <div className="mt-5 space-y-3">
        {search.trim().length < 2 ? (
          <p className="text-sm text-gray-400">Enter at least two characters.</p>
        ) : searching ? (
          <p className="text-sm text-gray-400">Searching...</p>
        ) : results.length === 0 ? (
          <p className="text-sm text-gray-400">No matching personnel records found.</p>
        ) : (
          results.map((person) => (
            <button
              key={person.id}
              onClick={() => selectPersonnel(person)}
              disabled={!person.canLink || !person.verificationAvailable}
              className="w-full rounded-2xl border border-[#00ff66]/20 bg-black/40 p-4 text-left transition hover:bg-[#00ff66]/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[#00ff66]">
                    {person.displayedRank}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-white">{person.name}</p>
                  <p className="mt-1 text-sm text-gray-400">{person.billet}</p>
                </div>
                <p className="text-xs uppercase tracking-[0.18em] text-gray-400">
                  {person.unavailableReason || "Available"}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function ConfirmStage({
  selected,
  confirm,
  chooseAnother,
}: {
  selected: SelectedPersonnel;
  confirm: () => void;
  chooseAnother: () => void;
}) {
  return (
    <div className="border-t border-[#00ff66]/25 pt-8">
      <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#00ff66]">
        Confirm Personnel Record
      </p>
      <div className="mt-5 rounded-2xl border border-[#00ff66]/25 bg-black/40 p-5">
        <p className="text-2xl font-bold text-white">{selected.name}</p>
        <p className="mt-2 text-sm uppercase tracking-[0.18em] text-[#00ff66]">
          {selected.displayedRank}
        </p>
        <p className="mt-3 text-sm text-gray-400">{selected.billet}</p>
        <p className="mt-5 text-sm leading-7 text-yellow-200">
          Only select your own personnel record. The Discord code will be sent
          to the Discord account already connected to this record.
        </p>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          onClick={confirm}
          className="rounded-xl border border-[#00ff66]/50 bg-[#00ff66]/10 px-5 py-3 text-sm font-bold uppercase tracking-[0.18em] text-[#00ff66] transition hover:bg-[#00ff66]/20"
        >
          Confirm This Is My Personnel Record
        </button>
        <button
          onClick={chooseAnother}
          className="rounded-xl border border-white/15 px-5 py-3 text-sm font-bold uppercase tracking-[0.18em] text-gray-300 transition hover:bg-white/10"
        >
          Choose Another Record
        </button>
      </div>
    </div>
  );
}

function DiscordStage({
  selected,
  sent,
  code,
  setCode,
  sending,
  verifying,
  remainingAttempts,
  expiryLabel,
  resendReady,
  resendSeconds,
  sendCode,
  verifyCode,
  chooseAnother,
}: {
  selected: SelectedPersonnel;
  sent: { expiresAt: string; resendAvailableAt: string } | null;
  code: string;
  setCode: (value: string) => void;
  sending: boolean;
  verifying: boolean;
  remainingAttempts: number | null;
  expiryLabel: string;
  resendReady: boolean;
  resendSeconds: number;
  sendCode: () => void;
  verifyCode: () => void;
  chooseAnother: () => void;
}) {
  return (
    <div className="border-t border-[#00ff66]/25 pt-8">
      <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#00ff66]">
        Discord Verification
      </p>
      <p className="mt-4 text-sm leading-7 text-gray-400">
        A verification code will be sent by the 101st Discord bot to the Discord
        account already connected to this personnel record.
      </p>
      <div className="mt-5 rounded-2xl border border-[#00ff66]/25 bg-black/40 p-5">
        <p className="text-lg font-bold text-white">{selected.name}</p>
        <p className="mt-2 text-sm text-gray-400">{selected.displayedRank}</p>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          onClick={sendCode}
          disabled={sending || Boolean(sent && !resendReady)}
          className="rounded-xl border border-[#00ff66]/50 bg-[#00ff66]/10 px-5 py-3 text-sm font-bold uppercase tracking-[0.18em] text-[#00ff66] transition hover:bg-[#00ff66]/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sent ? "Resend Discord Verification Code" : "Send Discord Verification Code"}
        </button>
        <button
          onClick={chooseAnother}
          className="rounded-xl border border-white/15 px-5 py-3 text-sm font-bold uppercase tracking-[0.18em] text-gray-300 transition hover:bg-white/10"
        >
          Choose Another Record
        </button>
      </div>
      {sent && (
        <div className="mt-6 space-y-4">
          <p className="text-sm text-gray-400">
            Code expires at {expiryLabel}.{" "}
            {resendReady ? "Resend is available." : `Resend in ${resendSeconds}s.`}
          </p>
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            placeholder="123456"
            className="w-full max-w-xs rounded-2xl border border-[#00ff66]/40 bg-black/40 p-4 text-center font-mono text-2xl tracking-[0.3em] text-[#00ff66] outline-none placeholder:text-[#00ff66]/30"
          />
          {remainingAttempts !== null && (
            <p className="text-sm text-yellow-200">
              Attempts remaining: {remainingAttempts}
            </p>
          )}
          <button
            onClick={verifyCode}
            disabled={verifying || code.length !== 6}
            className="block rounded-xl border border-[#00ff66]/50 bg-[#00ff66]/10 px-5 py-3 text-sm font-bold uppercase tracking-[0.18em] text-[#00ff66] transition hover:bg-[#00ff66]/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Verify Code
          </button>
        </div>
      )}
    </div>
  );
}

function SuccessStage({
  personnelName,
  steamName,
  steamId,
}: {
  personnelName: string;
  steamName: string;
  steamId: string;
}) {
  const maskedSteamId = `${steamId.slice(0, 4)}*********${steamId.slice(-4)}`;

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.3em] text-gray-400">
        Link Complete
      </p>
      <h2 className="mt-4 text-3xl font-bold text-[#00ff66]">
        Steam account linked successfully
      </h2>
      <div className="mt-6 rounded-2xl border border-[#00ff66]/25 bg-black/40 p-5">
        <p className="text-sm uppercase tracking-[0.2em] text-gray-400">Personnel</p>
        <p className="mt-2 text-xl font-bold text-white">{personnelName}</p>
        <p className="mt-5 text-sm uppercase tracking-[0.2em] text-gray-400">Steam</p>
        <p className="mt-2 text-xl font-bold text-[#00ff66]">{steamName}</p>
        <p className="mt-2 font-mono text-sm text-gray-400">{maskedSteamId}</p>
      </div>
      <p className="mt-5 text-sm leading-7 text-gray-400">
        Future Arma statistics can now be attached to this personnel profile.
      </p>
    </div>
  );
}

function WarningPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-yellow-400/40 bg-yellow-500/10 p-5 text-sm leading-7 text-yellow-100">
      {children}
    </div>
  );
}

function Step({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <p className={active ? "text-[#00ff66]" : "text-gray-500"}>
      {children}
    </p>
  );
}
