import { NextResponse } from "next/server";
import { getPostgresPool } from "@/lib/postgres/pool";
import { requirePageAccess } from "@/lib/route-permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requirePageAccess(request, "admin.mod-taskboard", "read").catch(() => null);
  if (!auth) return NextResponse.json({ error: "Image not found" }, { status: 404 });
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Image not found" }, { status: 404 });
  try {
    const result = await getPostgresPool().query<{ file_name: string; mime_type: string; contents: Buffer; sha256: string }>(
      "select file_name,mime_type,contents,sha256 from public.mod_pipeline_assets where id=$1", [id],
    );
    const asset = result.rows[0];
    if (!asset) return NextResponse.json({ error: "Image not found" }, { status: 404 });
    return new NextResponse(new Uint8Array(asset.contents), {
      headers: {
        "Content-Type": asset.mime_type,
        "Content-Length": String(asset.contents.length),
        "Cache-Control": "private, max-age=3600",
        ETag: `"${asset.sha256}"`,
        "Content-Disposition": `inline; filename="${asset.file_name.replace(/["\\]/g, "_")}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (caught) {
    console.error("[mod-taskboard] Image read failed", caught);
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }
}
