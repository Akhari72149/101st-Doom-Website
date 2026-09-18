import { NextResponse } from "next/server";
import { getPostgresPool, withPostgresTransaction } from "@/lib/postgres/pool";
import { requestHasSameOrigin, requirePageAccess } from "@/lib/route-permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function GET(request: Request) {
  if (!(await requirePageAccess(request, "admin.rank-corrections", "read").catch(() => null))) return fail("Forbidden", 403);
  const [personnel, ranks] = await Promise.all([
    getPostgresPool().query(`select personnel.id,personnel.name,personnel.birth_number,personnel.rank_id,
      personnel.rank_effective_at,ranks.name rank_name
      from public.personnel personnel left join public.ranks ranks on ranks.id=personnel.rank_id
      where lower(coalesce(personnel.status,'')) not in ('removed','retired','transferred')
      order by personnel.name`),
    getPostgresPool().query(`select id,name,rank_level from public.ranks where is_active=true order by rank_level,name`),
  ]);
  return NextResponse.json({ personnel: personnel.rows, ranks: ranks.rows }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return fail("Invalid request origin", 403);
  const auth = await requirePageAccess(request, "admin.rank-corrections", "edit").catch(() => null);
  if (!auth) return fail("Edit Rank Corrections access is required", 403);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const personnelId = String(body?.personnelId || "");
  const rankId = String(body?.rankId || "");
  const reason = String(body?.reason || "").trim().replace(/\s+/g, " ").slice(0, 500);
  if (!UUID.test(personnelId) || !UUID.test(rankId) || reason.length < 3) return fail("Invalid rank correction", 400);

  try {
    const result = await withPostgresTransaction(async (client) => {
      const person = await client.query<{ name: string; rank_id: string | null; rank_effective_at: Date | null }>(
        `select name,rank_id,rank_effective_at from public.personnel where id=$1 for update`, [personnelId],
      );
      if (!person.rowCount) throw new Error("NOT_FOUND");
      const current = person.rows[0];
      if (current.rank_id === rankId) throw new Error("NO_CHANGE");
      const rank = await client.query<{ name: string }>("select name from public.ranks where id=$1 and is_active=true", [rankId]);
      if (!rank.rowCount) throw new Error("INVALID_RANK");

      await client.query("select set_config('app.preserve_rank_effective_at','true',true)");
      await client.query("update public.personnel set rank_id=$2 where id=$1", [personnelId, rankId]);
      await client.query("select public.enqueue_rank_role_sync($1,$2,$3)", [personnelId, current.rank_id, rankId]);
      await client.query(`insert into public.audit_logs
        (user_id,target_personnel_id,action,old_rank_id,target_rank_id,details)
        values($1,$2,'RANK_CORRECTED_PRESERVE_TIG',$3,$4,$5)`, [
        auth.userId, personnelId, current.rank_id, rankId,
        `Corrected rank to ${rank.rows[0].name} without changing TIG. Reason: ${reason}`,
      ]);
      return { rankId, rankName: rank.rows[0].name, rankEffectiveAt: current.rank_effective_at };
    });
    return NextResponse.json({ success: true, ...result });
  } catch (caught) {
    const code = caught instanceof Error ? caught.message : "";
    if (code === "NOT_FOUND") return fail("Personnel record not found", 404);
    if (code === "NO_CHANGE") return fail("That personnel record already has the selected rank", 409);
    if (code === "INVALID_RANK") return fail("Select an active rank", 400);
    console.error("[rank-corrections] Correction failed", caught);
    return fail("Failed to correct rank", 500);
  }
}
