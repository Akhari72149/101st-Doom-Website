import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
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

  const { data: session, error } = await supabaseAdmin
    .from("steam_link_sessions")
    .select("session_token_hash,state_hash,expires_at,consumed_at")
    .eq("session_token_hash", sessionTokenHash)
    .maybeSingle<SteamLinkSession>();

  if (error || !session) {
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

    const { data: existingLink } = await supabaseAdmin
      .from("personnel_steam_links")
      .select("personnel_id,linked_at,linked_method")
      .eq("steam_id", steamId)
      .is("revoked_at", null)
      .maybeSingle<{
        personnel_id: string;
        linked_at: string;
        linked_method: string;
      }>();

    const verifiedAt = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from("steam_link_sessions")
      .update({
        steam_id: steamId,
        steam_display_name: profile.displayName,
        steam_profile_url: profile.profileUrl,
        steam_avatar_url: profile.avatarUrl,
        verified_at: verifiedAt,
      })
      .eq("session_token_hash", sessionTokenHash);

    if (updateError) {
      return redirectToMemberLink("verification_failed");
    }

    await supabaseAdmin.from("personnel_steam_link_audit").insert({
      action: "STEAM_AUTH_VERIFIED",
      personnel_id: existingLink?.personnel_id ?? null,
      steam_id: steamId,
      actor_type: "website",
      details: {
        already_linked: Boolean(existingLink),
        verified_at: verifiedAt,
      },
    });

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
