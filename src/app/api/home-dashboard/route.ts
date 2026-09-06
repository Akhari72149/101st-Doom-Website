import { NextResponse } from "next/server";
import { getPostgresPool } from "@/lib/postgres/pool";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function databaseBackend() {
  const backend = process.env.HOME_DATABASE_BACKEND || "supabase";
  if (backend !== "supabase" && backend !== "postgres") {
    throw new Error("Unknown HOME_DATABASE_BACKEND");
  }
  return backend;
}

function parseWindow(request: Request) {
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");
  const start = new Date(url.searchParams.get("start") || "");
  const end = new Date(url.searchParams.get("end") || "");
  const duration = end.getTime() - start.getTime();
  if (
    (kind !== "events" && kind !== "highlights") ||
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    duration < 20 * 60 * 60 * 1000 ||
    duration > 28 * 60 * 60 * 1000
  ) return null;
  return { kind, start, end };
}

async function readEventsFromPostgres(start: Date, end: Date) {
  const result = await getPostgresPool().query(
    `select b.id, b.server_id, coalesce(b.title, 'Server Booking') as title, b.start_time,
      case when p.id is null then null else json_build_object('name', p.name) end as personnel
     from public.server_bookings b
     left join public.personnel p on p.id = b.booked_for
     where b.start_time >= $1 and b.start_time < $2
     order by b.start_time`,
    [start, end],
  );
  return result.rows;
}

async function readEventsFromSupabase(start: Date, end: Date) {
  const { data, error } = await supabaseAdmin
    .from("server_bookings")
    .select("id,server_id,title,start_time,personnel:booked_for(name)")
    .gte("start_time", start.toISOString())
    .lt("start_time", end.toISOString())
    .order("start_time", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function readHighlightsFromPostgres(start: Date, end: Date) {
  const result = await getPostgresPool().query(
    `select a.id, a.action, a.details, a.created_at,
      case when p.id is null then null else json_build_object('name', p.name) end as "targetPersonnel",
      case when c.id is null then null else json_build_object('name', c.name) end as "targetCertification",
      case when r.id is null then null else json_build_object('name', r.name) end as "targetRank"
     from public.audit_logs a
     left join public.personnel p on p.id = a.target_personnel_id
     left join public.certifications c on c.id = a.target_certification_id
     left join public.ranks r on r.id = a.target_rank_id
     where a.action = any($1::text[]) and a.created_at >= $2 and a.created_at < $3
     order by a.created_at desc limit 8`,
    [["CERTIFICATION_ASSIGNED", "RANK_CHANGED"], start, end],
  );
  return result.rows;
}

async function readHighlightsFromSupabase(start: Date, end: Date) {
  const { data, error } = await supabaseAdmin
    .from("audit_logs")
    .select(`id,action,details,created_at,
      targetPersonnel:target_personnel_id(name),
      targetCertification:target_certification_id(name),
      targetRank:target_rank_id(name)`)
    .in("action", ["CERTIFICATION_ASSIGNED", "RANK_CHANGED"])
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString())
    .order("created_at", { ascending: false })
    .limit(8);
  if (error) throw error;
  return data || [];
}

export async function GET(request: Request) {
  const window = parseWindow(request);
  if (!window) {
    return NextResponse.json(
      { error: "INVALID_HOME_DATA_WINDOW" },
      { status: 400, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
  try {
    const postgres = databaseBackend() === "postgres";
    const data = window.kind === "events"
      ? (postgres
          ? await readEventsFromPostgres(window.start, window.end)
          : await readEventsFromSupabase(window.start, window.end))
      : (postgres
          ? await readHighlightsFromPostgres(window.start, window.end)
          : await readHighlightsFromSupabase(window.start, window.end));
    return NextResponse.json(
      { [window.kind]: data },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("[home-dashboard] Failed to load data:", error);
    return NextResponse.json(
      { error: "HOME_DATA_LOAD_FAILED" },
      { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
