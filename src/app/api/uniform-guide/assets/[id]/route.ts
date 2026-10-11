import { NextResponse } from "next/server";
import { getPostgresPool } from "@/lib/postgres/pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Image not found" }, { status: 404 });
  try {
    const result = await getPostgresPool().query<{
      file_name: string;
      mime_type: string;
      contents: Buffer;
      sha256: string;
    }>("select file_name,mime_type,contents,sha256 from public.uniform_guide_assets where id=$1", [id]);
    const asset = result.rows[0];
    if (!asset) return NextResponse.json({ error: "Image not found" }, { status: 404 });
    return new NextResponse(new Uint8Array(asset.contents), {
      headers: {
        "Content-Type": asset.mime_type,
        "Content-Length": String(asset.contents.length),
        "Cache-Control": "public, max-age=31536000, immutable",
        ETag: `"${asset.sha256}"`,
        "Content-Disposition": `inline; filename="${asset.file_name.replace(/["\\]/g, "_")}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (caught) {
    console.error("[uniform-guide] Image read failed", caught);
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }
}
