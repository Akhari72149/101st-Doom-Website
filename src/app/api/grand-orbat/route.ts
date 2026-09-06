import { NextResponse } from "next/server";
import { getPostgresPool } from "@/lib/postgres/pool";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Rank = {
  id: string;
  name: string;
  rank_level: number;
};

type PersonnelRow = {
  id: string;
  name: string;
  slotted_position: string | null;
  mos: string | null;
  ranks: Rank | Rank[] | null;
};

function databaseBackend() {
  const backend = process.env.ORBAT_DATABASE_BACKEND || "supabase";
  if (backend !== "supabase" && backend !== "postgres") {
    throw new Error("Unknown ORBAT_DATABASE_BACKEND");
  }
  return backend;
}

function normalizePersonnel(rows: PersonnelRow[]) {
  return rows.map((person) => ({
    id: person.id,
    name: person.name,
    slotted_position: person.slotted_position,
    mos: person.mos,
    ranks: Array.isArray(person.ranks) ? person.ranks[0] || null : person.ranks,
  }));
}

async function readFromPostgres() {
  const pool = getPostgresPool();
  const [nodes, personnel] = await Promise.all([
    pool.query(`select id, name, parent_id, order_index, roles
      from public.org_nodes order by order_index nulls last, name`),
    pool.query<PersonnelRow>(`select p.id, p.name, p.slotted_position, p.mos,
        case when r.id is null then null else json_build_object(
          'id', r.id, 'name', r.name, 'rank_level', r.rank_level
        ) end as ranks
      from public.personnel p
      left join public.ranks r on r.id = p.rank_id
      order by p.name`),
  ]);
  return { nodes: nodes.rows, personnel: normalizePersonnel(personnel.rows) };
}

async function readFromSupabase() {
  const [nodes, personnel] = await Promise.all([
    supabaseAdmin
      .from("org_nodes")
      .select("id,name,parent_id,order_index,roles")
      .order("order_index", { ascending: true })
      .order("name", { ascending: true }),
    supabaseAdmin
      .from("personnel")
      .select("id,name,slotted_position,mos,ranks(id,name,rank_level)")
      .order("name", { ascending: true }),
  ]);
  const error = nodes.error || personnel.error;
  if (error) throw error;
  return {
    nodes: nodes.data || [],
    personnel: normalizePersonnel((personnel.data || []) as PersonnelRow[]),
  };
}

export async function GET() {
  try {
    const data = databaseBackend() === "postgres"
      ? await readFromPostgres()
      : await readFromSupabase();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("[grand-orbat] Failed to load ORBAT:", error);
    return NextResponse.json(
      { error: "ORBAT_LOAD_FAILED" },
      { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
