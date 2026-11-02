import { NextResponse } from "next/server";
import { getPostgresPool, withPostgresTransaction } from "@/lib/postgres/pool";
import { requestHasSameOrigin, requirePageAccess } from "@/lib/route-permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PERMISSION = "admin.certification-catalogue";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DISCORD_ROLE = /^\d{16,22}$/;

function text(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

function readDefinition(body: Record<string, unknown> | null) {
  const name = text(body?.name, 160);
  const discordRoleId = text(body?.discordRoleId, 22);
  if (!name || !DISCORD_ROLE.test(discordRoleId)) return null;
  return { name, discordRoleId };
}

export async function GET(request: Request) {
  if (!(await requirePageAccess(request, PERMISSION, "read"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const result = await getPostgresPool().query(
      `select c.id,c.name,c.cert_id discord_role_id,c.is_active,c.is_trainer_cert,
         c.lead_personnel_id,lead.name lead_name,count(pc.id)::int holder_count
       from public.certifications c
       left join public.personnel lead on lead.id=c.lead_personnel_id
       left join public.personnel_certifications pc on pc.certification_id=c.id
       group by c.id,lead.id
       order by c.is_active desc,lower(c.name)`,
    );
    return NextResponse.json({ certifications: result.rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[certification-catalogue] Read failed", error);
    return NextResponse.json({ error: "Failed to load the certification catalogue" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  const auth = await requirePageAccess(request, PERMISSION, "edit");
  if (!auth) return NextResponse.json({ error: "Edit Certification Catalogue access is required" }, { status: 403 });
  const definition = readDefinition(await request.json().catch(() => null));
  if (!definition) return NextResponse.json({ error: "Enter a name and a valid Discord role ID" }, { status: 400 });
  try {
    const result = await withPostgresTransaction(async (client) => {
      const duplicate = await client.query(
        "select 1 from public.certifications where lower(name)=lower($1) or cert_id=$2 limit 1",
        [definition.name, definition.discordRoleId],
      );
      if (duplicate.rowCount) throw new Error("DUPLICATE");
      const inserted = await client.query(
        `insert into public.certifications(name,cert_id,is_trainer_cert,is_active)
         values($1,$2,false,true) returning id,name,cert_id discord_role_id,is_active,is_trainer_cert`,
        [definition.name, definition.discordRoleId],
      );
      await client.query(
        "insert into public.audit_logs(user_id,action,details) values($1,'CERTIFICATION_DEFINITION_CREATED',$2)",
        [auth.userId, `Created certification ${definition.name} with Discord role ${definition.discordRoleId}.`],
      );
      return inserted.rows[0];
    });
    return NextResponse.json({ ok: true, certification: result }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "DUPLICATE") {
      return NextResponse.json({ error: "That certification name or Discord role is already in use" }, { status: 409 });
    }
    console.error("[certification-catalogue] Create failed", error);
    return NextResponse.json({ error: "Failed to create certification" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!requestHasSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  const auth = await requirePageAccess(request, PERMISSION, "edit");
  if (!auth) return NextResponse.json({ error: "Edit Certification Catalogue access is required" }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const id = text(body?.id, 50);
  const definition = readDefinition(body);
  const isActive = body?.isActive === true;
  if (!UUID.test(id) || !definition) return NextResponse.json({ error: "Review the certification fields" }, { status: 400 });
  try {
    const result = await withPostgresTransaction(async (client) => {
      const existing = await client.query<{ name: string; cert_id: string; is_active: boolean }>(
        "select name,cert_id,is_active from public.certifications where id=$1 for update",
        [id],
      );
      if (!existing.rowCount) throw new Error("NOT_FOUND");
      const duplicate = await client.query(
        "select 1 from public.certifications where id<>$1 and (lower(name)=lower($2) or cert_id=$3) limit 1",
        [id, definition.name, definition.discordRoleId],
      );
      if (duplicate.rowCount) throw new Error("DUPLICATE");
      const updated = await client.query(
        `update public.certifications set name=$2,cert_id=$3,is_active=$4
         where id=$1 returning id,name,cert_id discord_role_id,is_active,is_trainer_cert`,
        [id, definition.name, definition.discordRoleId, isActive],
      );
      const before = existing.rows[0];
      await client.query(
        "insert into public.audit_logs(user_id,action,details) values($1,'CERTIFICATION_DEFINITION_UPDATED',$2)",
        [auth.userId, `Updated certification ${before.name}: name ${before.name} -> ${definition.name}; Discord role ${before.cert_id} -> ${definition.discordRoleId}; active ${before.is_active} -> ${isActive}.`],
      );
      return updated.rows[0];
    });
    return NextResponse.json({ ok: true, certification: result });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") return NextResponse.json({ error: "Certification not found" }, { status: 404 });
    if (error instanceof Error && error.message === "DUPLICATE") return NextResponse.json({ error: "That certification name or Discord role is already in use" }, { status: 409 });
    console.error("[certification-catalogue] Update failed", error);
    return NextResponse.json({ error: "Failed to update certification" }, { status: 500 });
  }
}
