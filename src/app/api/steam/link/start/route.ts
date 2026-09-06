import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getMemberLinkBackend } from "@/lib/member-link";
import { withPostgresTransaction } from "@/lib/postgres/pool";
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

  try {
    if (getMemberLinkBackend() === "postgres") {
      await withPostgresTransaction(async (client) => {
        await client.query("delete from public.steam_link_sessions where expires_at<now()");
        await client.query("insert into public.steam_link_sessions(session_token_hash,state_hash,expires_at) values($1,$2,$3)", [hashToken(sessionToken),hashToken(stateToken),expiresAt]);
        await client.query("insert into public.personnel_steam_link_audit(action,actor_type,details) values('STEAM_AUTH_STARTED','SYSTEM',$1::jsonb)", [JSON.stringify({expires_at:expiresAt})]);
      });
    } else {
      await supabaseAdmin.from("steam_link_sessions").delete().lt("expires_at", new Date().toISOString());
      const result = await supabaseAdmin.from("steam_link_sessions").insert({ session_token_hash: hashToken(sessionToken), state_hash: hashToken(stateToken), expires_at: expiresAt });
      if (result.error) throw result.error;
      await supabaseAdmin.from("personnel_steam_link_audit").insert({ action: "STEAM_AUTH_STARTED", actor_type: "SYSTEM", details: { expires_at: expiresAt } });
    }
  } catch {
    const failureUrl = new URL("/member-link", getSiteUrl());
    failureUrl.searchParams.set("steam_error", "invalid_session");
    return NextResponse.redirect(failureUrl);
  }

  const response = NextResponse.redirect(getSteamLoginUrl(stateToken));
  response.cookies.set(
    "doom_steam_link_session",
    sessionToken,
    getSteamCookieOptions(),
  );

  return response;
}
