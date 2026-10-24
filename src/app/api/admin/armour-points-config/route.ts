import { NextResponse } from "next/server";
import { getPostgresPool, withPostgresTransaction } from "@/lib/postgres/pool";
import { requestHasSameOrigin, requirePageAccess } from "@/lib/route-permissions";
import { getArmourRankAllocation, getArmourStandardEquivalent } from "@/data/armourPoints";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const requirements = new Set(["", "CST+", "VCT+", "CTS+", "CP+", "CS+", "CSM+", "SSM+", "Clone 2nd Lieutenant+", "Authorised command ranks"]);
const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function GET(request: Request) {
  const auth = await requirePageAccess(request, "admin.armour-points-config", "read").catch(() => null);
  if (!auth) return fail("Armour Points Configuration access is required", 403);
  try {
    const pool = getPostgresPool();
    const [rankResult, itemResult] = await Promise.all([
      pool.query(`select rank_key id,rank_key name,sort_order rank_level,true configured,
          points::integer,unrestricted,equivalent_rank,track
        from public.armour_progression_rank_points where active=true
        order by sort_order,case track when 'standard' then 0 when 'alias' then 1 else 2 end,rank_key`),
      pool.query(`select id,name,category,point_cost,rank_requirement,active,sort_order
        from public.armour_customisation_items order by sort_order,name`),
    ]);
    const configuredValues = Object.fromEntries(rankResult.rows
      .filter((rank) => rank.configured)
      .map((rank) => [rank.name, { points: Number(rank.points), unrestricted: Boolean(rank.unrestricted) }]));
    const ranks = rankResult.rows.map((rank) => ({
      ...rank,
      cumulative_points: getArmourRankAllocation(rank.name, configuredValues).points,
      equivalent_rank: rank.equivalent_rank || getArmourStandardEquivalent(rank.name),
    }));
    return NextResponse.json({ ranks, items: itemResult.rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if ((error as { code?: string }).code === "42P01") return fail("Armour points database migrations must be installed before configuration is available", 503);
    console.error("[armour-points-config] Read failed", error);
    return fail("Failed to load armour points configuration", 500);
  }
}

export async function PATCH(request: Request) {
  if (!requestHasSameOrigin(request)) return fail("Invalid request origin", 403);
  const auth = await requirePageAccess(request, "admin.armour-points-config", "edit").catch(() => null);
  if (!auth) return fail("Edit Armour Points Configuration access is required", 403);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const action = String(body?.action || "");

  try {
    await withPostgresTransaction(async (client) => {
      if (action === "rank") {
        const rankId = String(body?.rankId || "").trim();
        const points = Number(body?.points);
        const unrestricted = body?.unrestricted === true;
        if (!rankId || rankId.length > 80 || !Number.isInteger(points) || points < 0 || points > 100000) throw new Error("INVALID");
        const rank = await client.query<{ name: string; equivalent_rank: string | null }>(
          "select rank_key name,equivalent_rank from public.armour_progression_rank_points where rank_key=$1 and active=true", [rankId]);
        if (!rank.rowCount) throw new Error("NOT_FOUND");
        await client.query(`update public.armour_progression_rank_points
          set points=case when equivalent_rank is null then $2 else points end,
              unrestricted=$3,updated_at=now()
          where rank_key=$1`, [rankId, points, unrestricted]);
        await client.query(`insert into public.audit_logs(user_id,action,details)
          values($1,'ARMOUR_RANK_POINTS_CONFIGURED',$2)`, [auth.userId, `${rank.rows[0].name}: promotion award ${points}; unrestricted ${unrestricted ? "yes" : "no"}.`]);
        return;
      }

      if (action === "item") {
        const itemId = String(body?.itemId || "");
        const pointCost = Number(body?.pointCost);
        const requirement = String(body?.rankRequirement || "").trim();
        if (!UUID.test(itemId) || !Number.isInteger(pointCost) || pointCost < 0 || pointCost > 100000 || !requirements.has(requirement)) throw new Error("INVALID");
        const item = await client.query<{ name: string }>(`update public.armour_customisation_items
          set point_cost=$2,rank_requirement=$3,updated_at=now() where id=$1 returning name`, [itemId, pointCost, requirement || null]);
        if (!item.rowCount) throw new Error("NOT_FOUND");
        await client.query(`insert into public.audit_logs(user_id,action,details)
          values($1,'ARMOUR_CATALOGUE_CONFIGURED',$2)`, [auth.userId, `${item.rows[0].name}: ${pointCost} points; requirement ${requirement || "none"}.`]);
        return;
      }
      throw new Error("INVALID");
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = (error as Error).message;
    if (message === "INVALID") return fail("Check the selected record, point value, and rank requirement", 400);
    if (message === "NOT_FOUND") return fail("The selected configuration record no longer exists", 404);
    console.error("[armour-points-config] Write failed", error);
    return fail("Failed to save armour points configuration", 500);
  }
}
