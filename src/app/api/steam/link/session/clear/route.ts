import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getMemberLinkBackend } from "@/lib/member-link";
import { getPostgresPool } from "@/lib/postgres/pool";
import {
  STEAM_LINK_SESSION_COOKIE,
  getExpiredSteamCookieOptions,
  hashToken,
} from "@/lib/steam-link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(STEAM_LINK_SESSION_COOKIE)?.value;

  if (sessionToken) {
    if (getMemberLinkBackend() === "postgres") {
      await getPostgresPool().query("delete from public.steam_link_sessions where session_token_hash=$1", [hashToken(sessionToken)]);
    } else {
      await supabaseAdmin.from("steam_link_sessions").delete().eq("session_token_hash", hashToken(sessionToken));
    }
  }

  const response = NextResponse.json({ cleared: true });
  response.cookies.set(
    STEAM_LINK_SESSION_COOKIE,
    "",
    getExpiredSteamCookieOptions(),
  );

  return response;
}
