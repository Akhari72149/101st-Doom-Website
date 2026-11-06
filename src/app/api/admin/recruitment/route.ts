import { NextResponse } from "next/server";
import { getPostgresPool, withPostgresTransaction } from "@/lib/postgres/pool";
import { requestHasSameOrigin, requirePageAccess } from "@/lib/route-permissions";
import { cleanOptions, cleanText, normalizeBlock, RECRUITMENT_STATUSES, type RecruitmentBlock } from "@/lib/recruitment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INPUT_TYPES = ["text", "textarea", "yes_no", "single_choice", "multi_choice"];

export async function GET(request: Request) {
  const auth = await requirePageAccess(request, "admin.recruitment", "read").catch(() => null);
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const [blocks, responses, edit, full] = await Promise.all([
      getPostgresPool().query<RecruitmentBlock>(
        `select id,block_type,field_key,title,description,input_type,options,required,active,sort_order
           from public.recruitment_form_blocks order by sort_order,id`,
      ),
      getPostgresPool().query(
        `select responses.*,coalesce(nullif(users."displayUsername",''),nullif(users.name,''),nullif(users.username,'')) processed_by_name
           from public.recruitment_responses responses
           left join public.app_auth_users users on users.id=responses.processed_by
          order by responses.submitted_at desc limit 500`,
      ),
      requirePageAccess(request, "admin.recruitment", "edit").catch(() => null),
      requirePageAccess(request, "admin.recruitment", "full").catch(() => null),
    ]);
    return NextResponse.json({ blocks: blocks.rows.map(normalizeBlock), responses: responses.rows, canEdit: Boolean(edit), canFull: Boolean(full) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[admin/recruitment] Read failed", error);
    return NextResponse.json({ error: "Unable to load recruitment administration" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!requestHasSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  const auth = await requirePageAccess(request, "admin.recruitment", "edit").catch(() => null);
  if (!auth?.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const id = cleanText(body?.id, 80);
  const status = cleanText(body?.status, 20);
  const notes = cleanText(body?.internalNotes, 5000);
  if (!UUID.test(id) || !RECRUITMENT_STATUSES.includes(status as never)) return NextResponse.json({ error: "Invalid response update" }, { status: 400 });
  try {
    await withPostgresTransaction(async (client) => {
      const current = await client.query<{ nickname: string; status: string }>("select nickname,status from public.recruitment_responses where id=$1 for update", [id]);
      if (!current.rowCount) throw new Error("NOT_FOUND");
      await client.query(
        `update public.recruitment_responses set status=$2,internal_notes=$3,processed_by=$4,
          processed_at=now(),updated_at=now() where id=$1`,
        [id, status, notes, auth.userId],
      );
      await client.query(
        "insert into public.audit_logs(user_id,action,details) values($1,'RECRUITMENT_RESPONSE_UPDATED',$2)",
        [auth.userId, `Updated ${current.rows[0].nickname}'s recruitment response from ${current.rows[0].status} to ${status}.`],
      );
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") return NextResponse.json({ error: "Response not found" }, { status: 404 });
    console.error("[admin/recruitment] Response update failed", error);
    return NextResponse.json({ error: "Unable to update the response" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!requestHasSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  const auth = await requirePageAccess(request, "admin.recruitment", "full").catch(() => null);
  if (!auth?.userId) return NextResponse.json({ error: "Full recruitment access required" }, { status: 403 });
  const body = await request.json().catch(() => null) as { blocks?: unknown } | null;
  if (!Array.isArray(body?.blocks) || body.blocks.length === 0 || body.blocks.length > 80) return NextResponse.json({ error: "Invalid form configuration" }, { status: 400 });

  try {
    const blocks = body.blocks.map((entry, index) => {
      const item = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
      const blockType = item.block_type === "information" ? "information" : "question";
      const id = UUID.test(String(item.id || "")) ? String(item.id) : null;
      const title = cleanText(item.title, 200);
      const fieldKey = blockType === "question" ? cleanText(item.field_key, 80).toLowerCase().replace(/[^a-z0-9_]/g, "") : null;
      const inputType = blockType === "question" && INPUT_TYPES.includes(String(item.input_type)) ? String(item.input_type) : null;
      if (!title || (blockType === "question" && (!fieldKey || !inputType))) throw new Error("INVALID_BLOCK");
      const options = inputType === "yes_no" ? ["Yes", "No"] : cleanOptions(item.options);
      if (["single_choice", "multi_choice"].includes(inputType || "") && options.length < 2) throw new Error("INVALID_OPTIONS");
      return { id, blockType, fieldKey, title, description: cleanText(item.description, 3000), inputType, options, required: blockType === "question" && item.required === true, active: item.active !== false, sortOrder: (index + 1) * 10 };
    });
    const fieldKeys = blocks.map((block) => block.fieldKey).filter(Boolean);
    if (new Set(fieldKeys).size !== fieldKeys.length) return NextResponse.json({ error: "Question field keys must be unique" }, { status: 400 });
    for (const required of ["service_number", "nickname", "discord_name", "platoons"]) {
      if (!fieldKeys.includes(required)) return NextResponse.json({ error: `The ${required} question cannot be removed` }, { status: 400 });
    }

    await withPostgresTransaction(async (client) => {
      const retained: string[] = [];
      for (const block of blocks) {
        const result = block.id
          ? await client.query<{ id: string }>(
              `update public.recruitment_form_blocks set block_type=$2,field_key=$3,title=$4,description=$5,input_type=$6,
                 options=$7::jsonb,required=$8,active=$9,sort_order=$10,updated_by=$11,updated_at=now() where id=$1 returning id`,
              [block.id, block.blockType, block.fieldKey, block.title, block.description, block.inputType, JSON.stringify(block.options), block.required, block.active, block.sortOrder, auth.userId],
            )
          : await client.query<{ id: string }>(
              `insert into public.recruitment_form_blocks(block_type,field_key,title,description,input_type,options,required,active,sort_order,updated_by)
               values($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10) returning id`,
              [block.blockType, block.fieldKey, block.title, block.description, block.inputType, JSON.stringify(block.options), block.required, block.active, block.sortOrder, auth.userId],
            );
        if (!result.rowCount) throw new Error("BLOCK_NOT_FOUND");
        retained.push(result.rows[0].id);
      }
      await client.query("delete from public.recruitment_form_blocks where not (id = any($1::uuid[]))", [retained]);
      await client.query("insert into public.audit_logs(user_id,action,details) values($1,'RECRUITMENT_FORM_UPDATED',$2)", [auth.userId, `Updated the recruitment form (${blocks.length} blocks).`]);
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "INVALID_BLOCK") return NextResponse.json({ error: "Every form block needs a title and every question needs a key and answer type" }, { status: 400 });
    if (message === "INVALID_OPTIONS") return NextResponse.json({ error: "Choice questions need at least two options" }, { status: 400 });
    console.error("[admin/recruitment] Form update failed", error);
    return NextResponse.json({ error: "Unable to save the recruitment form" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!requestHasSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  const auth = await requirePageAccess(request, "admin.recruitment", "full").catch(() => null);
  if (!auth?.userId) return NextResponse.json({ error: "Full recruitment access required" }, { status: 403 });
  const body = await request.json().catch(() => null) as { id?: unknown } | null;
  const id = cleanText(body?.id, 80);
  if (!UUID.test(id)) return NextResponse.json({ error: "Invalid response" }, { status: 400 });
  try {
    await withPostgresTransaction(async (client) => {
      const removed = await client.query<{ nickname: string; service_number: string }>("delete from public.recruitment_responses where id=$1 returning nickname,service_number", [id]);
      if (!removed.rowCount) throw new Error("NOT_FOUND");
      await client.query("insert into public.audit_logs(user_id,action,details) values($1,'RECRUITMENT_RESPONSE_DELETED',$2)", [auth.userId, `Permanently deleted recruitment response for ${removed.rows[0].nickname} (${removed.rows[0].service_number}).`]);
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") return NextResponse.json({ error: "Response not found" }, { status: 404 });
    console.error("[admin/recruitment] Delete failed", error);
    return NextResponse.json({ error: "Unable to delete the response" }, { status: 500 });
  }
}
