import { NextResponse } from "next/server";
import { getPostgresPool, withPostgresTransaction } from "@/lib/postgres/pool";
import { requestHasSameOrigin, requirePageAccess } from "@/lib/route-permissions";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY = "operations.randomiser";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function backend() {
  const value = process.env.RANDOMISER_DATABASE_BACKEND || "supabase";
  if (value !== "postgres" && value !== "supabase") throw new Error("Unknown RANDOMISER_DATABASE_BACKEND");
  return value;
}

function cleanName(value: unknown) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 100);
}

function weight(level: number) {
  return level === 2 ? 75 : level === 3 ? 50 : level === 4 ? 25 : 100;
}

function chooseWeighted<T extends { weight: number }>(items: T[], count: number) {
  const pool = [...items];
  const chosen: T[] = [];
  while (chosen.length < count && pool.length) {
    const total = pool.reduce((sum, item) => sum + item.weight, 0);
    let value = Math.random() * total;
    let index = pool.length - 1;
    for (let i = 0; i < pool.length; i += 1) {
      value -= pool[i].weight;
      if (value <= 0) { index = i; break; }
    }
    chosen.push(pool.splice(index, 1)[0]);
  }
  return chosen;
}

async function readPostgres() {
  const pool = getPostgresPool();
  const operation = await pool.query("select * from public.side_operations order by created_at,id limit 1");
  if (!operation.rows[0]) return { operation: null, signups: [], knownPeople: [] };
  const [signups, levels] = await Promise.all([
    pool.query("select * from public.side_operation_signups where operation_id=$1 order by created_at,id", [operation.rows[0].id]),
    pool.query("select * from public.side_operation_levels order by name"),
  ]);
  const levelsByName = new Map(levels.rows.map((row) => [String(row.name).trim().toLowerCase(), row.level]));
  return { operation: operation.rows[0], knownPeople: levels.rows, signups: signups.rows.map((row) => {
    const level = Number(levelsByName.get(String(row.name).trim().toLowerCase()) || 1);
    return { ...row, level, weight: weight(level) };
  }) };
}

async function readSupabase() {
  const operationResult = await supabaseAdmin.from("side_operations").select("*").order("created_at").limit(1).maybeSingle();
  if (operationResult.error) throw operationResult.error;
  const operation = operationResult.data;
  if (!operation) return { operation: null, signups: [], knownPeople: [] };
  const [signups, levels] = await Promise.all([
    supabaseAdmin.from("side_operation_signups").select("*").eq("operation_id", operation.id).order("created_at"),
    supabaseAdmin.from("side_operation_levels").select("*").order("name"),
  ]);
  if (signups.error || levels.error) throw signups.error || levels.error;
  const knownPeople = levels.data || [];
  const levelsByName = new Map(knownPeople.map((row) => [String(row.name).trim().toLowerCase(), row.level]));
  return { operation, knownPeople, signups: (signups.data || []).map((row) => {
    const level = Number(levelsByName.get(String(row.name).trim().toLowerCase()) || 1);
    return { ...row, level, weight: weight(level) };
  }) };
}

export async function GET() {
  try {
    return NextResponse.json(backend() === "postgres" ? await readPostgres() : await readSupabase(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[randomiser] Read failed", error);
    return NextResponse.json({ error: "Failed to load operation" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const action = String(body?.action || "signup");
  if (action !== "signup") return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  const operationId = String(body?.operationId || "");
  const name = cleanName(body?.name);
  if (!UUID.test(operationId) || !name) return NextResponse.json({ error: "Invalid signup" }, { status: 400 });
  try {
    if (backend() === "postgres") {
      await withPostgresTransaction(async (client) => {
        const operation = await client.query<{ open: boolean }>("select open from public.side_operations where id=$1 for update", [operationId]);
        if (!operation.rows[0]?.open) throw new Error("SIGNUPS_CLOSED");
        await client.query("insert into public.side_operation_signups(operation_id,name,selected) values($1,$2,false)", [operationId, name]);
      });
    } else {
      const { data: operation, error: operationError } = await supabaseAdmin.from("side_operations").select("open").eq("id", operationId).maybeSingle();
      if (operationError) throw operationError;
      if (!operation?.open) throw new Error("SIGNUPS_CLOSED");
      const { data: existing, error: existingError } = await supabaseAdmin.from("side_operation_signups").select("id").eq("operation_id", operationId).ilike("name", name).limit(1);
      if (existingError) throw existingError;
      if (existing?.length) throw new Error("DUPLICATE_SIGNUP");
      const { error } = await supabaseAdmin.from("side_operation_signups").insert({ operation_id: operationId, name, selected: false });
      if (error) throw error;
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "SIGNUPS_CLOSED") return NextResponse.json({ error: "Signups are closed" }, { status: 409 });
    if (code === "DUPLICATE_SIGNUP" || (typeof error === "object" && error && "code" in error && error.code === "23505"))
      return NextResponse.json({ error: "That person is already signed up" }, { status: 409 });
    console.error("[randomiser] Signup failed", error);
    return NextResponse.json({ error: "Failed to add signup" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!requestHasSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  if (!(await requirePageAccess(request, KEY, "edit").catch(() => null))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const action = String(body?.action || "");
  const operationId = String(body?.operationId || "");
  if (!UUID.test(operationId)) return NextResponse.json({ error: "Invalid operation" }, { status: 400 });
  try {
    if (action === "details") {
      const title = String(body?.title || "").trim().slice(0, 200);
      const description = String(body?.description || "").trim().slice(0, 5000);
      const slotCount = Number(body?.slotCount);
      if (!title || !description || !Number.isInteger(slotCount) || slotCount < 1 || slotCount > 100)
        return NextResponse.json({ error: "Invalid operation details" }, { status: 400 });
      if (backend() === "postgres") await getPostgresPool().query(
        "update public.side_operations set title=$2,description=$3,slot_count=$4 where id=$1", [operationId,title,description,slotCount]);
      else { const { error } = await supabaseAdmin.from("side_operations").update({ title,description,slot_count:slotCount }).eq("id",operationId); if (error) throw error; }
    } else if (action === "toggle") {
      if (typeof body?.open !== "boolean") return NextResponse.json({ error: "Invalid signup state" }, { status: 400 });
      if (backend() === "postgres") await getPostgresPool().query("update public.side_operations set open=$2 where id=$1", [operationId,body.open]);
      else { const { error } = await supabaseAdmin.from("side_operations").update({ open:body.open }).eq("id",operationId); if (error) throw error; }
    } else if (action === "reset") {
      if (backend() === "postgres") await withPostgresTransaction(async (client) => {
        await client.query("update public.side_operation_signups set selected=false where operation_id=$1", [operationId]);
        await client.query("update public.side_operations set randomised=false where id=$1", [operationId]);
      }); else {
        const first = await supabaseAdmin.from("side_operation_signups").update({ selected:false }).eq("operation_id",operationId);
        if (first.error) throw first.error;
        const second = await supabaseAdmin.from("side_operations").update({ randomised:false }).eq("id",operationId);
        if (second.error) throw second.error;
      }
    } else if (action === "randomise") {
      if (backend() === "postgres") await withPostgresTransaction(async (client) => {
        const operation = await client.query<{ slot_count: number }>("select slot_count from public.side_operations where id=$1 for update", [operationId]);
        if (!operation.rows[0]) throw new Error("NOT_FOUND");
        const signups = await client.query<{ id:string; name:string; level:number }>(`select s.id,s.name,coalesce(l.level,1)::int level
          from public.side_operation_signups s left join public.side_operation_levels l on lower(btrim(l.name))=lower(btrim(s.name))
          where s.operation_id=$1 and not s.selected for update of s`, [operationId]);
        const chosen = chooseWeighted(signups.rows.map((row) => ({ ...row, weight:weight(row.level) })), operation.rows[0].slot_count);
        if (chosen.length) {
          await client.query("update public.side_operation_signups set selected=true where id=any($1::uuid[])", [chosen.map((row) => row.id)]);
          for (const row of chosen) await client.query(`insert into public.side_operation_levels(name,level) values($1,2)
            on conflict(name) do update set level=least(public.side_operation_levels.level+1,4)`, [row.name]);
        }
        await client.query("update public.side_operations set randomised=true where id=$1", [operationId]);
      }); else await randomiseSupabase(operationId);
    } else return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[randomiser] Update failed", error);
    return NextResponse.json({ error: "Failed to update operation" }, { status: 500 });
  }
}

async function randomiseSupabase(operationId: string) {
  const [operation, signups, levels] = await Promise.all([
    supabaseAdmin.from("side_operations").select("slot_count").eq("id",operationId).single(),
    supabaseAdmin.from("side_operation_signups").select("id,name").eq("operation_id",operationId).eq("selected",false),
    supabaseAdmin.from("side_operation_levels").select("id,name,level"),
  ]);
  if (operation.error || signups.error || levels.error) throw operation.error || signups.error || levels.error;
  const levelMap = new Map((levels.data || []).map((row) => [String(row.name).trim().toLowerCase(), row]));
  const chosen = chooseWeighted((signups.data || []).map((row) => {
    const level = Number(levelMap.get(String(row.name).trim().toLowerCase())?.level || 1);
    return { ...row, level, weight:weight(level) };
  }), operation.data.slot_count);
  for (const row of chosen) {
    const selected = await supabaseAdmin.from("side_operation_signups").update({ selected:true }).eq("id",row.id); if (selected.error) throw selected.error;
    const existing = levelMap.get(String(row.name).trim().toLowerCase());
    const result = existing
      ? await supabaseAdmin.from("side_operation_levels").update({ level:Math.min(Number(existing.level)+1,4) }).eq("id",existing.id)
      : await supabaseAdmin.from("side_operation_levels").insert({ name:row.name,level:2 });
    if (result.error) throw result.error;
  }
  const updated = await supabaseAdmin.from("side_operations").update({ randomised:true }).eq("id",operationId);
  if (updated.error) throw updated.error;
}

export async function DELETE(request: Request) {
  if (!requestHasSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  if (!(await requirePageAccess(request, KEY, "edit").catch(() => null))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = new URL(request.url).searchParams.get("signupId") || "";
  if (!UUID.test(id)) return NextResponse.json({ error: "Invalid signup" }, { status: 400 });
  try {
    if (backend() === "postgres") await getPostgresPool().query("delete from public.side_operation_signups where id=$1", [id]);
    else { const { error } = await supabaseAdmin.from("side_operation_signups").delete().eq("id",id); if (error) throw error; }
    return NextResponse.json({ ok:true });
  } catch (error) {
    console.error("[randomiser] Delete failed", error);
    return NextResponse.json({ error:"Failed to remove signup" }, { status:500 });
  }
}
