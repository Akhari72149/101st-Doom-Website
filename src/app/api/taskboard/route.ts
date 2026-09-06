import { NextResponse } from "next/server";
import { pagePermissionDefinitions, type PagePermissionAccess } from "@/data/pagePermissions";
import { getAdminRouteAuth } from "@/lib/admin-route-auth";
import { getNativeSession } from "@/lib/postgres/auth";
import { getPostgresPool } from "@/lib/postgres/pool";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY = "admin.taskboard";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUSES = new Set(["todo", "in_progress", "review", "done"]);
const PRIORITIES = new Set(["low", "medium", "high"]);
const weights: Record<PagePermissionAccess, number> = { none: 0, read: 1, edit: 2, full: 3 };

function backend() {
  const value = process.env.TASKBOARD_DATABASE_BACKEND || "supabase";
  if (value !== "postgres" && value !== "supabase") throw new Error("Unknown TASKBOARD_DATABASE_BACKEND");
  return value;
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(process.env.APP_ORIGIN || request.url).origin; } catch { return false; }
}

async function editor(request: Request) {
  const legacy = new Set(pagePermissionDefinitions.find((entry) => entry.key === KEY)?.legacyRoles || []);
  if (process.env.NATIVE_AUTH_ENABLED === "true") {
    const session = await getNativeSession(request.headers).catch(() => null);
    if (!session) return null;
    const [permission, roles] = await Promise.all([
      getPostgresPool().query<{ access_level: PagePermissionAccess }>(
        "select access_level from public.user_page_permissions where user_id=$1 and permission_key=$2", [session.user.id, KEY]),
      getPostgresPool().query<{ role: string }>("select role from public.user_roles where user_id=$1", [session.user.id]),
    ]);
    const allowed = weights[permission.rows[0]?.access_level || "none"] >= weights.edit || roles.rows.some((r) => legacy.has(r.role.toLowerCase()));
    return allowed ? session.user.id : null;
  }
  const auth = await getAdminRouteAuth(request);
  if (!auth.userId) return null;
  const { data } = await supabaseAdmin.from("user_page_permissions").select("access_level")
    .eq("user_id", auth.userId).eq("permission_key", KEY).maybeSingle();
  return weights[(data?.access_level as PagePermissionAccess) || "none"] >= weights.edit || auth.roles.some((r) => legacy.has(r))
    ? auth.userId : null;
}

async function readPostgres() {
  const pool = getPostgresPool();
  const [profiles, tasks, comments] = await Promise.all([
    pool.query("select id, display_name from public.profiles order by display_name"),
    pool.query(`select id,title,description,status,priority,label,assigned_to,created_by,due_date,position,created_at,updated_at
      from public.taskboard_tasks order by status,position,created_at desc`),
    pool.query(`select c.id,c.task_id,c.user_id,c.content,c.created_at,p.display_name
      from public.taskboard_comments c left join public.profiles p on p.id=c.user_id order by c.created_at`),
  ]);
  return { profiles: profiles.rows, tasks: tasks.rows, comments: comments.rows.map((c) => ({
    id:c.id, task_id:c.task_id, user_id:c.user_id, content:c.content, created_at:c.created_at,
    profiles:c.display_name ? { display_name:c.display_name } : null,
  })) };
}

async function readSupabase() {
  const [profiles, tasks, comments] = await Promise.all([
    supabaseAdmin.from("profiles").select("id,display_name").order("display_name"),
    supabaseAdmin.from("taskboard_tasks").select("id,title,description,status,priority,label,assigned_to,created_by,due_date,position,created_at,updated_at")
      .order("status").order("position").order("created_at", { ascending:false }),
    supabaseAdmin.from("taskboard_comments").select("id,task_id,user_id,content,created_at,profiles:user_id(display_name)").order("created_at"),
  ]);
  const error=profiles.error||tasks.error||comments.error; if(error) throw error;
  return { profiles:profiles.data||[], tasks:tasks.data||[], comments:comments.data||[] };
}

export async function GET() {
  try { return NextResponse.json(backend()==="postgres" ? await readPostgres() : await readSupabase(), { headers:{"Cache-Control":"no-store"} }); }
  catch(error){ console.error("[taskboard] Read failed",error); return NextResponse.json({error:"Failed to load taskboard"},{status:500}); }
}

function taskInput(value: unknown) {
  const b=value as Record<string,unknown>|null;
  const title=String(b?.title||"").trim().slice(0,200), status=String(b?.status||""), priority=String(b?.priority||"");
  const assigned=String(b?.assigned_to||"");
  const due=b?.due_date ? new Date(String(b.due_date)) : null;
  if(!title||!STATUSES.has(status)||!PRIORITIES.has(priority)|| (assigned&&!UUID.test(assigned)) || (due&&Number.isNaN(due.getTime()))) return null;
  return { title, description:String(b?.description||"").trim().slice(0,5000)||null, status, priority,
    label:String(b?.label||"").trim().slice(0,80)||null, assigned_to:assigned||null, due_date:due?.toISOString()||null,
    position:Number.isInteger(Number(b?.position)) ? Math.max(0,Math.min(100000,Number(b?.position))) : 0 };
}

export async function POST(request: Request) {
  if(!sameOrigin(request)) return NextResponse.json({error:"Invalid request origin"},{status:403});
  const userId=await editor(request); if(!userId) return NextResponse.json({error:"Forbidden"},{status:403});
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
  try {
    if(body?.kind==="comment"){
      const taskId=String(body.taskId||""), content=String(body.content||"").trim().slice(0,4000);
      if(!UUID.test(taskId)||!content) return NextResponse.json({error:"Invalid comment"},{status:400});
      if(backend()==="postgres") await getPostgresPool().query("insert into public.taskboard_comments(task_id,user_id,content) values($1,$2,$3)",[taskId,userId,content]);
      else {const {error}=await supabaseAdmin.from("taskboard_comments").insert({task_id:taskId,user_id:userId,content});if(error)throw error;}
    } else {
      const input=taskInput(body); if(!input)return NextResponse.json({error:"Invalid task"},{status:400});
      if(backend()==="postgres") await getPostgresPool().query(`insert into public.taskboard_tasks
        (title,description,status,priority,label,assigned_to,created_by,due_date,position) values($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [input.title,input.description,input.status,input.priority,input.label,input.assigned_to,userId,input.due_date,input.position]);
      else {const {error}=await supabaseAdmin.from("taskboard_tasks").insert({...input,created_by:userId});if(error)throw error;}
    }
    return NextResponse.json({ok:true},{status:201});
  } catch(error){console.error("[taskboard] Create failed",error);return NextResponse.json({error:"Failed to save taskboard item"},{status:500});}
}

export async function PATCH(request: Request) {
  if(!sameOrigin(request)) return NextResponse.json({error:"Invalid request origin"},{status:403});
  if(!(await editor(request))) return NextResponse.json({error:"Forbidden"},{status:403});
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null; const id=String(body?.id||"");
  if(!UUID.test(id))return NextResponse.json({error:"Invalid task"},{status:400});
  try {
    let update: Record<string,unknown>;
    if(body?.kind==="move"){
      const status=String(body.status||""),position=Math.max(0,Math.min(100000,Number(body.position)||0));
      if(!STATUSES.has(status))return NextResponse.json({error:"Invalid task status"},{status:400}); update={status,position};
    } else { const input=taskInput(body);if(!input)return NextResponse.json({error:"Invalid task"},{status:400});update=input; }
    if(backend()==="postgres"){
      const r=await getPostgresPool().query(`update public.taskboard_tasks set title=coalesce($2,title),description=case when $3::boolean then $4 else description end,
        status=$5,priority=coalesce($6,priority),label=case when $7::boolean then $8 else label end,assigned_to=case when $9::boolean then $10::uuid else assigned_to end,
        due_date=case when $11::boolean then $12::timestamptz else due_date end,position=$13,updated_at=now() where id=$1 returning id`,
        [id,update.title||null,"description" in update,update.description||null,update.status,update.priority||null,"label" in update,update.label||null,
          "assigned_to" in update,update.assigned_to||null,"due_date" in update,update.due_date||null,update.position]);
      if(!r.rowCount)return NextResponse.json({error:"Task not found"},{status:404});
    } else {const {data,error}=await supabaseAdmin.from("taskboard_tasks").update(update).eq("id",id).select("id").maybeSingle();if(error)throw error;if(!data)return NextResponse.json({error:"Task not found"},{status:404});}
    return NextResponse.json({ok:true});
  }catch(error){console.error("[taskboard] Update failed",error);return NextResponse.json({error:"Failed to update task"},{status:500});}
}

export async function DELETE(request: Request){
  if(!sameOrigin(request))return NextResponse.json({error:"Invalid request origin"},{status:403});
  if(!(await editor(request)))return NextResponse.json({error:"Forbidden"},{status:403});
  const id=new URL(request.url).searchParams.get("id")||"";if(!UUID.test(id))return NextResponse.json({error:"Invalid task"},{status:400});
  try{if(backend()==="postgres"){const r=await getPostgresPool().query("delete from public.taskboard_tasks where id=$1 returning id",[id]);if(!r.rowCount)return NextResponse.json({error:"Task not found"},{status:404});}
    else{const{data,error}=await supabaseAdmin.from("taskboard_tasks").delete().eq("id",id).select("id").maybeSingle();if(error)throw error;if(!data)return NextResponse.json({error:"Task not found"},{status:404});}
    return NextResponse.json({ok:true});}catch(error){console.error("[taskboard] Delete failed",error);return NextResponse.json({error:"Failed to delete task"},{status:500});}
}
