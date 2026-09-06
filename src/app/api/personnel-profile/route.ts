import { NextResponse } from "next/server";
import { getPostgresPool } from "@/lib/postgres/pool";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function databaseBackend() {
  const backend = process.env.PERSONNEL_DATABASE_BACKEND || "supabase";
  if (backend !== "supabase" && backend !== "postgres") {
    throw new Error("Unknown PERSONNEL_DATABASE_BACKEND");
  }
  return backend;
}

function json(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

function steamLink(row: {
  steam_id: string;
  steam_display_name: string | null;
  steam_profile_url: string | null;
  steam_avatar_url: string | null;
  linked_at: string | Date | null;
} | null) {
  return row ? {
    steamId: row.steam_id,
    displayName: row.steam_display_name,
    profileUrl: row.steam_profile_url || `https://steamcommunity.com/profiles/${row.steam_id}`,
    avatarUrl: row.steam_avatar_url,
    linkedAt: row.linked_at,
  } : null;
}

async function readDirectoryFromPostgres() {
  const pool = getPostgresPool();
  const [ranks, personnel] = await Promise.all([
    pool.query("select id, name, rank_level from public.ranks order by rank_level, name"),
    pool.query(`select id, rank_id, name, slotted_position, created_at, ts_id, status, mos
      from public.personnel order by name`),
  ]);
  return { ranks: ranks.rows, personnel: personnel.rows };
}

async function readDirectoryFromSupabase() {
  const [ranks, personnel] = await Promise.all([
    supabaseAdmin.from("ranks").select("id,name,rank_level").order("rank_level").order("name"),
    supabaseAdmin
      .from("personnel")
      .select("id,rank_id,name,slotted_position,created_at,ts_id,status,mos")
      .order("name"),
  ]);
  const error = ranks.error || personnel.error;
  if (error) throw error;
  return { ranks: ranks.data || [], personnel: personnel.data || [] };
}

async function readDossierFromPostgres(personnelId: string) {
  const pool = getPostgresPool();
  const [certifications, rankHistory, statusAudit, awards, linkedSteam] = await Promise.all([
    pool.query(`select pc.id, pc.awarded_at,
        json_build_object('id', c.id, 'name', c.name) as certification
      from public.personnel_certifications pc
      join public.certifications c on c.id = pc.certification_id
      where pc.personnel_id = $1 order by c.name`, [personnelId]),
    pool.query(`select id, old_rank_id, new_rank_id, changed_at
      from public.rank_history where personnel_id = $1
      order by changed_at desc nulls last`, [personnelId]),
    pool.query(`select a.id, a.action, a.created_at,
        case when p.id is null then null else json_build_object('name', p.name) end as processor
      from public.audit_logs a
      left join public.personnel p on p.id = a.processed_by
      where a.target_personnel_id = $1
        and a.action = any($2::text[])
      order by a.created_at desc limit 1`, [personnelId, [
        "PERSONNEL_REMOVED", "PERSONNEL_RETIRED", "PERSONNEL_TRANSFERRED",
      ]]),
    pool.query(`select pa.id, pa.awarded_at, pa.notes,
        json_build_object(
          'id', a.id, 'name', a.name, 'description', a.description,
          'category', a.category, 'icon_key', a.icon_key, 'ribbon_color', a.ribbon_color
        ) as award
      from public.personnel_awards pa
      join public.awards a on a.id = pa.award_id
      where pa.personnel_id = $1 order by pa.awarded_at desc nulls last`, [personnelId]),
    pool.query(`select steam_id, steam_display_name, steam_profile_url, steam_avatar_url, linked_at
      from public.personnel_steam_links
      where personnel_id = $1 and revoked_at is null
      order by linked_at desc nulls last limit 1`, [personnelId]),
  ]);
  return {
    certifications: certifications.rows,
    rankHistory: rankHistory.rows,
    statusAudit: statusAudit.rows[0] || null,
    awards: awards.rows,
    steamLink: steamLink(linkedSteam.rows[0] || null),
  };
}

async function readDossierFromSupabase(personnelId: string) {
  const [certifications, rankHistory, statusAudit, awards, linkedSteam] = await Promise.all([
    supabaseAdmin
      .from("personnel_certifications")
      .select("id,awarded_at,certification:certification_id(id,name)")
      .eq("personnel_id", personnelId),
    supabaseAdmin
      .from("rank_history")
      .select("id,old_rank_id,new_rank_id,changed_at")
      .eq("personnel_id", personnelId)
      .order("changed_at", { ascending: false }),
    supabaseAdmin
      .from("audit_logs")
      .select("id,action,created_at,processor:processed_by(name)")
      .eq("target_personnel_id", personnelId)
      .in("action", ["PERSONNEL_REMOVED", "PERSONNEL_RETIRED", "PERSONNEL_TRANSFERRED"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("personnel_awards")
      .select(`id,awarded_at,notes,award:award_id(
        id,name,description,category,icon_key,ribbon_color
      )`)
      .eq("personnel_id", personnelId)
      .order("awarded_at", { ascending: false }),
    supabaseAdmin
      .from("personnel_steam_links")
      .select("steam_id,steam_display_name,steam_profile_url,steam_avatar_url,linked_at")
      .eq("personnel_id", personnelId)
      .is("revoked_at", null)
      .order("linked_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const error = certifications.error || rankHistory.error || statusAudit.error || awards.error || linkedSteam.error;
  if (error) throw error;
  return {
    certifications: certifications.data || [],
    rankHistory: rankHistory.data || [],
    statusAudit: statusAudit.data || null,
    awards: awards.data || [],
    steamLink: steamLink(linkedSteam.data || null),
  };
}

export async function GET(request: Request) {
  try {
    const personnelId = new URL(request.url).searchParams.get("personnelId");
    const backend = databaseBackend();
    if (!personnelId) {
      return json(backend === "postgres"
        ? await readDirectoryFromPostgres()
        : await readDirectoryFromSupabase());
    }
    if (!UUID_PATTERN.test(personnelId)) return json({ error: "INVALID_PERSONNEL_ID" }, 400);
    return json(backend === "postgres"
      ? await readDossierFromPostgres(personnelId)
      : await readDossierFromSupabase(personnelId));
  } catch (error) {
    console.error("[personnel-profile] Failed to load dossier:", error);
    return json({ error: "PERSONNEL_PROFILE_LOAD_FAILED" }, 500);
  }
}
