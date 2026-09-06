import { NextResponse } from "next/server";
import { getPostgresPool } from "@/lib/postgres/pool";
import { requestHasSameOrigin, requirePageAccess } from "@/lib/route-permissions";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY = "admin.mod-taskboard";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUSES = new Set(["todo", "in_progress", "review", "done"]);
const PRIORITIES = new Set(["low", "medium", "high"]);
const STAGES = new Set(["concept", "design", "modelling", "texturing", "scripting", "testing"]);
const TAGS = new Set(["Bug", "Helmet", "New Feature", "Update", "Up For Grabs"]);

function backend() {
  const value = process.env.MOD_TASKBOARD_DATABASE_BACKEND || "supabase";
  if (value !== "postgres" && value !== "supabase") throw new Error("Unknown MOD_TASKBOARD_DATABASE_BACKEND");
  return value;
}

function parseTask(value: unknown) {
  const body = value as Record<string, unknown> | null;
  const title = String(body?.title || "").trim().slice(0, 200);
  const status = String(body?.status || "");
  const priority = String(body?.priority || "");
  const stage = String(body?.stage || "");
  const assignedTo = String(body?.assigned_to || "");
  const tags = Array.isArray(body?.tags) ? body.tags.map(String) : [];
  const dueDate = body?.due_date ? new Date(String(body.due_date)) : null;
  if (!title || !STATUSES.has(status) || !PRIORITIES.has(priority) || !STAGES.has(stage) ||
      tags.length > 5 || tags.some((tag) => !TAGS.has(tag)) ||
      (assignedTo && !UUID.test(assignedTo)) || (dueDate && Number.isNaN(dueDate.getTime()))) return null;
  return {
    title,
    description: String(body?.description || "").trim().slice(0, 5000) || null,
    status,
    priority,
    tags,
    stage,
    assigned_to: assignedTo || null,
    due_date: dueDate?.toISOString() || null,
    position: Number.isInteger(Number(body?.position)) ? Math.max(0, Math.min(100000, Number(body?.position))) : 0,
  };
}

async function readPostgres() {
  const pool = getPostgresPool();
  const [assignees, profiles, tasks, comments] = await Promise.all([
    pool.query("select id,name from public.mod_pipeline_assignees order by name"),
    pool.query("select id,display_name from public.profiles order by display_name"),
    pool.query(`select id,title,description,status,priority,tags,stage,assigned_to,created_by,due_date,position,created_at,updated_at
      from public.mod_pipeline_tasks order by status,position,created_at desc`),
    pool.query(`select c.id,c.task_id,c.user_id,c.content,c.created_at,p.display_name
      from public.mod_pipeline_comments c left join public.profiles p on p.id=c.user_id order by c.created_at`),
  ]);
  return { assignees: assignees.rows, profiles: profiles.rows, tasks: tasks.rows, comments: comments.rows.map((row) => ({
    id: row.id, task_id: row.task_id, user_id: row.user_id, content: row.content, created_at: row.created_at,
    profiles: row.display_name ? { display_name: row.display_name } : null,
  })) };
}

async function readSupabase() {
  const [assignees, profiles, tasks, comments] = await Promise.all([
    supabaseAdmin.from("mod_pipeline_assignees").select("id,name").order("name"),
    supabaseAdmin.from("profiles").select("id,display_name").order("display_name"),
    supabaseAdmin.from("mod_pipeline_tasks").select("*").order("status").order("position").order("created_at", { ascending: false }),
    supabaseAdmin.from("mod_pipeline_comments").select("id,task_id,user_id,content,created_at,profiles:user_id(display_name)").order("created_at"),
  ]);
  const error = assignees.error || profiles.error || tasks.error || comments.error;
  if (error) throw error;
  return { assignees: assignees.data || [], profiles: profiles.data || [], tasks: tasks.data || [], comments: comments.data || [] };
}

export async function GET(request: Request) {
  if (!(await requirePageAccess(request, KEY, "read").catch(() => null))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    return NextResponse.json(backend() === "postgres" ? await readPostgres() : await readSupabase(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[mod-taskboard] Read failed", error);
    return NextResponse.json({ error: "Failed to load mod taskboard" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  const auth = await requirePageAccess(request, KEY, "edit").catch(() => null);
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  try {
    if (body?.kind === "comment") {
      const taskId = String(body.taskId || "");
      const content = String(body.content || "").trim().slice(0, 4000);
      if (!UUID.test(taskId) || !content) return NextResponse.json({ error: "Invalid comment" }, { status: 400 });
      if (backend() === "postgres") await getPostgresPool().query(
        "insert into public.mod_pipeline_comments(task_id,user_id,content) values($1,$2,$3)", [taskId, auth.userId, content]);
      else { const { error } = await supabaseAdmin.from("mod_pipeline_comments").insert({ task_id: taskId, user_id: auth.userId, content }); if (error) throw error; }
    } else {
      const input = parseTask(body);
      if (!input) return NextResponse.json({ error: "Invalid task" }, { status: 400 });
      if (backend() === "postgres") await getPostgresPool().query(`insert into public.mod_pipeline_tasks
        (title,description,status,priority,tags,stage,assigned_to,created_by,due_date,position)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [input.title,input.description,input.status,input.priority,input.tags,input.stage,input.assigned_to,auth.userId,input.due_date,input.position]);
      else { const { error } = await supabaseAdmin.from("mod_pipeline_tasks").insert({ ...input, created_by: auth.userId }); if (error) throw error; }
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("[mod-taskboard] Create failed", error);
    return NextResponse.json({ error: "Failed to save mod taskboard item" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!requestHasSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  if (!(await requirePageAccess(request, KEY, "edit").catch(() => null))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const id = String(body?.id || "");
  if (!UUID.test(id)) return NextResponse.json({ error: "Invalid task" }, { status: 400 });
  try {
    let update: Record<string, unknown>;
    if (body?.kind === "move") {
      const status = String(body.status || "");
      if (!STATUSES.has(status)) return NextResponse.json({ error: "Invalid task status" }, { status: 400 });
      update = { status, position: Math.max(0, Math.min(100000, Number(body.position) || 0)) };
    } else {
      const input = parseTask(body);
      if (!input) return NextResponse.json({ error: "Invalid task" }, { status: 400 });
      update = input;
    }
    if (backend() === "postgres") {
      const result = await getPostgresPool().query(`update public.mod_pipeline_tasks set
        title=coalesce($2,title),description=case when $3::boolean then $4 else description end,status=$5,
        priority=coalesce($6,priority),tags=coalesce($7,tags),stage=coalesce($8,stage),
        assigned_to=case when $9::boolean then $10::uuid else assigned_to end,
        due_date=case when $11::boolean then $12::timestamptz else due_date end,position=$13,updated_at=now()
        where id=$1 returning id`, [id,update.title||null,"description" in update,update.description||null,update.status,
        update.priority||null,update.tags||null,update.stage||null,"assigned_to" in update,update.assigned_to||null,
        "due_date" in update,update.due_date||null,update.position]);
      if (!result.rowCount) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    } else {
      const { data, error } = await supabaseAdmin.from("mod_pipeline_tasks").update(update).eq("id", id).select("id").maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[mod-taskboard] Update failed", error);
    return NextResponse.json({ error: "Failed to update mod task" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!requestHasSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  if (!(await requirePageAccess(request, KEY, "full").catch(() => null))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!UUID.test(id)) return NextResponse.json({ error: "Invalid task" }, { status: 400 });
  try {
    if (backend() === "postgres") {
      const result = await getPostgresPool().query("delete from public.mod_pipeline_tasks where id=$1 returning id", [id]);
      if (!result.rowCount) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    } else {
      const { data, error } = await supabaseAdmin.from("mod_pipeline_tasks").delete().eq("id", id).select("id").maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[mod-taskboard] Delete failed", error);
    return NextResponse.json({ error: "Failed to delete mod task" }, { status: 500 });
  }
}
