import { NextResponse } from "next/server";
import { getPostgresPool, withPostgresTransaction } from "@/lib/postgres/pool";
import { requestHasSameOrigin, requirePageAccess } from "@/lib/route-permissions";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function backend() {
  return process.env.ADMIN_PERSONNEL_DATABASE_BACKEND || "supabase";
}

export async function GET(request: Request) {
  const auth = await requirePageAccess(request, "admin.certifications", "read");
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const personId = new URL(request.url).searchParams.get("personId") || "";

  try {
    if (backend() === "postgres") {
      if (personId) {
        const result = await getPostgresPool().query(
          `select pc.id, pc.personnel_id, c.id certification_id, c.name,
             c.lead_personnel_id, lead.name lead_name
           from public.personnel_certifications pc
           join public.certifications c on c.id = pc.certification_id
           left join public.personnel lead on lead.id = c.lead_personnel_id
           where pc.personnel_id = $1
           order by c.name`,
          [personId],
        );
        return NextResponse.json({
          personCerts: result.rows.map((row) => ({
            id: row.id,
            personnel_id: row.personnel_id,
            certification: {
              id: row.certification_id,
              name: row.name,
              lead_personnel_id: row.lead_personnel_id,
              lead_name: row.lead_name,
            },
          })),
        });
      }

      const [personnel, ranks, certifications, trainers] = await Promise.all([
        getPostgresPool().query(
          "select id,name,rank_id,status,slotted_position from public.personnel order by name",
        ),
        getPostgresPool().query(
          "select id,name,rank_level from public.ranks order by rank_level",
        ),
        getPostgresPool().query(
          `select c.id, c.name, c.is_trainer_cert, c.lead_personnel_id,
             lead.name lead_name, lead.rank_id lead_rank_id
           from public.certifications c
           left join public.personnel lead on lead.id = c.lead_personnel_id
           order by c.name`,
        ),
        getPostgresPool().query(
          `select distinct p.id,p.name,p.rank_id
           from public.personnel p
           join public.personnel_certifications pc on pc.personnel_id=p.id
           join public.certifications c on c.id=pc.certification_id
           where c.is_trainer_cert=true order by p.name`,
        ),
      ]);

      return NextResponse.json({
        personnel: personnel.rows,
        ranks: ranks.rows,
        certifications: certifications.rows,
        trainers: trainers.rows,
        currentUserId: auth.userId,
        currentUserName: auth.email || "Unknown",
      });
    }

    const [personnel, ranks, certifications] = await Promise.all([
      supabaseAdmin.from("personnel").select("id,name,rank_id,status,slotted_position").order("name"),
      supabaseAdmin.from("ranks").select("id,name,rank_level").order("rank_level"),
      supabaseAdmin.from("certifications").select("id,name,is_trainer_cert").order("name"),
    ]);
    if (personId) {
      const { data, error } = await supabaseAdmin
        .from("personnel_certifications")
        .select("id,personnel_id,certification:certification_id(id,name)")
        .eq("personnel_id", personId);
      if (error) throw error;
      return NextResponse.json({ personCerts: data || [] });
    }

    const trainerIds = (certifications.data || [])
      .filter((row) => row.is_trainer_cert)
      .map((row) => row.id);
    const { data: rows } = await supabaseAdmin
      .from("personnel_certifications")
      .select("personnel:personnel_id(id,name,rank_id)")
      .in("certification_id", trainerIds);
    const trainerRows = (rows || []) as unknown as Array<{
      personnel: { id: string; name: string; rank_id: string | null } | null;
    }>;
    const trainers = [
      ...new Map(trainerRows.map((row) => [row.personnel?.id, row.personnel])).values(),
    ].filter(Boolean);
    return NextResponse.json({
      personnel: personnel.data || [],
      ranks: ranks.data || [],
      certifications: certifications.data || [],
      trainers,
      currentUserId: auth.userId,
      currentUserName: auth.email || "Unknown",
    });
  } catch (error) {
    console.error("[admin-certs] Read failed", error);
    return NextResponse.json({ error: "Failed to load certifications" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!requestHasSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }
  const auth = await requirePageAccess(request, "admin.certifications", "edit");
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as {
    certificationId?: unknown;
    leadPersonnelId?: unknown;
  } | null;
  const certificationId = String(body?.certificationId || "");
  const leadPersonnelId = String(body?.leadPersonnelId || "");
  if (!UUID.test(certificationId) || !UUID.test(leadPersonnelId)) {
    return NextResponse.json({ error: "Invalid certification lead assignment" }, { status: 400 });
  }
  if (backend() !== "postgres") {
    return NextResponse.json(
      { error: "Certification leads require the native PostgreSQL backend" },
      { status: 409 },
    );
  }

  try {
    const result = await withPostgresTransaction(async (client) => {
      const person = await client.query<{ name: string; status: string | null }>(
        "select name,status from public.personnel where id=$1 for update",
        [leadPersonnelId],
      );
      const certification = await client.query<{ name: string }>(
        "select name from public.certifications where id=$1 for update",
        [certificationId],
      );
      if (!person.rowCount || !certification.rowCount) throw new Error("NOT_FOUND");

      const status = String(person.rows[0].status || "").trim().toLowerCase();
      if (["removed", "retired", "transferred"].includes(status)) throw new Error("INACTIVE");

      await client.query(
        "update public.certifications set lead_personnel_id=$2 where id=$1",
        [certificationId, leadPersonnelId],
      );
      await client.query(
        `insert into public.audit_logs(user_id,target_personnel_id,action,details)
         values($1,$2,'CERTIFICATION_LEAD_UPDATED',$3)`,
        [
          auth.userId,
          leadPersonnelId,
          `Assigned ${person.rows[0].name} as lead for ${certification.rows[0].name}.`,
        ],
      );
      return { certificationId, leadPersonnelId, leadName: person.rows[0].name };
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return NextResponse.json({ error: "Certification or personnel record not found" }, { status: 404 });
    }
    if (error instanceof Error && error.message === "INACTIVE") {
      return NextResponse.json({ error: "Certification leads must be active personnel" }, { status: 400 });
    }
    console.error("[admin-certs] Lead update failed", error);
    return NextResponse.json({ error: "Failed to update certification lead" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }
  if (!(await requirePageAccess(request, "admin.certifications", "edit"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    personnelIds?: unknown;
    certificationIds?: unknown;
    awardedBy?: unknown;
  } | null;
  const people = Array.isArray(body?.personnelIds) ? [...new Set(body.personnelIds.map(String))] : [];
  const certifications = Array.isArray(body?.certificationIds)
    ? [...new Set(body.certificationIds.map(String))]
    : [];
  const trainer = String(body?.awardedBy || "");
  if (
    !people.length || !certifications.length || people.length * certifications.length > 200 ||
    [...people, ...certifications, trainer].some((value) => !UUID.test(value))
  ) {
    return NextResponse.json({ error: "Invalid certification assignment" }, { status: 400 });
  }

  try {
    if (backend() === "postgres") {
      await withPostgresTransaction(async (client) => {
        for (const personId of people) {
          for (const certificationId of certifications) {
            await client.query(
              `insert into public.personnel_certifications(personnel_id,certification_id,awarded_at,awarded_by)
               values($1,$2,now(),$3) on conflict do nothing`,
              [personId, certificationId, trainer],
            );
          }
        }
      });
    } else {
      const rows = people.flatMap((personnelId) => certifications.map((certificationId) => ({
        personnel_id: personnelId,
        certification_id: certificationId,
        awarded_at: new Date().toISOString(),
        awarded_by: trainer,
      })));
      const { error } = await supabaseAdmin
        .from("personnel_certifications")
        .upsert(rows, { ignoreDuplicates: true });
      if (error) throw error;
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin-certs] Assign failed", error);
    return NextResponse.json({ error: "Failed to assign certifications" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!requestHasSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }
  if (!(await requirePageAccess(request, "admin.certifications", "edit"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = new URL(request.url).searchParams.get("id") || "";
  if (!UUID.test(id)) {
    return NextResponse.json({ error: "Invalid certification record" }, { status: 400 });
  }
  try {
    if (backend() === "postgres") {
      await getPostgresPool().query("delete from public.personnel_certifications where id=$1", [id]);
    } else {
      const { error } = await supabaseAdmin.from("personnel_certifications").delete().eq("id", id);
      if (error) throw error;
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin-certs] Revoke failed", error);
    return NextResponse.json({ error: "Failed to revoke certification" }, { status: 500 });
  }
}
