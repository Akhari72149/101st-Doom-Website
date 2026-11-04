import { NextResponse } from "next/server";
import { getPostgresPool, withPostgresTransaction } from "@/lib/postgres/pool";
import { requestHasSameOrigin, requirePageAccess } from "@/lib/route-permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonError(error: string, status = 400) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function workshopLink(value: unknown) {
  const input = cleanText(value, 500);
  try {
    const url = new URL(input);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const workshopId = url.searchParams.get("id") || "";
    if (url.protocol !== "https:" || host !== "steamcommunity.com" || url.pathname !== "/sharedfiles/filedetails/" || !/^\d{1,20}$/.test(workshopId)) return null;
    return { workshopId, url: `https://steamcommunity.com/sharedfiles/filedetails/?id=${workshopId}` };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const [requests, canManage] = await Promise.all([
      getPostgresPool().query(
        `select requests.id,requests.unit_name,requests.map_url,requests.workshop_id,requests.entry_type,
                requests.added_to_server,requests.requested_at,requests.added_at,requests.pre_approved_at,
                coalesce(nullif(btrim(users."displayUsername"),''),nullif(btrim(users.name),''),nullif(btrim(users.username),'')) added_by_name,
                coalesce(nullif(btrim(approvers."displayUsername"),''),nullif(btrim(approvers.name),''),nullif(btrim(approvers.username),'')) pre_approved_by_name
           from public.map_requests requests
           left join public.app_auth_users users on users.id=requests.added_by
           left join public.app_auth_users approvers on approvers.id=requests.pre_approved_by
          order by requests.entry_type,requests.added_to_server,requests.requested_at desc`,
      ),
      requirePageAccess(request, "admin.map-requests", "edit").catch(() => null),
    ]);
    return NextResponse.json({ requests: requests.rows, canManage: Boolean(canManage) }, { headers: { "Cache-Control": "no-store" } });
  } catch (caught) {
    console.error("[map-requests] Read failed", caught);
    return jsonError("Unable to load map requests", 500);
  }
}

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const entryType = body?.entryType === "pre_approved" ? "pre_approved" : "request";
  const unitName = cleanText(body?.unitName, 120);
  const link = workshopLink(body?.mapUrl);
  if (!link) return jsonError("Enter a valid Steam Workshop map link");

  if (entryType === "pre_approved") {
    const auth = await requirePageAccess(request, "admin.map-requests", "edit").catch(() => null);
    if (!auth?.userId) return jsonError("Map Request Management permission required", 403);
    try {
      const inserted = await withPostgresTransaction(async (client) => {
        const result = await client.query(
          `insert into public.map_requests
             (unit_name,map_url,workshop_id,acknowledgement_accepted,entry_type,pre_approved_at,pre_approved_by)
           values('Pre-approved map',$1,$2,true,'pre_approved',now(),$3::uuid)
           returning id,unit_name,map_url,workshop_id,entry_type,added_to_server,requested_at,added_at,pre_approved_at`,
          [link.url, link.workshopId, auth.userId],
        );
        await client.query(
          "insert into public.audit_logs(user_id,action,details) values($1,'MAP_PREAPPROVED_ADDED',$2)",
          [auth.userId, `Added Workshop map ${link.workshopId} to the pre-approved register.`],
        );
        return result.rows[0];
      });
      return NextResponse.json({ ok: true, request: inserted }, { status: 201 });
    } catch (caught) {
      if ((caught as { code?: string })?.code === "23505") return jsonError("That Workshop map is already on the tracker", 409);
      console.error("[map-requests] Pre-approved map creation failed", caught);
      return jsonError("Unable to add the pre-approved map", 500);
    }
  }

  if (!unitName) return jsonError("Enter your unit name");
  if (body?.accepted !== true) return jsonError("Accept the map request acknowledgement before submitting");

  try {
    const inserted = await getPostgresPool().query(
      `insert into public.map_requests(unit_name,map_url,workshop_id,acknowledgement_accepted,entry_type)
       values($1,$2,$3,true,'request') returning id,unit_name,map_url,workshop_id,entry_type,added_to_server,requested_at,added_at`,
      [unitName, link.url, link.workshopId],
    );
    return NextResponse.json({ ok: true, request: inserted.rows[0] }, { status: 201 });
  } catch (caught) {
    if ((caught as { code?: string })?.code === "23505") return jsonError("That Workshop map is already on the request tracker", 409);
    console.error("[map-requests] Submission failed", caught);
    return jsonError("Unable to submit the map request", 500);
  }
}

export async function PATCH(request: Request) {
  if (!requestHasSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const auth = await requirePageAccess(request, "admin.map-requests", "edit").catch(() => null);
  if (!auth?.userId) return jsonError("Map Request Management permission required", 403);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const id = cleanText(body?.id, 80);
  const addedToServer = body?.addedToServer;
  if (!UUID_PATTERN.test(id) || typeof addedToServer !== "boolean") return jsonError("Invalid map request update");

  try {
    const changed = await withPostgresTransaction(async (client) => {
      const existing = await client.query<{ unit_name: string; workshop_id: string; added_to_server: boolean }>(
        "select unit_name,workshop_id,added_to_server from public.map_requests where id=$1 and entry_type='request' for update",
        [id],
      );
      if (!existing.rowCount) throw new Error("NOT_FOUND");
      const updated = await client.query(
        `update public.map_requests
            set added_to_server=$2,added_at=case when $2 then now() else null end,
                added_by=case when $2 then $3::uuid else null end,updated_at=now()
          where id=$1 returning id,unit_name,map_url,workshop_id,added_to_server,requested_at,added_at`,
        [id, addedToServer, auth.userId],
      );
      await client.query(
        "insert into public.audit_logs(user_id,action,details) values($1,$2,$3)",
        [auth.userId, addedToServer ? "MAP_REQUEST_ADDED_TO_SERVER" : "MAP_REQUEST_REMOVED_FROM_SERVER", `${addedToServer ? "Marked" : "Unmarked"} Workshop map ${existing.rows[0].workshop_id} requested by ${existing.rows[0].unit_name} as on the server.`],
      );
      return updated.rows[0];
    });
    return NextResponse.json({ ok: true, request: changed });
  } catch (caught) {
    if (caught instanceof Error && caught.message === "NOT_FOUND") return jsonError("Map request not found", 404);
    console.error("[map-requests] Update failed", caught);
    return jsonError("Unable to update the map request", 500);
  }
}

export async function DELETE(request: Request) {
  if (!requestHasSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const auth = await requirePageAccess(request, "admin.map-requests", "edit").catch(() => null);
  if (!auth?.userId) return jsonError("Map Request Management permission required", 403);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const id = cleanText(body?.id, 80);
  if (!UUID_PATTERN.test(id)) return jsonError("Invalid pre-approved map");

  try {
    await withPostgresTransaction(async (client) => {
      const removed = await client.query<{ workshop_id: string }>(
        "delete from public.map_requests where id=$1 and entry_type='pre_approved' returning workshop_id",
        [id],
      );
      if (!removed.rowCount) throw new Error("NOT_FOUND");
      await client.query(
        "insert into public.audit_logs(user_id,action,details) values($1,'MAP_PREAPPROVED_REMOVED',$2)",
        [auth.userId, `Removed Workshop map ${removed.rows[0].workshop_id} from the pre-approved register.`],
      );
    });
    return NextResponse.json({ ok: true });
  } catch (caught) {
    if (caught instanceof Error && caught.message === "NOT_FOUND") return jsonError("Pre-approved map not found", 404);
    console.error("[map-requests] Pre-approved map removal failed", caught);
    return jsonError("Unable to remove the pre-approved map", 500);
  }
}
