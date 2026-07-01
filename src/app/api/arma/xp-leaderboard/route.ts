import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStoreHeaders = {
  "Cache-Control": "no-store, max-age=0",
};

type XpProfileRow = {
  personnel_id: string;
  total_xp: number;
  current_level: number;
  lifetime_kill_count: number;
  lifetime_death_count: number;
  lifetime_teamkill_count: number;
  last_event_at: string | null;
};

type PersonnelRow = {
  id: string;
  name: string | null;
  rank_id: string | null;
  mos: string | null;
  status: string | null;
};

type RankRow = {
  id: string;
  name: string;
};

function isInactiveStatus(status: string | null | undefined) {
  const clean = (status || "").trim().toLowerCase();
  return clean === "retired" || clean === "removed" || clean === "transferred";
}

export async function GET() {
  const { data: profiles, error } = await supabaseAdmin
    .from("personnel_xp_profiles")
    .select(
      "personnel_id,total_xp,current_level,lifetime_kill_count,lifetime_death_count,lifetime_teamkill_count,last_event_at",
    )
    .gt("total_xp", 0)
    .order("total_xp", { ascending: false })
    .limit(10)
    .returns<XpProfileRow[]>();

  if (error) {
    console.error("[arma-xp] Leaderboard load failed:", {
      code: error.code,
      message: error.message,
    });

    return NextResponse.json(
      { leaderboard: [] },
      { status: 500, headers: noStoreHeaders },
    );
  }

  const personnelIds = (profiles || []).map((profile) => profile.personnel_id);

  if (personnelIds.length === 0) {
    return NextResponse.json({ leaderboard: [] }, { headers: noStoreHeaders });
  }

  const [{ data: personnel }, { data: ranks }] = await Promise.all([
    supabaseAdmin
      .from("personnel")
      .select("id,name,rank_id,mos,status")
      .in("id", personnelIds)
      .returns<PersonnelRow[]>(),
    supabaseAdmin.from("ranks").select("id,name").returns<RankRow[]>(),
  ]);

  const personnelMap = new Map((personnel || []).map((person) => [person.id, person]));
  const rankMap = new Map((ranks || []).map((rank) => [rank.id, rank.name]));

  const leaderboard = (profiles || [])
    .map((profile, index) => {
      const person = personnelMap.get(profile.personnel_id);

      if (!person || isInactiveStatus(person.status)) {
        return null;
      }

      return {
        position: index + 1,
        personnelId: profile.personnel_id,
        name: person.name || "Unknown Personnel",
        displayedRank: person.mos?.trim() || rankMap.get(person.rank_id || "") || "Unranked",
        totalXp: profile.total_xp,
        currentLevel: profile.current_level,
        kills: profile.lifetime_kill_count,
        deaths: profile.lifetime_death_count,
        teamkills: profile.lifetime_teamkill_count,
        lastEventAt: profile.last_event_at,
      };
    })
    .filter(Boolean);

  return NextResponse.json({ leaderboard }, { headers: noStoreHeaders });
}
