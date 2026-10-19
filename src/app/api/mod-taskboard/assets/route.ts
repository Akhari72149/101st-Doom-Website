import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { withPostgresTransaction } from "@/lib/postgres/pool";
import { requestHasSameOrigin, requirePageAccess } from "@/lib/route-permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function validSignature(contents: Buffer, mimeType: string) {
  if (mimeType === "image/png") return contents.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimeType === "image/jpeg") return contents[0] === 0xff && contents[1] === 0xd8 && contents[contents.length - 2] === 0xff && contents[contents.length - 1] === 0xd9;
  return mimeType === "image/webp" && contents.subarray(0, 4).toString("ascii") === "RIFF" && contents.subarray(8, 12).toString("ascii") === "WEBP";
}

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return error("Invalid request origin", 403);
  const auth = await requirePageAccess(request, "admin.mod-taskboard", "read").catch(() => null);
  if (!auth?.userId) return error("Mod Pipeline access is required", 403);
  if (Number(request.headers.get("content-length") || 0) > MAX_IMAGE_SIZE + 1024 * 1024) return error("Images must not exceed 5 MB", 413);
  const form = await request.formData().catch(() => null);
  const taskId = String(form?.get("taskId") || "").trim();
  const caption = String(form?.get("caption") || "").trim().slice(0, 300) || null;
  const file = form?.get("file");
  if (!UUID.test(taskId) || !(file instanceof File)) return error("Select a task and image", 400);
  if (!ALLOWED_TYPES.has(file.type) || file.size < 32 || file.size > MAX_IMAGE_SIZE) return error("Use a PNG, JPEG, or WebP image up to 5 MB", 400);
  const contents = Buffer.from(await file.arrayBuffer());
  if (!validSignature(contents, file.type)) return error("The selected file is not a valid image", 400);
  const fileName = file.name.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 180) || "pipeline-image";

  try {
    const asset = await withPostgresTransaction(async (client) => {
      const task = await client.query<{ reference_number: number }>("select reference_number from public.mod_pipeline_tasks where id=$1", [taskId]);
      if (!task.rowCount) throw new Error("NOT_FOUND");
      const count = await client.query<{ count: number }>("select count(*)::int count from public.mod_pipeline_assets where task_id=$1", [taskId]);
      if (count.rows[0].count >= 12) throw new Error("LIMIT");
      const inserted = await client.query<{ id: string }>(
        `insert into public.mod_pipeline_assets(task_id,file_name,mime_type,byte_size,sha256,contents,caption,uploaded_by)
         values($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
        [taskId, fileName, file.type, contents.length, createHash("sha256").update(contents).digest("hex"), contents, caption, auth.userId],
      );
      await client.query(
        `insert into public.mod_pipeline_events(task_id,actor_id,event_type,summary,new_values)
         values($1,$2,'image_uploaded',$3,$4::jsonb)`,
        [taskId, auth.userId, `Uploaded image: ${fileName}`, JSON.stringify({ asset_id: inserted.rows[0].id, file_name: fileName, caption })],
      );
      return inserted.rows[0];
    });
    return NextResponse.json({ ok: true, asset }, { status: 201 });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "";
    if (message === "NOT_FOUND") return error("Task not found", 404);
    if (message === "LIMIT") return error("A task can contain up to 12 images", 409);
    console.error("[mod-taskboard] Image upload failed", caught);
    return error("Failed to upload task image", 500);
  }
}

export async function DELETE(request: Request) {
  if (!requestHasSameOrigin(request)) return error("Invalid request origin", 403);
  const auth = await requirePageAccess(request, "admin.mod-taskboard", "read").catch(() => null);
  if (!auth?.userId) return error("Mod Pipeline access is required", 403);
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!UUID.test(id)) return error("Invalid image", 400);
  try {
    const removed = await withPostgresTransaction(async (client) => {
      const result = await client.query<{ task_id: string; file_name: string }>(
        "delete from public.mod_pipeline_assets where id=$1 returning task_id,file_name", [id],
      );
      if (!result.rowCount) throw new Error("NOT_FOUND");
      await client.query(
        `insert into public.mod_pipeline_events(task_id,actor_id,event_type,summary,old_values)
         values($1,$2,'image_removed',$3,$4::jsonb)`,
        [result.rows[0].task_id, auth.userId, `Removed image: ${result.rows[0].file_name}`, JSON.stringify({ asset_id: id, file_name: result.rows[0].file_name })],
      );
      return result.rows[0];
    });
    return NextResponse.json({ ok: true, removed });
  } catch (caught) {
    if (caught instanceof Error && caught.message === "NOT_FOUND") return error("Image not found", 404);
    console.error("[mod-taskboard] Image removal failed", caught);
    return error("Failed to remove task image", 500);
  }
}
