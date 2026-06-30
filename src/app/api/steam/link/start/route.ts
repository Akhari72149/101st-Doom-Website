import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  STEAM_LINK_SESSION_SECONDS,
  createOpaqueToken,
  getSiteUrl,
  getSteamCookieOptions,
  getSteamLoginUrl,
  hashToken,
} from "@/lib/steam-link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const sessionToken = createOpaqueToken();
  const stateToken = createOpaqueToken();
  const expiresAt = new Date(
    Date.now() + STEAM_LINK_SESSION_SECONDS * 1000,
  ).toISOString();

  await supabaseAdmin
    .from("steam_link_sessions")
    .delete()
    .lt("expires_at", new Date().toISOString());

  const { error } = await supabaseAdmin.from("steam_link_sessions").insert({
    session_token_hash: hashToken(sessionToken),
    state_hash: hashToken(stateToken),
    expires_at: expiresAt,
  });

  if (error) {
    const failureUrl = new URL("/member-link", getSiteUrl());
    failureUrl.searchParams.set("steam_error", "invalid_session");
    return NextResponse.redirect(failureUrl);
  }

  await supabaseAdmin.from("personnel_steam_link_audit").insert({
    action: "STEAM_AUTH_STARTED",
    actor_type: "website",
    details: {
      expires_at: expiresAt,
    },
  });

  const response = NextResponse.redirect(getSteamLoginUrl(stateToken));
  response.cookies.set(
    "doom_steam_link_session",
    sessionToken,
    getSteamCookieOptions(),
  );

  return response;
}
