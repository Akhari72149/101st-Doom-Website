import { NextResponse } from "next/server";
import { getPostgresPool, withPostgresTransaction } from "@/lib/postgres/pool";
import { requestHasSameOrigin, requirePageAccess } from "@/lib/route-permissions";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PERMISSION_KEY = "admin.weekly-attendance";
const VALID_MONTHS = new Set([
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]);
const VALID_TYPES = new Set(["Training", "MainOp"]);
const VALID_STATUSES = new Set(["Y", "N", "Excused", "LOA"]);
const RECORD_ID_PATTERN = /^\d{1,19}$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value: string | null) {
  if (!value || !ISO_DATE_PATTERN.test(value)) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : value;
}

function backend() {
  const value = process.env.ATTENDANCE_DATABASE_BACKEND || "supabase";
  if (value !== "postgres" && value !== "supabase") throw new Error("Unknown ATTENDANCE_DATABASE_BACKEND");
  return value;
}

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

function parseRead(request: Request) {
  const params = new URL(request.url).searchParams;
  const mode = params.get("mode") === "individual" ? "individual" : "roster";
  const type = params.get("type") || "Training";
  if (!VALID_TYPES.has(type) && type !== "All") return null;
  if (mode === "roster") {
    const month = params.get("month") || "";
    const week = Number(params.get("week"));
    const cycleEnd = validDate(params.get("cycleEnd"));
    if (!VALID_MONTHS.has(month) || !Number.isInteger(week) || week < 1 || week > 5 || type === "All") return null;
    return { mode, type, months: [month], month, week, cycleStart: null, cycleEnd };
  }
  const months = [...new Set((params.get("months") || "").split(",").filter((month) => VALID_MONTHS.has(month)))];
  const cycleStart = validDate(params.get("cycleStart"));
  const cycleEnd = validDate(params.get("cycleEnd"));
  if (!months.length || months.length > 12) return null;
  if ((cycleStart && !cycleEnd) || (!cycleStart && cycleEnd)) return null;
  return { mode, type, months, month: null, week: null, cycleStart, cycleEnd };
}

const selectColumns = `id,type,status,attendance_month,week_number,
  personnel:personnel_id(id,name,slotted_position,ranks:rank_id(name))`;

async function readSupabase(input: NonNullable<ReturnType<typeof parseRead>>) {
  let query = supabaseAdmin.from("attendance_records").select(selectColumns).in("attendance_month", input.months);
  if (input.type !== "All") query = query.eq("type", input.type);
  if (input.month) query = query.eq("attendance_month", input.month).eq("week_number", input.week!);
  const { data, error } = await query.limit(input.mode === "individual" ? 5000 : 1000);
  if (error) throw error;
  return data || [];
}

async function readPostgres(input: NonNullable<ReturnType<typeof parseRead>>) {
  const values: unknown[] = [];
  const where: string[] = [];
  if (input.cycleStart && input.cycleEnd) {
    values.push(input.cycleStart, input.cycleEnd);
    where.push(`a.cycle_end_date between $1::date and $2::date`);
  } else if (input.cycleEnd) {
    values.push(input.cycleEnd);
    where.push(`a.cycle_end_date = $1::date`);
  } else {
    values.push(input.months);
    where.push(`a.attendance_month = any($1::text[])`);
  }
  if (input.type !== "All") {
    values.push(input.type);
    where.push(`a.type = $${values.length}`);
  }
  if (input.month && !input.cycleEnd) {
    values.push(input.week);
    where.push(`a.week_number = $${values.length}`);
  }
  values.push(input.mode === "individual" ? 5000 : 1000);
  const result = await getPostgresPool().query(
    `select a.id, a.type, a.status, a.attendance_month, a.week_number,
            to_char(a.cycle_end_date, 'YYYY-MM-DD') as cycle_end_date, a.updated_at,
            p.id as personnel_id, p.name as personnel_name, p.slotted_position,
            r.name as rank_name,
            latest_change.changed_at as last_changed_at,
            latest_change.changed_by as last_changed_by
       from public.attendance_records a
       left join public.personnel p on p.id = a.personnel_id
       left join public.ranks r on r.id = p.rank_id
       left join lateral (
         select audit.changed_at,
                coalesce(actor."displayUsername", actor.name, actor.username, 'System') as changed_by
           from public.attendance_record_audit audit
           left join public.app_auth_users actor on actor.id = audit.actor_id
          where audit.attendance_record_id = a.id
          order by audit.changed_at desc
          limit 1
       ) latest_change on true
      where ${where.join(" and ")}
      order by p.name
      limit $${values.length}`,
    values,
  );
  return result.rows.map((row) => ({
    id: row.id,
    type: row.type,
    status: row.status,
    attendance_month: row.attendance_month,
    week_number: row.week_number,
    cycle_end_date: row.cycle_end_date,
    updated_at: row.updated_at,
    last_changed_at: row.last_changed_at,
    last_changed_by: row.last_changed_by,
    personnel: row.personnel_id ? {
      id: row.personnel_id,
      name: row.personnel_name,
      slotted_position: row.slotted_position,
      ranks: row.rank_name ? { name: row.rank_name } : null,
    } : null,
  }));
}

export async function GET(request: Request) {
  const input = parseRead(request);
  if (!input) return errorResponse("Invalid attendance query", 400);
  try {
    const records = backend() === "postgres" ? await readPostgres(input) : await readSupabase(input);
    return NextResponse.json({ records }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[attendance] Read failed", error);
    return errorResponse("Failed to load attendance", 500);
  }
}

export async function PATCH(request: Request) {
  if (!requestHasSameOrigin(request)) return errorResponse("Invalid request origin", 403);
  const auth = await requirePageAccess(request, PERMISSION_KEY, "edit").catch(() => null);
  if (!auth) {
    return errorResponse("Forbidden", 403);
  }
  const body = await request.json().catch(() => null) as { ids?: unknown; status?: unknown; isBulk?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? [...new Set(body.ids.map(String))] : [];
  const status = String(body?.status || "");
  const isBulk = body?.isBulk === true;
  if (!ids.length || ids.length > 250 || ids.some((id) => !RECORD_ID_PATTERN.test(id)) || !VALID_STATUSES.has(status)) {
    return errorResponse("Invalid attendance update", 400);
  }
  try {
    let changedBy = auth.email || "Website administrator";
    let changedCount = ids.length;
    if (backend() === "postgres") {
      await withPostgresTransaction(async (client) => {
        const actor = await client.query<{ display_name: string | null }>(
          `select coalesce("displayUsername", name, username) as display_name
             from public.app_auth_users where id = $1`,
          [auth.userId],
        );
        changedBy = actor.rows[0]?.display_name || changedBy;
        const existing = await client.query<{ id: string; status: string }>(
          "select id::text, status from public.attendance_records where id = any($1::bigint[]) for update",
          [ids],
        );
        if (existing.rowCount !== ids.length) throw new Error("ATTENDANCE_ROWS_MISSING");
        const changed = existing.rows.filter((row) => row.status !== status);
        changedCount = changed.length;
        if (!changed.length) return;
        const result = await client.query(
          "update public.attendance_records set status = $1, updated_at = now() where id = any($2::bigint[]) returning id",
          [status, changed.map((row) => row.id)],
        );
        if (result.rowCount !== changed.length) throw new Error("ATTENDANCE_ROWS_MISSING");
        await client.query(
          `insert into public.attendance_record_audit
             (attendance_record_id, actor_id, old_status, new_status, is_bulk)
           select changed.id::bigint, $2::uuid, changed.old_status, $3, $4
             from unnest($1::text[], $5::text[]) as changed(id, old_status)`,
          [changed.map((row) => row.id), auth.userId, status, isBulk, changed.map((row) => row.status)],
        );
      });
    } else {
      const { data, error } = await supabaseAdmin.from("attendance_records")
        .update({ status, updated_at: new Date().toISOString() }).in("id", ids).select("id");
      if (error) throw error;
      if ((data || []).length !== ids.length) throw new Error("ATTENDANCE_ROWS_MISSING");
    }
    return NextResponse.json({ updated: changedCount, changedAt: new Date().toISOString(), changedBy }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[attendance] Update failed", error);
    return errorResponse("Failed to update attendance", 500);
  }
}
