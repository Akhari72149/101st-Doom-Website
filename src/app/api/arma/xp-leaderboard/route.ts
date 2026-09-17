import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getPostgresPool } from "@/lib/postgres/pool";

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

export async function GET(request: Request) {
  const period = new URL(request.url).searchParams.get("period") || "lifetime";
  const allowedPeriod = ["lifetime", "current-week", "previous-week"].includes(period) ? period : "lifetime";
  const backend = process.env.PERSONNEL_DATABASE_BACKEND || "supabase";
  if (backend === "postgres") {
    try {
      const result = allowedPeriod === "lifetime" ? await getPostgresPool().query(`
        select xp.personnel_id,p.name,p.mos,r.name rank_name,xp.total_xp,xp.current_level,
          xp.lifetime_kill_count,xp.lifetime_death_count,xp.lifetime_teamkill_count,xp.last_event_at
        from public.personnel_xp_profiles xp
        join public.personnel p on p.id=xp.personnel_id
        left join public.ranks r on r.id=p.rank_id
        where xp.total_xp>0 and lower(coalesce(p.status,'')) not in ('retired','removed','transferred')
        order by xp.total_xp desc,xp.personnel_id limit 10`) : await getPostgresPool().query(`
        with target_week as (
          select distinct week_start_date from public.personnel_xp_weekly_stats
          order by week_start_date desc offset $1 limit 1
        )
        select weekly.personnel_id,p.name,p.mos,r.name rank_name,weekly.week_xp total_xp,
          profile.current_level,weekly.week_kill_count lifetime_kill_count,
          weekly.week_death_count lifetime_death_count,weekly.week_teamkill_count lifetime_teamkill_count,
          weekly.updated_at last_event_at
        from public.personnel_xp_weekly_stats weekly join target_week on target_week.week_start_date=weekly.week_start_date
        join public.personnel p on p.id=weekly.personnel_id left join public.ranks r on r.id=p.rank_id
        left join public.personnel_xp_profiles profile on profile.personnel_id=p.id
        where weekly.week_xp<>0 and lower(coalesce(p.status,'')) not in ('retired','removed','transferred')
        order by weekly.week_xp desc,weekly.personnel_id limit 10`, [allowedPeriod === "previous-week" ? 1 : 0]);
      const leaderboard = result.rows.map((row,index)=>({position:index+1,personnelId:row.personnel_id,name:row.name||"Unknown Personnel",displayedRank:String(row.mos||"").trim()||row.rank_name||"Unranked",totalXp:Number(row.total_xp),currentLevel:Number(row.current_level),kills:Number(row.lifetime_kill_count),deaths:Number(row.lifetime_death_count),teamkills:Number(row.lifetime_teamkill_count),lastEventAt:row.last_event_at}));
      return NextResponse.json({leaderboard,period:allowedPeriod},{headers:noStoreHeaders});
    } catch (error) {
      console.error("[arma-xp] Native leaderboard load failed",error);
      return NextResponse.json({leaderboard:[]},{status:500,headers:noStoreHeaders});
    }
  }
  if (backend !== "supabase") return NextResponse.json({leaderboard:[]},{status:500,headers:noStoreHeaders});
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
