import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  addSteamLinkAudit,
  getActiveLinkByPersonnelId,
  getActiveLinkBySteamId,
  getRankMap,
  getVerifiedSteamSession,
  isInactiveStatus,
  isUuid,
  noStoreHeaders,
  toPersonnelSummary,
  getMemberLinkBackend,
} from "@/lib/member-link";
import { getPostgresPool, withPostgresTransaction } from "@/lib/postgres/pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type PersonnelRow = {
  id: string;
  rank_id: string | null;
  name: string | null;
  slotted_position: string | null;
  status: string | null;
  mos: string | null;
  created_at: string | null;
  discord_id: string | null;
};

export async function POST(request: Request) {
  const { session, reason } = await getVerifiedSteamSession();

  if (!session) {
    return NextResponse.json(
      { error: reason === "session_expired" ? "SESSION_EXPIRED" : "INVALID_SESSION" },
      { status: 401, headers: noStoreHeaders },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    personnelId?: string;
  } | null;
  const personnelId = body?.personnelId || "";

  if (!isUuid(personnelId)) {
    return NextResponse.json(
      { error: "INVALID_PERSONNEL" },
      { status: 400, headers: noStoreHeaders },
    );
  }

  let person: PersonnelRow | null;
  if (getMemberLinkBackend() === "postgres") {
    const result = await getPostgresPool().query<PersonnelRow>("select id,rank_id,name,slotted_position,status,mos,created_at,discord_id from public.personnel where id=$1", [personnelId]);
    person = result.rows[0] || null;
  } else {
    const result = await supabaseAdmin.from("personnel").select("id,rank_id,name,slotted_position,status,mos,created_at,discord_id").eq("id", personnelId).maybeSingle<PersonnelRow>();
    person = result.data || null;
  }

  if (!person) {
    return NextResponse.json(
      { error: "INVALID_PERSONNEL" },
      { status: 404, headers: noStoreHeaders },
    );
  }

  if (isInactiveStatus(person.status)) {
    return NextResponse.json(
      { error: "INACTIVE" },
      { status: 409, headers: noStoreHeaders },
    );
  }

  const [personnelLink, steamLink, rankMap] = await Promise.all([
    getActiveLinkByPersonnelId(personnelId),
    getActiveLinkBySteamId(session.steam_id),
    getRankMap(),
  ]);

  if (personnelLink || steamLink) {
    return NextResponse.json(
      { error: "ALREADY_LINKED" },
      { status: 409, headers: noStoreHeaders },
    );
  }

  if (getMemberLinkBackend() === "postgres") {
    await withPostgresTransaction(async (client) => {
      await client.query("update public.steam_link_sessions set selected_personnel_id=$2 where id=$1", [session.id,personnelId]);
      await client.query("update public.personnel_discord_verification_challenges set status='EXPIRED' where steam_link_session_id=$1 and status=any($2::text[])", [session.id,["PENDING","SENT"]]);
    });
  } else {
    await supabaseAdmin.from("steam_link_sessions").update({ selected_personnel_id: personnelId }).eq("id", session.id);
    await supabaseAdmin.from("personnel_discord_verification_challenges").update({ status: "EXPIRED" }).eq("steam_link_session_id", session.id).in("status", ["PENDING", "SENT"]);
  }

  await addSteamLinkAudit("PROFILE_SELECTED", {
    personnelId,
    steamId: session.steam_id,
    details: { steam_link_session_id: session.id },
  });

  const summary = toPersonnelSummary(
    person,
    person.rank_id ? rankMap.get(person.rank_id) || "Unranked" : "Unranked",
    false,
  );

  return NextResponse.json(
    {
      selectedPersonnel: summary,
      verificationAvailable: Boolean(person.discord_id?.trim()),
    },
    { headers: noStoreHeaders },
  );
}
