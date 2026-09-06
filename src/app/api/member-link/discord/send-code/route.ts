import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  DISCORD_CODE_EXPIRY_SECONDS,
  DISCORD_MAX_ATTEMPTS,
  DISCORD_RESEND_COOLDOWN_SECONDS,
  deliverDiscordVerificationCode,
  generateDiscordVerificationCode,
  hashDiscordVerificationCode,
} from "@/lib/discord-verification";
import {
  addSteamLinkAudit,
  getActiveLinkByPersonnelId,
  getActiveLinkBySteamId,
  getVerifiedSteamSession,
  noStoreHeaders,
  getMemberLinkBackend,
} from "@/lib/member-link";
import { getPostgresPool, withPostgresTransaction } from "@/lib/postgres/pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type PersonnelRow = {
  id: string;
  name: string | null;
  discord_id: string | null;
};

type ChallengeRow = {
  id: string;
  last_sent_at: string | null;
  created_at: string;
};

export async function POST() {
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

  const [person, steamLink, personnelLink, lastChallenge] = await Promise.all([
    getMemberLinkBackend() === "postgres"
      ? getPostgresPool().query<PersonnelRow>("select id,name,discord_id from public.personnel where id=$1", [session.selected_personnel_id]).then((result) => result.rows[0] || null)
      : supabaseAdmin.from("personnel").select("id,name,discord_id").eq("id", session.selected_personnel_id).maybeSingle<PersonnelRow>().then((result) => result.data || null),
    getActiveLinkBySteamId(session.steam_id),
    getActiveLinkByPersonnelId(session.selected_personnel_id),
    getMemberLinkBackend() === "postgres"
      ? getPostgresPool().query<ChallengeRow>("select id,last_sent_at,created_at from public.personnel_discord_verification_challenges where steam_link_session_id=$1 and status=any($2::text[]) order by created_at desc limit 1", [session.id,["PENDING","SENT"]]).then((result) => result.rows[0] || null)
      : supabaseAdmin.from("personnel_discord_verification_challenges").select("id,last_sent_at,created_at").eq("steam_link_session_id", session.id).in("status", ["PENDING", "SENT"]).order("created_at", { ascending: false }).limit(1).maybeSingle<ChallengeRow>().then((result) => result.data || null),
  ]);

  if (!person) {
    return NextResponse.json(
      { error: "INVALID_PERSONNEL" },
      { status: 404, headers: noStoreHeaders },
    );
  }

  if (!person.discord_id?.trim()) {
    return NextResponse.json(
      { error: "NO_DISCORD_ID" },
      { status: 409, headers: noStoreHeaders },
    );
  }

  if (steamLink || personnelLink) {
    return NextResponse.json(
      { error: "ALREADY_LINKED" },
      { status: 409, headers: noStoreHeaders },
    );
  }

  const cooldownBase = lastChallenge?.last_sent_at || lastChallenge?.created_at;

  if (cooldownBase) {
    const resendAvailableAt = new Date(
      new Date(cooldownBase).getTime() + DISCORD_RESEND_COOLDOWN_SECONDS * 1000,
    );

    if (resendAvailableAt.getTime() > Date.now()) {
      return NextResponse.json(
        {
          error: "RESEND_COOLDOWN",
          resendAvailableAt: resendAvailableAt.toISOString(),
        },
        { status: 429, headers: noStoreHeaders },
      );
    }
  }

  const code = generateDiscordVerificationCode();
  let codeHash: string;

  try {
    codeHash = hashDiscordVerificationCode(code);
  } catch {
    return NextResponse.json(
      { error: "BOT_NOT_CONFIGURED" },
      { status: 503, headers: noStoreHeaders },
    );
  }

  const expiresAt = new Date(
    Date.now() + DISCORD_CODE_EXPIRY_SECONDS * 1000,
  ).toISOString();

  let challenge: { id: string } | null = null;
  try {
    if (getMemberLinkBackend() === "postgres") {
      challenge = await withPostgresTransaction(async (client) => {
        await client.query("update public.personnel_discord_verification_challenges set status='EXPIRED' where steam_link_session_id=$1 and status=any($2::text[])", [session.id,["PENDING","SENT"]]);
        const result = await client.query<{id:string}>(`insert into public.personnel_discord_verification_challenges(steam_link_session_id,personnel_id,discord_user_id,code_hash,status,max_attempts,expires_at) values($1,$2,$3,$4,'PENDING',$5,$6) returning id`, [session.id,person.id,person.discord_id,codeHash,DISCORD_MAX_ATTEMPTS,expiresAt]);
        return result.rows[0];
      });
    } else {
      await supabaseAdmin.from("personnel_discord_verification_challenges").update({ status: "EXPIRED" }).eq("steam_link_session_id", session.id).in("status", ["PENDING", "SENT"]);
      const result = await supabaseAdmin.from("personnel_discord_verification_challenges").insert({ steam_link_session_id:session.id,personnel_id:person.id,discord_user_id:person.discord_id,code_hash:codeHash,status:"PENDING",max_attempts:DISCORD_MAX_ATTEMPTS,expires_at:expiresAt }).select("id").single<{id:string}>();
      if (result.error) throw result.error;
      challenge = result.data;
    }
  } catch {
    return NextResponse.json(
      { error: "CODE_CREATE_FAILED" },
      { status: 500, headers: noStoreHeaders },
    );
  }

  const delivery = await deliverDiscordVerificationCode({
    type: "steam_link_verification",
    discordUserId: person.discord_id,
    code,
    expiresInSeconds: DISCORD_CODE_EXPIRY_SECONDS,
    personnel: {
      id: person.id,
      name: person.name || "Unnamed Personnel",
    },
    steam: {
      id: session.steam_id,
      displayName: session.steam_display_name,
    },
  });

  if (!delivery.accepted) {
    if (getMemberLinkBackend() === "postgres") await getPostgresPool().query("update public.personnel_discord_verification_challenges set status='FAILED',delivery_error=$2 where id=$1", [challenge.id,delivery.message]);
    else await supabaseAdmin.from("personnel_discord_verification_challenges").update({ status: "FAILED", delivery_error: delivery.message }).eq("id", challenge.id);

    await addSteamLinkAudit("DISCORD_CODE_SEND_FAILED", {
      personnelId: person.id,
      steamId: session.steam_id,
      details: {
        challenge_id: challenge.id,
        error_code: delivery.code,
      },
    });

    return NextResponse.json(
      { error: delivery.code },
      { status: delivery.code === "BOT_NOT_CONFIGURED" ? 503 : 502, headers: noStoreHeaders },
    );
  }

  const sentAt = new Date();
  const resendAvailableAt = new Date(
    sentAt.getTime() + DISCORD_RESEND_COOLDOWN_SECONDS * 1000,
  ).toISOString();

  if (getMemberLinkBackend() === "postgres") await getPostgresPool().query("update public.personnel_discord_verification_challenges set status='SENT',last_sent_at=$2,delivered_at=$2 where id=$1", [challenge.id,sentAt.toISOString()]);
  else await supabaseAdmin.from("personnel_discord_verification_challenges").update({ status: "SENT", last_sent_at: sentAt.toISOString(), delivered_at: sentAt.toISOString() }).eq("id", challenge.id);

  await addSteamLinkAudit("DISCORD_CODE_SENT", {
    personnelId: person.id,
    steamId: session.steam_id,
    details: {
      challenge_id: challenge.id,
      expires_at: expiresAt,
    },
  });

  return NextResponse.json(
    {
      sent: true,
      expiresAt,
      resendAvailableAt,
    },
    { headers: noStoreHeaders },
  );
}
