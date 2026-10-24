import { NextResponse } from "next/server";
import { getPostgresPool, withPostgresTransaction } from "@/lib/postgres/pool";
import { requestHasSameOrigin, requirePageAccess } from "@/lib/route-permissions";
import { armourItemPreview, armourPointSourcePreview, armourRankPoints, getArmourRankAllocation, meetsArmourRankRequirement, type ArmourRankPointConfig } from "@/data/armourPoints";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

const peopleSql = `
  select p.id,p.name,p.birth_number,r.name rank_name,
    coalesce(sum(l.points_delta),0)::integer ledger_points
  from public.personnel p
  left join public.ranks r on r.id=p.rank_id
  left join public.armour_point_ledger l on l.personnel_id=p.id
  where lower(coalesce(p.status,'')) not in ('retired','removed','transferred')
  group by p.id,p.name,p.birth_number,r.name`;

type RankValueRow = { name: string; points: number; unrestricted: boolean };
const rankConfigFromRows = (rows: RankValueRow[]) => Object.fromEntries(rows.map((row) => [row.name, {
  points: Number(row.points),
  unrestricted: Boolean(row.unrestricted),
} satisfies ArmourRankPointConfig]));

export async function GET(request: Request) {
  const url = new URL(request.url);
  const personnelId = url.searchParams.get("personnelId");
  if (personnelId && !UUID.test(personnelId)) return fail("Invalid personnel record", 400);

  try {
    const pool = getPostgresPool();
    const [people, rankValues, items, sources, history] = await Promise.all([
      pool.query<{ id: string; name: string; birth_number: string; rank_name: string | null; ledger_points: number }>(`${peopleSql} order by lower(p.name)`),
      pool.query<RankValueRow>(`select rank_key name,points,unrestricted
        from public.armour_progression_rank_points where active=true`),
      pool.query(`select id,name,category,point_cost,rank_requirement,description
        from public.armour_customisation_items where active=true order by sort_order,name`),
      pool.query(`select id,name,category,points from public.armour_point_sources
        where active=true order by sort_order,name`),
      personnelId
        ? pool.query(`select l.id,l.entry_type,l.points_delta,l.source_label,l.quantity,l.notes,l.created_at,
            item.name item_name,coalesce(nullif(btrim(u."displayUsername"),''),nullif(btrim(u.name),''),u.username,'System') recorded_by
          from public.armour_point_ledger l
          left join public.armour_customisation_items item on item.id=l.catalog_item_id
          left join public.app_auth_users u on u.id=l.created_by
          where l.personnel_id=$1 order by l.created_at desc,l.id desc`, [personnelId])
        : Promise.resolve({ rows: [] }),
    ]);
    const configuredValues = rankConfigFromRows(rankValues.rows);
    const personnel = people.rows.map((person) => {
      const allocation = getArmourRankAllocation(person.rank_name, configuredValues);
      const ledgerPoints = Number(person.ledger_points);
      return {
        ...person,
        rank_configured: allocation.configured,
        rank_points: allocation.points,
        rank_breakdown: allocation.breakdown,
        unrestricted: allocation.unrestricted,
        ledger_points: ledgerPoints,
        balance: allocation.points + ledgerPoints,
      };
    });
    return NextResponse.json({ personnel, items: items.rows, sources: sources.rows, history: history.rows, databaseReady: true }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if ((error as { code?: string }).code === "42P01") {
      const preview = await getPostgresPool().query<{id:string;name:string;birth_number:string;rank_name:string|null}>(`select p.id,p.name,p.birth_number,r.name rank_name
        from public.personnel p left join public.ranks r on r.id=p.rank_id
        where lower(coalesce(p.status,'')) not in ('retired','removed','transferred')
        order by lower(p.name)`);
      const personnel = preview.rows.map((person) => {
        const allocation = getArmourRankAllocation(person.rank_name, armourRankPoints);
        return {...person,rank_configured:allocation.configured,rank_points:allocation.points,rank_breakdown:allocation.breakdown,ledger_points:0,balance:allocation.points,unrestricted:allocation.unrestricted};
      });
      return NextResponse.json({personnel,items:armourItemPreview,sources:armourPointSourcePreview,history:[],databaseReady:false},{headers:{"Cache-Control":"no-store"}});
    }
    console.error("[armour-points] Read failed", error);
    return fail("Failed to load armour points", 500);
  }
}

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return fail("Invalid request origin", 403);
  const auth = await requirePageAccess(request, "admin.armour-points", "edit").catch(() => null);
  if (!auth) return fail("Edit Armour Customisation Points access is required", 403);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const action = String(body?.action || "");
  const personnelId = String(body?.personnelId || "");
  const notes = String(body?.notes || "").trim().slice(0, 1000);
  if (!UUID.test(personnelId)) return fail("Select a personnel account", 400);

  try {
    const result = await withPostgresTransaction(async (client) => {
      const person = await client.query<{ name: string; rank_name: string | null; ledger_points: number }>(`
        select p.name,r.name rank_name,
          coalesce((select sum(points_delta) from public.armour_point_ledger where personnel_id=p.id),0)::integer ledger_points
        from public.personnel p left join public.ranks r on r.id=p.rank_id
        where p.id=$1 for update`, [personnelId]);
      if (!person.rowCount) throw new Error("NOT_FOUND");
      const rankValues = await client.query<RankValueRow>(`select rank_key name,points,unrestricted
        from public.armour_progression_rank_points where active=true`);
      const allocation = getArmourRankAllocation(person.rows[0].rank_name, rankConfigFromRows(rankValues.rows));
      const current = { ...person.rows[0], rank_points: allocation.points, unrestricted: allocation.unrestricted };

      if (action === "spend") {
        const submitted = Array.isArray(body?.purchases)
          ? body.purchases
          : [{ itemId: body?.itemId, quantity: body?.quantity }];
        if (!submitted.length || submitted.length > 50) throw new Error("INVALID");

        const quantities = new Map<string, number>();
        for (const purchase of submitted) {
          if (!purchase || typeof purchase !== "object") throw new Error("INVALID");
          const itemId = String((purchase as Record<string, unknown>).itemId || "");
          const quantity = Number((purchase as Record<string, unknown>).quantity);
          if (!UUID.test(itemId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 100) throw new Error("INVALID");
          quantities.set(itemId, (quantities.get(itemId) || 0) + quantity);
          if ((quantities.get(itemId) || 0) > 100) throw new Error("INVALID");
        }

        const itemIds = [...quantities.keys()];
        const itemRows = await client.query<{ id: string; name: string; point_cost: number; rank_requirement: string | null }>(
          "select id,name,point_cost,rank_requirement from public.armour_customisation_items where id=any($1::uuid[]) and active=true and point_cost>0",
          [itemIds],
        );
        if (itemRows.rows.length !== itemIds.length) throw new Error("ITEM_NOT_FOUND");
        if (itemRows.rows.some((item) => !meetsArmourRankRequirement(current.rank_name, item.rank_requirement, current.unrestricted))) {
          throw new Error("RANK_REQUIRED");
        }

        const purchases = itemIds.map((itemId) => {
          const item = itemRows.rows.find((candidate) => candidate.id === itemId)!;
          const quantity = quantities.get(itemId)!;
          return { ...item, quantity, cost: Number(item.point_cost) * quantity };
        });
        const cost = purchases.reduce((total, purchase) => total + purchase.cost, 0);
        const balance = current.rank_points + current.ledger_points;
        if (!current.unrestricted && cost > balance) throw new Error("INSUFFICIENT");

        const entries = [];
        for (const purchase of purchases) {
          const entry = await client.query(`insert into public.armour_point_ledger
            (personnel_id,entry_type,points_delta,source_label,catalog_item_id,quantity,notes,created_by)
            values($1,'spend',$2,$3,$4,$5,$6,$7) returning *`,
          [personnelId, -purchase.cost, purchase.name, purchase.id, purchase.quantity, notes || null, auth.userId]);
          entries.push(entry.rows[0]);
        }
        const purchaseSummary = purchases.map((purchase) => `${purchase.quantity} x ${purchase.name}`).join(", ");
        await client.query(`insert into public.audit_logs(user_id,target_personnel_id,action,details)
          values($1,$2,'ARMOUR_POINTS_SPENT',$3)`,
        [auth.userId, personnelId, `${current.name}: ${purchaseSummary} (${cost} points).${notes ? ` ${notes}` : ""}`]);
        return entries;
      }

      if (action === "award") {
        const sourceId = String(body?.sourceId || ""), quantity = Number(body?.quantity);
        if (!UUID.test(sourceId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 100) throw new Error("INVALID");
        const source = await client.query<{ name: string; points: number }>(
          "select name,points from public.armour_point_sources where id=$1 and active=true", [sourceId]);
        if (!source.rowCount) throw new Error("SOURCE_NOT_FOUND");
        const awarded = Number(source.rows[0].points) * quantity;
        const entry = await client.query(`insert into public.armour_point_ledger
          (personnel_id,entry_type,points_delta,source_label,source_id,quantity,notes,created_by)
          values($1,'award',$2,$3,$4,$5,$6,$7) returning *`,
        [personnelId, awarded, source.rows[0].name, sourceId, quantity, notes || null, auth.userId]);
        await client.query(`insert into public.audit_logs(user_id,target_personnel_id,action,details)
          values($1,$2,'ARMOUR_POINTS_AWARDED',$3)`,
        [auth.userId, personnelId, `${current.name}: +${awarded} points from ${quantity} x ${source.rows[0].name}.${notes ? ` ${notes}` : ""}`]);
        return entry.rows[0];
      }

      if (action === "adjust") {
        if (!(await requirePageAccess(request, "admin.armour-points", "full").catch(() => null))) throw new Error("FULL_REQUIRED");
        const amount = Number(body?.amount);
        if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 10000 || notes.length < 3) throw new Error("INVALID");
        const entry = await client.query(`insert into public.armour_point_ledger
          (personnel_id,entry_type,points_delta,source_label,notes,created_by)
          values($1,'adjustment',$2,'Manual correction',$3,$4) returning *`,
        [personnelId, amount, notes, auth.userId]);
        await client.query(`insert into public.audit_logs(user_id,target_personnel_id,action,details)
          values($1,$2,'ARMOUR_POINTS_ADJUSTED',$3)`,
        [auth.userId, personnelId, `${current.name}: ${amount > 0 ? "+" : ""}${amount} point correction. ${notes}`]);
        return entry.rows[0];
      }
      throw new Error("INVALID");
    });
    return NextResponse.json({ entry: result });
  } catch (error) {
    const code = (error as Error).message;
    if (code === "NOT_FOUND") return fail("Personnel account not found", 404);
    if (code === "ITEM_NOT_FOUND") return fail("Customisation item not found", 404);
    if (code === "SOURCE_NOT_FOUND") return fail("Point source not found", 404);
    if (code === "INSUFFICIENT") return fail("This account does not have enough points", 409);
    if (code === "RANK_REQUIRED") return fail("This personnel profile does not meet the rank requirement for that customisation", 409);
    if (code === "FULL_REQUIRED") return fail("Full permission is required for manual corrections", 403);
    if (code === "INVALID") return fail("Check the selected account, item, quantity, and notes", 400);
    console.error("[armour-points] Write failed", error);
    return fail("Failed to update armour points", 500);
  }
}
