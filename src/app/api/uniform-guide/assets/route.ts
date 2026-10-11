import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { withPostgresTransaction } from "@/lib/postgres/pool";
import { requestHasSameOrigin, requirePageAccess } from "@/lib/route-permissions";

export const runtime = "nodejs";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

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
  const auth = await requirePageAccess(request, "admin.uniform-guide", "edit").catch(() => null);
  if (!auth) return error("Edit Uniform Guide access is required", 403);
  if (Number(request.headers.get("content-length") || 0) > MAX_IMAGE_SIZE + 1024 * 1024) return error("Images must not exceed 5 MB", 413);
  const form = await request.formData().catch(() => null);
  const entryId = String(form?.get("entryId") || "").trim();
  const file = form?.get("file");
  if (!/^[0-9a-f-]{36}$/i.test(entryId) || !(file instanceof File)) return error("Select an entry and image", 400);
  if (!ALLOWED_TYPES.has(file.type) || file.size < 32 || file.size > MAX_IMAGE_SIZE) return error("Use a PNG, JPEG, or WebP image up to 5 MB", 400);
  const contents = Buffer.from(await file.arrayBuffer());
  if (!validSignature(contents, file.type)) return error("The selected file is not a valid image", 400);
  const fileName = file.name.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 180) || "uniform-reference";

  try {
    const assetId = await withPostgresTransaction(async (client) => {
      const entry = await client.query<{ entry_key: string; title: string }>(
        "select entry_key,title from public.uniform_guide_entries where id=$1 for update", [entryId],
      );
      if (!entry.rowCount) throw new Error("NOT_FOUND");
      await client.query(
        `insert into public.uniform_guide_revisions(entry_id,entry_key,action,snapshot,changed_by)
         select id,entry_key,'image-updated',to_jsonb(entries),$2 from public.uniform_guide_entries entries where id=$1`,
        [entryId, auth.userId],
      );
      const asset = await client.query<{ id: string }>(
        `insert into public.uniform_guide_assets(file_name,mime_type,byte_size,sha256,contents,uploaded_by)
         values($1,$2,$3,$4,$5,$6) returning id`,
        [fileName, file.type, contents.length, createHash("sha256").update(contents).digest("hex"), contents, auth.userId],
      );
      await client.query(
        "update public.uniform_guide_entries set image_path=$2,updated_at=now(),updated_by=$3 where id=$1",
        [entryId, `/api/uniform-guide/assets/${asset.rows[0].id}`, auth.userId],
      );
      await client.query(
        "insert into public.audit_logs(user_id,action,details) values($1,'UNIFORM_GUIDE_IMAGE_UPDATED',$2)",
        [auth.userId, `Updated the Uniform Guide image for ${entry.rows[0].title}`],
      );
      return asset.rows[0].id;
    });
    return NextResponse.json({ success: true, imagePath: `/api/uniform-guide/assets/${assetId}` });
  } catch (caught) {
    if (caught instanceof Error && caught.message === "NOT_FOUND") return error("Uniform Guide entry not found", 404);
    console.error("[uniform-guide] Image upload failed", caught);
    return error("Failed to upload the Uniform Guide image", 500);
  }
}
