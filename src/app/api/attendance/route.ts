import { NextResponse } from "next/server";
import { pagePermissionDefinitions, type PagePermissionAccess } from "@/data/pagePermissions";
import { getAdminRouteAuth } from "@/lib/admin-route-auth";
import { getNativeSession } from "@/lib/postgres/auth";
import { getPostgresPool, withPostgresTransaction } from "@/lib/postgres/pool";
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
const levels: Record<PagePermissionAccess, number> = { none: 0, read: 1, edit: 2, full: 3 };

function backend() {
  const value = process.env.ATTENDANCE_DATABASE_BACKEND || "supabase";
  if (value !== "postgres" && value !== "supabase") throw new Error("Unknown ATTENDANCE_DATABASE_BACKEND");
  return value;
}

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(process.env.APP_ORIGIN || request.url).origin;
  } catch {
    return false;
  }
}

async function canEdit(request: Request) {
  const legacyRoles = new Set(
    pagePermissionDefinitions.find((entry) => entry.key === PERMISSION_KEY)?.legacyRoles || [],
  );
  if (process.env.NATIVE_AUTH_ENABLED === "true") {
    const session = await getNativeSession(request.headers).catch(() => null);
    if (!session) return false;
    const [permission, roles] = await Promise.all([
      getPostgresPool().query<{ access_level: PagePermissionAccess }>(
        "select access_level from public.user_page_permissions where user_id = $1 and permission_key = $2",
        [session.user.id, PERMISSION_KEY],
      ),
      getPostgresPool().query<{ role: string }>("select role from public.user_roles where user_id = $1", [session.user.id]),
    ]);
    return levels[permission.rows[0]?.access_level || "none"] >= levels.edit ||
      roles.rows.some((row) => legacyRoles.has(row.role.toLowerCase()));
  }

  const auth = await getAdminRouteAuth(request);
  if (!auth.userId) return false;
  const { data } = await supabaseAdmin.from("user_page_permissions")
    .select("access_level").eq("user_id", auth.userId).eq("permission_key", PERMISSION_KEY).maybeSingle();
  return levels[(data?.access_level as PagePermissionAccess) || "none"] >= levels.edit ||
    auth.roles.some((role) => legacyRoles.has(role));
}

function parseRead(request: Request) {
  const params = new URL(request.url).searchParams;
  const mode = params.get("mode") === "individual" ? "individual" : "roster";
  const type = params.get("type") || "Training";
  if (!VALID_TYPES.has(type) && type !== "All") return null;
  if (mode === "roster") {
    const month = params.get("month") || "";
    const week = Number(params.get("week"));
    if (!VALID_MONTHS.has(month) || !Number.isInteger(week) || week < 1 || week > 5 || type === "All") return null;
    return { mode, type, months: [month], month, week };
  }
  const months = [...new Set((params.get("months") || "").split(",").filter((month) => VALID_MONTHS.has(month)))];
  if (!months.length || months.length > 12) return null;
  return { mode, type, months, month: null, week: null };
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
  const values: unknown[] = [input.months];
  const where = ["a.attendance_month = any($1::text[])"];
  if (input.type !== "All") {
    values.push(input.type);
    where.push(`a.type = $${values.length}`);
  }
  if (input.month) {
    values.push(input.week);
    where.push(`a.week_number = $${values.length}`);
  }
  values.push(input.mode === "individual" ? 5000 : 1000);
  const result = await getPostgresPool().query(
    `select a.id, a.type, a.status, a.attendance_month, a.week_number,
            p.id as personnel_id, p.name as personnel_name, p.slotted_position,
            r.name as rank_name
       from public.attendance_records a
       left join public.personnel p on p.id = a.personnel_id
       left join public.ranks r on r.id = p.rank_id
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
  if (!sameOrigin(request)) return errorResponse("Invalid request origin", 403);
  if (!(await canEdit(request).catch(() => false))) return errorResponse("Forbidden", 403);
  const body = await request.json().catch(() => null) as { ids?: unknown; status?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? [...new Set(body.ids.map(String))] : [];
  const status = String(body?.status || "");
  if (!ids.length || ids.length > 250 || ids.some((id) => !RECORD_ID_PATTERN.test(id)) || !VALID_STATUSES.has(status)) {
    return errorResponse("Invalid attendance update", 400);
  }
  try {
    if (backend() === "postgres") {
      await withPostgresTransaction(async (client) => {
        const result = await client.query(
          "update public.attendance_records set status = $1 where id = any($2::bigint[]) returning id",
          [status, ids],
        );
        if (result.rowCount !== ids.length) throw new Error("ATTENDANCE_ROWS_MISSING");
      });
    } else {
      const { data, error } = await supabaseAdmin.from("attendance_records")
        .update({ status }).in("id", ids).select("id");
      if (error) throw error;
      if ((data || []).length !== ids.length) throw new Error("ATTENDANCE_ROWS_MISSING");
    }
    return NextResponse.json({ updated: ids.length }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[attendance] Update failed", error);
    return errorResponse("Failed to update attendance", 500);
  }
}
