import "server-only";

import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { STEAM_LINK_SESSION_COOKIE, hashToken } from "@/lib/steam-link";
import { structure } from "@/data/structure";
import { getPostgresPool } from "@/lib/postgres/pool";

export type VerifiedSteamSession = {
  id: string;
  steam_id: string;
  steam_display_name: string | null;
  steam_profile_url: string | null;
  steam_avatar_url: string | null;
  selected_personnel_id: string | null;
  consumed_at: string | null;
  expires_at: string;
};

export type PersonnelSummary = {
  id: string;
  name: string;
  displayedRank: string;
  baseRank: string;
  mos: string | null;
  billet: string;
  status: string;
  joinedAt: string | null;
  canLink: boolean;
  verificationAvailable: boolean;
  unavailableReason: "ALREADY_LINKED" | "NO_DISCORD_ID" | "INACTIVE" | null;
};

type RankRow = {
  id: string;
  name: string;
};

type PersonnelRow = {
  id: string;
  rank_id: string | null;
  name: string | null;
  slotted_position: string | null;
  status: string | null;
  mos: string | null;
  created_at: string | null;
  discord_id?: string | null;
};

type StructureRole = {
  role: string;
  slotId: string;
};

type StructureChild = {
  title: string;
  roles?: StructureRole[];
};

type StructureSection = {
  title: string;
  children?: StructureChild[];
};

export const noStoreHeaders = {
  "Cache-Control": "no-store, max-age=0",
};

export function getMemberLinkBackend() {
  const value = process.env.PERSONNEL_DATABASE_BACKEND || "supabase";
  if (value !== "postgres" && value !== "supabase") throw new Error("Unknown PERSONNEL_DATABASE_BACKEND");
  return value;
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function isInactiveStatus(status: string | null | undefined) {
  const clean = (status || "").trim().toLowerCase();
  return clean === "retired" || clean === "removed" || clean === "transferred";
}

export function getBilletFromSlot(slotId: string | null | undefined) {
  if (!slotId) return "Unassigned";

  for (const section of structure as StructureSection[]) {
    for (const child of section.children || []) {
      for (const role of child.roles || []) {
        if (role.slotId.toLowerCase() === slotId.toLowerCase()) {
          return `${section.title} - ${child.title} - ${role.role}`;
        }
      }
    }
  }

  return "Unassigned";
}

export function getDisplayedRank(person: PersonnelRow, rankName: string) {
  const mos = (person.mos || "").trim();
  return mos || rankName;
}

export function toPersonnelSummary(
  person: PersonnelRow,
  rankName: string,
  alreadyLinked: boolean,
): PersonnelSummary {
  const inactive = isInactiveStatus(person.status);
  const hasDiscord = Boolean(person.discord_id?.trim());
  const unavailableReason = alreadyLinked
    ? "ALREADY_LINKED"
    : inactive
      ? "INACTIVE"
      : !hasDiscord
        ? "NO_DISCORD_ID"
        : null;

  return {
    id: person.id,
    name: person.name || "Unnamed Personnel",
    displayedRank: getDisplayedRank(person, rankName),
    baseRank: rankName,
    mos: person.mos,
    billet: getBilletFromSlot(person.slotted_position),
    status: person.status || "Active",
    joinedAt: person.created_at,
    canLink: !unavailableReason,
    verificationAvailable: !inactive && !alreadyLinked && hasDiscord,
    unavailableReason,
  };
}

export async function getVerifiedSteamSession() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(STEAM_LINK_SESSION_COOKIE)?.value;

  if (!sessionToken) {
    return { session: null, reason: "missing_session" };
  }

  if (getMemberLinkBackend() === "postgres") {
    const result = await getPostgresPool().query<VerifiedSteamSession & { verified_at: string | null }>(`select id,steam_id,steam_display_name,steam_profile_url,steam_avatar_url,selected_personnel_id,verified_at,consumed_at,expires_at from public.steam_link_sessions where session_token_hash=$1`, [hashToken(sessionToken)]);
    const session = result.rows[0];
    if (!session) return { session: null, reason: "invalid_session" };
    if (new Date(session.expires_at).getTime() <= Date.now()) return { session: null, reason: "session_expired" };
    if (session.consumed_at) return { session: null, reason: "session_consumed" };
    if (!session.verified_at || !session.steam_id) return { session: null, reason: "steam_not_verified" };
    return { session: {
      id: session.id, steam_id: session.steam_id, steam_display_name: session.steam_display_name,
      steam_profile_url: session.steam_profile_url, steam_avatar_url: session.steam_avatar_url,
      selected_personnel_id: session.selected_personnel_id, consumed_at: session.consumed_at,
      expires_at: session.expires_at,
    }, reason: null };
  }

  const { data: session, error } = await supabaseAdmin
    .from("steam_link_sessions")
    .select(
      "id,steam_id,steam_display_name,steam_profile_url,steam_avatar_url,selected_personnel_id,verified_at,consumed_at,expires_at",
    )
    .eq("session_token_hash", hashToken(sessionToken))
    .maybeSingle<
      VerifiedSteamSession & {
        verified_at: string | null;
      }
    >();

  if (error || !session) {
    return { session: null, reason: "invalid_session" };
  }

  if (new Date(session.expires_at).getTime() <= Date.now()) {
    return { session: null, reason: "session_expired" };
  }

  if (session.consumed_at) {
    return { session: null, reason: "session_consumed" };
  }

  if (!session.verified_at || !session.steam_id) {
    return { session: null, reason: "steam_not_verified" };
  }

  return {
    session: {
      id: session.id,
      steam_id: session.steam_id,
      steam_display_name: session.steam_display_name,
      steam_profile_url: session.steam_profile_url,
      steam_avatar_url: session.steam_avatar_url,
      selected_personnel_id: session.selected_personnel_id,
      consumed_at: session.consumed_at,
      expires_at: session.expires_at,
    },
    reason: null,
  };
}

export async function getRankMap() {
  if (getMemberLinkBackend() === "postgres") {
    const result = await getPostgresPool().query<RankRow>("select id,name from public.ranks");
    return new Map(result.rows.map((rank) => [rank.id, rank.name]));
  }
  const { data } = await supabaseAdmin.from("ranks").select("id,name");
  const ranks = (data || []) as RankRow[];

  return new Map(ranks.map((rank) => [rank.id, rank.name]));
}

export async function getActiveLinkBySteamId(steamId: string) {
  if (getMemberLinkBackend() === "postgres") {
    const result = await getPostgresPool().query<{ personnel_id: string; linked_at: string; linked_method: string }>("select personnel_id,linked_at,linked_method from public.personnel_steam_links where steam_id=$1 and revoked_at is null", [steamId]);
    return result.rows[0] || null;
  }
  const { data } = await supabaseAdmin
    .from("personnel_steam_links")
    .select("personnel_id,linked_at,linked_method")
    .eq("steam_id", steamId)
    .is("revoked_at", null)
    .maybeSingle<{
      personnel_id: string;
      linked_at: string;
      linked_method: string;
    }>();

  return data || null;
}

export async function getActiveLinkByPersonnelId(personnelId: string) {
  if (getMemberLinkBackend() === "postgres") {
    const result = await getPostgresPool().query<{ personnel_id: string; steam_id: string; linked_at: string; linked_method: string }>("select personnel_id,steam_id,linked_at,linked_method from public.personnel_steam_links where personnel_id=$1 and revoked_at is null", [personnelId]);
    return result.rows[0] || null;
  }
  const { data } = await supabaseAdmin
    .from("personnel_steam_links")
    .select("personnel_id,steam_id,linked_at,linked_method")
    .eq("personnel_id", personnelId)
    .is("revoked_at", null)
    .maybeSingle<{
      personnel_id: string;
      steam_id: string;
      linked_at: string;
      linked_method: string;
    }>();

  return data || null;
}

export async function addSteamLinkAudit(
  action: string,
  values: {
    personnelId?: string | null;
    steamId?: string | null;
    linkId?: string | null;
    details?: Record<string, unknown>;
  },
) {
  try {
    if (getMemberLinkBackend() === "postgres") {
      await getPostgresPool().query(`insert into public.personnel_steam_link_audit(action,personnel_id,steam_id,link_id,actor_type,details) values($1,$2,$3,$4,'STEAM_MEMBER',$5::jsonb)`, [action,values.personnelId??null,values.steamId??null,values.linkId??null,JSON.stringify(values.details??{})]);
      return;
    }
    await supabaseAdmin.from("personnel_steam_link_audit").insert({
      action,
      personnel_id: values.personnelId ?? null,
      steam_id: values.steamId ?? null,
      link_id: values.linkId ?? null,
      actor_type: "STEAM_MEMBER",
      details: values.details ?? {},
    });
  } catch {
    // Audit writes are best-effort and must not block member linking.
  }
}
