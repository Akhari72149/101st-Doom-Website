import { NextResponse } from "next/server";
import { getPostgresPool, withPostgresTransaction } from "@/lib/postgres/pool";
import { requestHasSameOrigin, requirePageAccess } from "@/lib/route-permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROLE_ID = /^\d{16,22}$/;

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  if (!(await requirePageAccess(request, "admin.ranks", "read").catch(() => null))) return error("Forbidden", 403);
  const result = await getPostgresPool().query(`
    select ranks.id, ranks.name, ranks.rank_level, ranks.discord_role_id, ranks.is_active,
           count(personnel.id)::integer as personnel_count
      from public.ranks ranks
      left join public.personnel personnel on personnel.rank_id = ranks.id
     group by ranks.id
     order by ranks.rank_level, ranks.name`);
  return NextResponse.json({ ranks: result.rows }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return error("Invalid request origin", 403);
  const auth = await requirePageAccess(request, "admin.ranks", "full").catch(() => null);
  if (!auth) return error("Full Rank Management access is required", 403);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const name = String(body?.name || "").trim().replace(/\s+/g, " ").slice(0, 60);
  const level = Number(body?.rankLevel);
  const discordRoleId = String(body?.discordRoleId || "").trim() || null;
  if (!name || !Number.isInteger(level) || level < 0 || level > 1000 || (discordRoleId && !ROLE_ID.test(discordRoleId))) {
    return error("Invalid rank details", 400);
  }
  try {
    const row = await withPostgresTransaction(async (client) => {
      const inserted = await client.query(`insert into public.ranks(name, rank_level, discord_role_id, is_active)
        values($1,$2,$3,true) returning id,name,rank_level,discord_role_id,is_active`, [name, level, discordRoleId]);
      await client.query(`insert into public.audit_logs(user_id,action,details)
        values($1,'RANK_DEFINITION_CREATED',$2)`, [auth.userId, `Created rank ${name} at level ${level}`]);
      return inserted.rows[0];
    });
    return NextResponse.json({ rank: row }, { status: 201 });
  } catch (caught) {
    if ((caught as { code?: string }).code === "23505") return error("A rank with those details already exists", 409);
    console.error("[ranks] Create failed", caught);
    return error("Failed to create rank", 500);
  }
}

export async function PATCH(request: Request) {
  if (!requestHasSameOrigin(request)) return error("Invalid request origin", 403);
  const auth = await requirePageAccess(request, "admin.ranks", "edit").catch(() => null);
  if (!auth) return error("Edit Rank Management access is required", 403);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const id = String(body?.id || "");
  const name = String(body?.name || "").trim().replace(/\s+/g, " ").slice(0, 60);
  const level = Number(body?.rankLevel);
  const discordRoleId = String(body?.discordRoleId || "").trim() || null;
  const isActive = body?.isActive;
  if (!UUID.test(id) || !name || !Number.isInteger(level) || level < 0 || level > 1000 ||
      (discordRoleId && !ROLE_ID.test(discordRoleId)) || typeof isActive !== "boolean") return error("Invalid rank details", 400);
  if (isActive === false && !(await requirePageAccess(request, "admin.ranks", "full").catch(() => null))) {
    return error("Full access is required to retire a rank", 403);
  }
  const updated = await withPostgresTransaction(async (client) => {
    const result = await client.query(`update public.ranks set name=$2,rank_level=$3,discord_role_id=$4,is_active=$5
      where id=$1 returning id,name,rank_level,discord_role_id,is_active`, [id, name, level, discordRoleId, isActive]);
    if (!result.rowCount) return null;
    await client.query(`insert into public.audit_logs(user_id,action,details)
      values($1,'RANK_DEFINITION_UPDATED',$2)`, [auth.userId, `Updated rank ${name}; active=${isActive}`]);
    return result.rows[0];
  });
  return updated ? NextResponse.json({ rank: updated }) : error("Rank not found", 404);
}

export async function PUT(request: Request) {
  if (!requestHasSameOrigin(request)) return error("Invalid request origin", 403);
  const auth = await requirePageAccess(request, "admin.ranks", "edit").catch(() => null);
  if (!auth) return error("Edit Rank Management access is required", 403);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const orderedIds = Array.isArray(body?.orderedIds) ? body.orderedIds.map(String) : [];
  if (!orderedIds.length || orderedIds.some((id) => !UUID.test(id)) || new Set(orderedIds).size !== orderedIds.length) {
    return error("Invalid rank order", 400);
  }
  try {
    await withPostgresTransaction(async (client) => {
      const existing = await client.query<{ id: string }>("select id from public.ranks order by id for update");
      const existingIds = new Set(existing.rows.map((row) => row.id));
      if (existingIds.size !== orderedIds.length || orderedIds.some((id) => !existingIds.has(id))) {
        throw new Error("ORDER_CHANGED");
      }
      await client.query(`update public.ranks ranks
        set rank_level = ordered.position - 1
        from unnest($1::uuid[]) with ordinality ordered(id, position)
        where ranks.id = ordered.id`, [orderedIds]);
      await client.query(`insert into public.audit_logs(user_id,action,details)
        values($1,'RANK_ORDER_UPDATED',$2)`, [auth.userId, `Reordered ${orderedIds.length} rank definitions`]);
    });
    return NextResponse.json({ success: true });
  } catch (caught) {
    if ((caught as Error).message === "ORDER_CHANGED") return error("Ranks changed while reordering. Refresh and try again.", 409);
    console.error("[ranks] Reorder failed", caught);
    return error("Failed to reorder ranks", 500);
  }
}
