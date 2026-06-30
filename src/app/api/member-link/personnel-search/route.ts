import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  getRankMap,
  getVerifiedSteamSession,
  noStoreHeaders,
  toPersonnelSummary,
} from "@/lib/member-link";

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

export async function GET(request: Request) {
  const { session, reason } = await getVerifiedSteamSession();

  if (!session) {
    return NextResponse.json(
      { error: reason === "session_expired" ? "SESSION_EXPIRED" : "INVALID_SESSION" },
      { status: 401, headers: noStoreHeaders },
    );
  }

  const url = new URL(request.url);
  const query = (url.searchParams.get("q") || "").trim();

  if (query.length < 2) {
    return NextResponse.json({ results: [] }, { headers: noStoreHeaders });
  }

  const [{ data: personnelData }, { data: linkedData }, rankMap] = await Promise.all([
    supabaseAdmin
      .from("personnel")
      .select("id,rank_id,name,slotted_position,status,mos,created_at,discord_id")
      .order("name", { ascending: true })
      .limit(500),
    supabaseAdmin
      .from("personnel_steam_links")
      .select("personnel_id")
      .is("revoked_at", null),
    getRankMap(),
  ]);

  const activeLinkedPersonnel = new Set(
    ((linkedData || []) as Array<{ personnel_id: string }>).map(
      (link) => link.personnel_id,
    ),
  );

  const normalizedQuery = query.toLowerCase();
  const results = ((personnelData || []) as PersonnelRow[])
    .map((person) =>
      toPersonnelSummary(
        person,
        person.rank_id ? rankMap.get(person.rank_id) || "Unranked" : "Unranked",
        activeLinkedPersonnel.has(person.id),
      ),
    )
    .filter((person) =>
      [
        person.name,
        person.displayedRank,
        person.baseRank,
        person.mos || "",
        person.billet,
        person.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    )
    .slice(0, 10);

  return NextResponse.json({ results }, { headers: noStoreHeaders });
}
