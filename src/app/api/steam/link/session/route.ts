import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { STEAM_LINK_SESSION_COOKIE, hashToken } from "@/lib/steam-link";
import {
  getActiveLinkByPersonnelId,
  getRankMap,
  getBilletFromSlot,
  getDisplayedRank,
  noStoreHeaders,
  getMemberLinkBackend,
} from "@/lib/member-link";
import { getPostgresPool } from "@/lib/postgres/pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type SteamLinkSession = {
  steam_id: string | null;
  steam_display_name: string | null;
  steam_profile_url: string | null;
  steam_avatar_url: string | null;
  selected_personnel_id: string | null;
  verified_at: string | null;
  consumed_at: string | null;
  expires_at: string;
};

type PersonnelRow = {
  id: string;
  rank_id: string | null;
  name: string | null;
  slotted_position: string | null;
  mos: string | null;
  discord_id: string | null;
};

function unauthenticated(reason: string) {
  return NextResponse.json(
    {
      authenticated: false,
      reason,
    },
    {
      headers: noStoreHeaders,
    },
  );
}

export async function GET() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(STEAM_LINK_SESSION_COOKIE)?.value;

  if (!sessionToken) {
    return unauthenticated("missing_session");
  }

  let session: SteamLinkSession | null;
  if (getMemberLinkBackend() === "postgres") {
    const result = await getPostgresPool().query<SteamLinkSession>(`select steam_id,steam_display_name,steam_profile_url,steam_avatar_url,selected_personnel_id,verified_at,consumed_at,expires_at from public.steam_link_sessions where session_token_hash=$1`, [hashToken(sessionToken)]);
    session = result.rows[0] || null;
  } else {
    const result = await supabaseAdmin
    .from("steam_link_sessions")
    .select(
      "steam_id,steam_display_name,steam_profile_url,steam_avatar_url,selected_personnel_id,verified_at,consumed_at,expires_at",
    )
    .eq("session_token_hash", hashToken(sessionToken))
    .maybeSingle<SteamLinkSession>();
    session = result.data || null;
  }

  if (!session) {
    return unauthenticated("invalid_session");
  }

  if (new Date(session.expires_at).getTime() <= Date.now()) {
    return unauthenticated("session_expired");
  }

  if (session.consumed_at) {
    return NextResponse.json(
      {
        authenticated: false,
        reason: "session_consumed",
        completed: true,
      },
      { headers: noStoreHeaders },
    );
  }

  if (!session.verified_at || !session.steam_id) {
    return unauthenticated("steam_not_verified");
  }

  let existingLink: { personnel_id: string; linked_at: string; linked_method: string } | null;
  if (getMemberLinkBackend() === "postgres") {
    const result = await getPostgresPool().query<{ personnel_id: string; linked_at: string; linked_method: string }>("select personnel_id,linked_at,linked_method from public.personnel_steam_links where steam_id=$1 and revoked_at is null", [session.steam_id]);
    existingLink = result.rows[0] || null;
  } else {
    const result = await supabaseAdmin.from("personnel_steam_links").select("personnel_id,linked_at,linked_method").eq("steam_id", session.steam_id).is("revoked_at", null).maybeSingle<{ personnel_id: string; linked_at: string; linked_method: string }>();
    existingLink = result.data || null;
  }

  let selectedPersonnel = null;

  if (session.selected_personnel_id) {
    const [person, personnelLink, rankMap] = await Promise.all([
      getMemberLinkBackend() === "postgres"
        ? getPostgresPool().query<PersonnelRow>("select id,rank_id,name,slotted_position,mos,discord_id from public.personnel where id=$1", [session.selected_personnel_id]).then((result) => result.rows[0] || null)
        : supabaseAdmin.from("personnel").select("id,rank_id,name,slotted_position,mos,discord_id").eq("id", session.selected_personnel_id).maybeSingle<PersonnelRow>().then((result) => result.data || null),
      getActiveLinkByPersonnelId(session.selected_personnel_id), getRankMap(),
    ]);

    if (person) {
      const baseRank = person.rank_id
        ? rankMap.get(person.rank_id) || "Unranked"
        : "Unranked";

      selectedPersonnel = {
        id: person.id,
        name: person.name || "Unnamed Personnel",
        displayedRank: getDisplayedRank(
          {
            ...person,
            status: null,
            created_at: null,
          },
          baseRank,
        ),
        billet: getBilletFromSlot(person.slotted_position),
        verificationAvailable: Boolean(person.discord_id?.trim()) && !personnelLink,
      };
    }
  }

  return NextResponse.json(
    {
      authenticated: true,
      steam: {
        id: session.steam_id,
        displayName: session.steam_display_name,
        profileUrl: session.steam_profile_url,
        avatarUrl: session.steam_avatar_url,
      },
      selectedPersonnelId: session.selected_personnel_id,
      selectedPersonnel,
      existingLink: existingLink
        ? {
            personnelId: existingLink.personnel_id,
            linkedAt: existingLink.linked_at,
            linkedMethod: existingLink.linked_method,
          }
        : null,
      expiresAt: session.expires_at,
    },
    {
      headers: noStoreHeaders,
    },
  );
}
