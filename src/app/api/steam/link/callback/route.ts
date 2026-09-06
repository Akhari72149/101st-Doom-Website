import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getActiveLinkBySteamId, getMemberLinkBackend } from "@/lib/member-link";
import { getPostgresPool, withPostgresTransaction } from "@/lib/postgres/pool";
import {
  STEAM_LINK_SESSION_COOKIE,
  constantTimeCompare,
  getSiteUrl,
  getSteamCallbackUrl,
  getSteamCookieOptions,
  getSteamPublicProfile,
  hashToken,
  verifySteamOpenIdResponse,
} from "@/lib/steam-link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type SteamLinkSession = {
  session_token_hash: string;
  state_hash: string;
  expires_at: string;
  consumed_at: string | null;
};

function redirectToMemberLink(code: string) {
  const url = new URL("/member-link", getSiteUrl());
  url.searchParams.set("steam_error", code);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const state = requestUrl.searchParams.get("state");
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(STEAM_LINK_SESSION_COOKIE)?.value;

  if (!sessionToken) {
    return redirectToMemberLink("missing_session");
  }

  if (!state) {
    return redirectToMemberLink("invalid_session");
  }

  const sessionTokenHash = hashToken(sessionToken);
  const stateHash = hashToken(state);

  let session: SteamLinkSession | null;
  if (getMemberLinkBackend() === "postgres") {
    const result = await getPostgresPool().query<SteamLinkSession>("select session_token_hash,state_hash,expires_at,consumed_at from public.steam_link_sessions where session_token_hash=$1", [sessionTokenHash]);
    session = result.rows[0] || null;
  } else {
    const result = await supabaseAdmin.from("steam_link_sessions").select("session_token_hash,state_hash,expires_at,consumed_at").eq("session_token_hash", sessionTokenHash).maybeSingle<SteamLinkSession>();
    session = result.data || null;
  }

  if (!session) {
    return redirectToMemberLink("invalid_session");
  }

  if (session.consumed_at) {
    return redirectToMemberLink("invalid_session");
  }

  if (new Date(session.expires_at).getTime() <= Date.now()) {
    return redirectToMemberLink("session_expired");
  }

  if (
    !constantTimeCompare(session.session_token_hash, sessionTokenHash) ||
    !constantTimeCompare(session.state_hash, stateHash)
  ) {
    return redirectToMemberLink("invalid_session");
  }

  try {
    const steamId = await verifySteamOpenIdResponse(
      requestUrl.searchParams,
      getSteamCallbackUrl(state),
    );
    const profile = await getSteamPublicProfile(steamId);

    const existingLink = await getActiveLinkBySteamId(steamId);

    const verifiedAt = new Date().toISOString();

    if (getMemberLinkBackend() === "postgres") {
      await withPostgresTransaction(async (client) => {
        const update = await client.query(`update public.steam_link_sessions set steam_id=$2,steam_display_name=$3,steam_profile_url=$4,steam_avatar_url=$5,verified_at=$6 where session_token_hash=$1 and consumed_at is null and expires_at>now()`, [sessionTokenHash,steamId,profile.displayName,profile.profileUrl,profile.avatarUrl,verifiedAt]);
        if (!update.rowCount) throw new Error("SESSION_UPDATE_FAILED");
        await client.query(`insert into public.personnel_steam_link_audit(action,personnel_id,steam_id,actor_type,details) values('STEAM_AUTH_VERIFIED',$1,$2,'SYSTEM',$3::jsonb)`, [existingLink?.personnel_id??null,steamId,JSON.stringify({already_linked:Boolean(existingLink),verified_at:verifiedAt})]);
      });
    } else {
      const update = await supabaseAdmin.from("steam_link_sessions").update({ steam_id:steamId,steam_display_name:profile.displayName,steam_profile_url:profile.profileUrl,steam_avatar_url:profile.avatarUrl,verified_at:verifiedAt }).eq("session_token_hash",sessionTokenHash);
      if (update.error) return redirectToMemberLink("verification_failed");
      await supabaseAdmin.from("personnel_steam_link_audit").insert({ action:"STEAM_AUTH_VERIFIED",personnel_id:existingLink?.personnel_id??null,steam_id:steamId,actor_type:"SYSTEM",details:{already_linked:Boolean(existingLink),verified_at:verifiedAt} });
    }

    const successUrl = new URL("/member-link", getSiteUrl());
    successUrl.searchParams.set(
      "steam",
      existingLink ? "already-linked" : "verified",
    );

    const response = NextResponse.redirect(successUrl);
    response.cookies.set(
      STEAM_LINK_SESSION_COOKIE,
      sessionToken,
      getSteamCookieOptions(),
    );

    return response;
  } catch {
    return redirectToMemberLink("verification_failed");
  }
}
