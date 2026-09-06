import { NextResponse } from "next/server";
import { getPostgresPool } from "@/lib/postgres/pool";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type PersonnelRow = {
  id: string;
  rank_id: string | null;
  birth_number: string;
  name: string;
  slotted_position: string;
  mos: string | null;
  created_at: string | null;
};

type RankRow = {
  id: string;
  name: string;
};

type RankHistoryRow = {
  personnel_id: string;
  new_rank_id: string | null;
  changed_at: string | null;
};

function databaseBackend() {
  const backend = process.env.ROSTER_DATABASE_BACKEND || "supabase";
  if (backend !== "supabase" && backend !== "postgres") {
    throw new Error("Unknown ROSTER_DATABASE_BACKEND");
  }
  return backend;
}

function response(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

async function readFromPostgres() {
  const pool = getPostgresPool();
  const [ranks, personnel, rankHistory] = await Promise.all([
    pool.query<RankRow>("select id, name from public.ranks order by name"),
    pool.query<PersonnelRow>(`select id, rank_id, birth_number, name, slotted_position, mos, created_at
      from public.personnel order by rank_id, name`),
    pool.query<RankHistoryRow>(`select personnel_id, new_rank_id, changed_at
      from public.rank_history order by changed_at desc nulls last`),
  ]);
  return {
    ranks: ranks.rows,
    personnel: personnel.rows,
    rankHistory: rankHistory.rows,
  };
}

async function readFromSupabase() {
  const [ranks, personnel, rankHistory] = await Promise.all([
    supabaseAdmin.from("ranks").select("id,name").order("name"),
    supabaseAdmin
      .from("personnel")
      .select("id,rank_id,birth_number,name,slotted_position,mos,created_at")
      .order("rank_id", { ascending: true })
      .order("name", { ascending: true }),
    supabaseAdmin
      .from("rank_history")
      .select("personnel_id,new_rank_id,changed_at")
      .order("changed_at", { ascending: false }),
  ]);
  const error = ranks.error || personnel.error || rankHistory.error;
  if (error) throw error;
  return {
    ranks: (ranks.data || []) as RankRow[],
    personnel: (personnel.data || []) as PersonnelRow[],
    rankHistory: (rankHistory.data || []) as RankHistoryRow[],
  };
}

export async function GET() {
  try {
    const data = databaseBackend() === "postgres"
      ? await readFromPostgres()
      : await readFromSupabase();
    return response(data);
  } catch (error) {
    console.error("[roster] Failed to load roster:", error);
    return response({ error: "ROSTER_LOAD_FAILED" }, 500);
  }
}
