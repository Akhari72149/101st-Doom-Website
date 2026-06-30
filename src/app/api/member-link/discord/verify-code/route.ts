import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  compareDiscordCodeHash,
  hashDiscordVerificationCode,
  normalizeDiscordVerificationCode,
} from "@/lib/discord-verification";
import {
  addSteamLinkAudit,
  getVerifiedSteamSession,
  noStoreHeaders,
} from "@/lib/member-link";
import {
  STEAM_LINK_SESSION_COOKIE,
  getExpiredSteamCookieOptions,
} from "@/lib/steam-link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type ChallengeRow = {
  id: string;
  code_hash: string;
  failed_attempts: number;
  max_attempts: number;
  expires_at: string;
};

type PersonnelRow = {
  id: string;
  name: string | null;
};

function getFinalizeErrorResponse(errorMessage: string) {
  if (
    errorMessage.includes("STEAM_ALREADY_LINKED") ||
    errorMessage.includes("PERSONNEL_ALREADY_LINKED") ||
    errorMessage.includes("duplicate key")
  ) {
    return { error: "ALREADY_LINKED", status: 409 };
  }

  if (errorMessage.includes("INVALID_SESSION")) {
    return { error: "SESSION_EXPIRED", status: 409 };
  }

  if (errorMessage.includes("INVALID_CHALLENGE")) {
    return { error: "CODE_EXPIRED", status: 409 };
  }

  return { error: "LINK_FINALIZE_FAILED", status: 500 };
}

export async function POST(request: Request) {
  const { session, reason } = await getVerifiedSteamSession();

  if (!session) {
    return NextResponse.json(
      { error: reason === "session_expired" ? "SESSION_EXPIRED" : "INVALID_SESSION" },
      { status: 401, headers: noStoreHeaders },
    );
  }

  if (!session.selected_personnel_id) {
    return NextResponse.json(
      { error: "NO_PERSONNEL_SELECTED" },
      { status: 400, headers: noStoreHeaders },
    );
  }

  const body = (await request.json().catch(() => null)) as { code?: string } | null;
  const submittedCode = normalizeDiscordVerificationCode(body?.code || "");

  if (submittedCode.length !== 6) {
    return NextResponse.json(
      { error: "CODE_INCORRECT" },
      { status: 400, headers: noStoreHeaders },
    );
  }

  const { data: challenge } = await supabaseAdmin
    .from("personnel_discord_verification_challenges")
    .select("id,code_hash,failed_attempts,max_attempts,expires_at")
    .eq("steam_link_session_id", session.id)
    .eq("personnel_id", session.selected_personnel_id)
    .eq("status", "SENT")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<ChallengeRow>();

  if (!challenge) {
    return NextResponse.json(
      { error: "CODE_EXPIRED" },
      { status: 404, headers: noStoreHeaders },
    );
  }

  if (new Date(challenge.expires_at).getTime() <= Date.now()) {
    await supabaseAdmin
      .from("personnel_discord_verification_challenges")
      .update({ status: "EXPIRED" })
      .eq("id", challenge.id);

    return NextResponse.json(
      { error: "CODE_EXPIRED" },
      { status: 410, headers: noStoreHeaders },
    );
  }

  if (challenge.failed_attempts >= challenge.max_attempts) {
    await supabaseAdmin
      .from("personnel_discord_verification_challenges")
      .update({ status: "FAILED" })
      .eq("id", challenge.id);

    return NextResponse.json(
      { error: "TOO_MANY_ATTEMPTS" },
      { status: 429, headers: noStoreHeaders },
    );
  }

  let submittedHash: string;

  try {
    submittedHash = hashDiscordVerificationCode(submittedCode);
  } catch {
    return NextResponse.json(
      { error: "BOT_NOT_CONFIGURED" },
      { status: 503, headers: noStoreHeaders },
    );
  }

  const codeMatches = compareDiscordCodeHash(submittedHash, challenge.code_hash);

  if (!codeMatches) {
    const failedAttempts = challenge.failed_attempts + 1;
    const remainingAttempts = Math.max(0, challenge.max_attempts - failedAttempts);
    const failed = failedAttempts >= challenge.max_attempts;

    await supabaseAdmin
      .from("personnel_discord_verification_challenges")
      .update({
        failed_attempts: failedAttempts,
        status: failed ? "FAILED" : "SENT",
      })
      .eq("id", challenge.id);

    await addSteamLinkAudit("DISCORD_CODE_FAILED", {
      personnelId: session.selected_personnel_id,
      steamId: session.steam_id,
      details: {
        challenge_id: challenge.id,
        failed_attempts: failedAttempts,
      },
    });

    return NextResponse.json(
      {
        error: failed ? "TOO_MANY_ATTEMPTS" : "CODE_INCORRECT",
        remainingAttempts,
      },
      { status: failed ? 429 : 400, headers: noStoreHeaders },
    );
  }

  const { data: result, error: finalizeError } = await supabaseAdmin.rpc(
    "finalize_steam_link_from_discord",
    {
      p_steam_link_session_id: session.id,
      p_discord_challenge_id: challenge.id,
    },
  );

  if (finalizeError) {
    const safeError = getFinalizeErrorResponse(finalizeError.message || "");

    console.error("[member-link] Steam link finalization failed:", {
      code: finalizeError.code,
      message: finalizeError.message,
      safeError: safeError.error,
    });

    return NextResponse.json(
      { error: safeError.error },
      { status: safeError.status, headers: noStoreHeaders },
    );
  }

  const finalized = (Array.isArray(result) ? result[0] : result) as
    | { link_id?: string; personnel_id?: string }
    | null;

  const { data: person } = await supabaseAdmin
    .from("personnel")
    .select("id,name")
    .eq("id", finalized?.personnel_id || session.selected_personnel_id)
    .maybeSingle<PersonnelRow>();

  await addSteamLinkAudit("DISCORD_CODE_VERIFIED", {
    personnelId: finalized?.personnel_id || session.selected_personnel_id,
    steamId: session.steam_id,
    linkId: finalized?.link_id || null,
    details: {
      challenge_id: challenge.id,
      steam_link_session_id: session.id,
    },
  });

  const response = NextResponse.json(
    {
      verified: true,
      linked: true,
      personnel: {
        id: person?.id || session.selected_personnel_id,
        name: person?.name || "Selected personnel",
      },
    },
    { headers: noStoreHeaders },
  );

  response.cookies.set(STEAM_LINK_SESSION_COOKIE, "", getExpiredSteamCookieOptions());

  return response;
}
