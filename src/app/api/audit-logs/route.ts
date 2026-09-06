import { NextResponse } from "next/server";
import { pagePermissionDefinitions, type PagePermissionAccess } from "@/data/pagePermissions";
import { getAdminRouteAuth } from "@/lib/admin-route-auth";
import { getNativeSession } from "@/lib/postgres/auth";
import { getPostgresPool } from "@/lib/postgres/pool";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const levels: Record<PagePermissionAccess, number> = { none: 0, read: 1, edit: 2, full: 3 };
const REMOVAL_ACTIONS = ["PERSONNEL_REMOVED", "PERSONNEL_RETIRED", "PERSONNEL_TRANSFERRED"];

function backend() {
  const value = process.env.AUDIT_DATABASE_BACKEND || "supabase";
  if (value !== "postgres" && value !== "supabase") throw new Error("Unknown AUDIT_DATABASE_BACKEND");
  return value;
}

async function hasAccess(request: Request, permissionKey: string) {
  const legacyRoles = new Set(
    pagePermissionDefinitions.find((entry) => entry.key === permissionKey)?.legacyRoles || [],
  );
  if (process.env.NATIVE_AUTH_ENABLED === "true") {
    const session = await getNativeSession(request.headers).catch(() => null);
    if (!session) return false;
    const [permission, roles] = await Promise.all([
      getPostgresPool().query<{ access_level: PagePermissionAccess }>(
        "select access_level from public.user_page_permissions where user_id = $1 and permission_key = $2",
        [session.user.id, permissionKey],
      ),
      getPostgresPool().query<{ role: string }>("select role from public.user_roles where user_id = $1", [session.user.id]),
    ]);
    return levels[permission.rows[0]?.access_level || "none"] >= levels.read ||
      roles.rows.some((row) => legacyRoles.has(row.role.toLowerCase()));
  }
  const auth = await getAdminRouteAuth(request);
  if (!auth.userId) return false;
  const { data } = await supabaseAdmin.from("user_page_permissions")
    .select("access_level").eq("user_id", auth.userId).eq("permission_key", permissionKey).maybeSingle();
  return levels[(data?.access_level as PagePermissionAccess) || "none"] >= levels.read ||
    auth.roles.some((role) => legacyRoles.has(role));
}

function serialize(row: Record<string, unknown>) {
  return {
    id: String(row.id), action: row.action, details: row.details ?? null,
    created_at: row.created_at, user_id: row.user_id ?? null,
    processed_by: row.processed_by ?? null, target_personnel_id: row.target_personnel_id ?? null,
    profiles: row.profile_name ? { display_name: row.profile_name } : null,
    processor: row.processor_name ? { name: row.processor_name } : null,
    personnel: row.personnel_name ? { name: row.personnel_name } : null,
    ranks: row.rank_name ? { name: row.rank_name } : null,
    oldRank: row.old_rank_name ? { name: row.old_rank_name } : null,
    certifications: row.certification_name ? { name: row.certification_name } : null,
    target_slot_label: row.target_slot_label ?? null,
    target_slot_section: row.target_slot_section ?? null,
    target_slot_subsection: row.target_slot_subsection ?? null,
  };
}

async function postgresOptions() {
  const pool = getPostgresPool();
  const [users, actions, personnel] = await Promise.all([
    pool.query("select display_name from public.profiles where display_name is not null order by display_name"),
    pool.query("select distinct action from public.audit_logs where action is not null order by action"),
    pool.query("select name from public.personnel where name is not null order by name"),
  ]);
  return { users: users.rows.map((r) => r.display_name), actions: actions.rows.map((r) => r.action), personnel: personnel.rows.map((r) => r.name) };
}

async function supabaseOptions() {
  const [users, actions, personnel] = await Promise.all([
    supabaseAdmin.from("profiles").select("display_name").order("display_name"),
    supabaseAdmin.from("audit_logs").select("action"),
    supabaseAdmin.from("personnel").select("name").order("name"),
  ]);
  const error = users.error || actions.error || personnel.error;
  if (error) throw error;
  return {
    users: (users.data || []).map((r) => r.display_name).filter(Boolean),
    actions: [...new Set((actions.data || []).map((r) => r.action).filter(Boolean))].sort(),
    personnel: (personnel.data || []).map((r) => r.name).filter(Boolean),
  };
}

function filters(request: Request) {
  const params = new URL(request.url).searchParams;
  const scope = params.get("scope") === "removals" ? "removals" : "all";
  const action = (params.get("action") || "").slice(0, 100);
  const user = (params.get("user") || "").slice(0, 200);
  const personnel = (params.get("personnel") || "").slice(0, 200);
  const start = params.get("start");
  const end = params.get("end");
  return { scope, action, user, personnel, start, end };
}

async function postgresLogs(input: ReturnType<typeof filters>) {
  const values: unknown[] = [];
  const where: string[] = [];
  const add = (sql: string, value: unknown) => { values.push(value); where.push(sql.replace("?", `$${values.length}`)); };
  if (input.scope === "removals") { values.push(REMOVAL_ACTIONS); where.push(`a.action = any($${values.length}::text[])`); }
  if (input.action) add("a.action = ?", input.action);
  if (input.user) add("pr.display_name = ?", input.user);
  if (input.personnel) add("p.name = ?", input.personnel);
  if (input.start && !Number.isNaN(Date.parse(input.start))) add("a.created_at >= ?", new Date(input.start));
  if (input.end && !Number.isNaN(Date.parse(input.end))) add("a.created_at <= ?", new Date(input.end));
  const result = await getPostgresPool().query(
    `select a.id, a.action, a.details, a.created_at, a.user_id, a.processed_by,
            a.target_personnel_id, a.target_slot_label, a.target_slot_section, a.target_slot_subsection,
            pr.display_name as profile_name, processor.name as processor_name, p.name as personnel_name,
            r.name as rank_name, oldr.name as old_rank_name, c.name as certification_name
       from public.audit_logs a
       left join public.profiles pr on pr.id = a.user_id
       left join public.personnel processor on processor.id = a.processed_by
       left join public.personnel p on p.id = a.target_personnel_id
       left join public.ranks r on r.id = a.target_rank_id
       left join public.ranks oldr on oldr.id = a.old_rank_id
       left join public.certifications c on c.id = a.target_certification_id
       ${where.length ? `where ${where.join(" and ")}` : ""}
      order by a.created_at desc limit 200`, values,
  );
  return result.rows.map(serialize);
}

async function supabaseLogs(input: ReturnType<typeof filters>) {
  let query = supabaseAdmin.from("audit_logs").select(`id,action,details,created_at,user_id,processed_by,
    target_personnel_id,profiles:user_id(display_name),processor:processed_by(name),personnel:target_personnel_id(name),
    ranks:target_rank_id(name),oldRank:old_rank_id(name),certifications:target_certification_id(name),
    target_slot_label,target_slot_section,target_slot_subsection`).order("created_at", { ascending: false }).limit(200);
  if (input.scope === "removals") query = query.in("action", REMOVAL_ACTIONS);
  if (input.action) query = query.eq("action", input.action);
  if (input.start) query = query.gte("created_at", input.start);
  if (input.end) query = query.lte("created_at", input.end);
  if (input.user) {
    const { data } = await supabaseAdmin.from("profiles").select("id").eq("display_name", input.user).maybeSingle();
    if (!data) return [];
    query = query.eq("user_id", data.id);
  }
  if (input.personnel) {
    const { data } = await supabaseAdmin.from("personnel").select("id").eq("name", input.personnel).maybeSingle();
    if (!data) return [];
    query = query.eq("target_personnel_id", data.id);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function GET(request: Request) {
  const input = filters(request);
  const permission = input.scope === "removals" ? "admin.removal-log" : "records.audit";
  if (!(await hasAccess(request, permission).catch(() => false))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const wantsOptions = new URL(request.url).searchParams.get("options") === "true";
    const data = wantsOptions
      ? (backend() === "postgres" ? await postgresOptions() : await supabaseOptions())
      : { logs: backend() === "postgres" ? await postgresLogs(input) : await supabaseLogs(input) };
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[audit-logs] Read failed", error);
    return NextResponse.json({ error: "Failed to load audit logs" }, { status: 500 });
  }
}
