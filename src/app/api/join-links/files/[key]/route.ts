import { NextResponse } from "next/server";
import { isJoinModlistKey } from "@/data/joinPageLinks";
import { readJoinModlist } from "@/lib/join-modlist-files";
import { getPostgresPool } from "@/lib/postgres/pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeDownloadName(value: string | null, key: string) {
  const fallback = key === "main-operations" ? "101st-MainOp-Modlist.html" : "101st-FunOp-Modlist.html";
  const cleaned = String(value || fallback).replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 180);
  return /\.html?$/i.test(cleaned) ? cleaned : fallback;
}

export async function GET(_request: Request, context: { params: Promise<{ key: string }> }) {
  const { key } = await context.params;
  if (!isJoinModlistKey(key)) return NextResponse.json({ error: "Modlist not found" }, { status: 404 });

  try {
    const result = await getPostgresPool().query<{ file_name: string | null; file_sha256: string | null }>(
      "select file_name, file_sha256 from public.join_page_links where link_key = $1",
      [key],
    );
    if (!result.rows[0]?.file_sha256) return NextResponse.json({ error: "No modlist has been uploaded" }, { status: 404 });
    const contents = await readJoinModlist(key);
    const filename = safeDownloadName(result.rows[0].file_name, key);
    return new NextResponse(contents, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(contents.length),
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Security-Policy": "sandbox; default-src 'none'",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (caught) {
    console.error("[join-links] Download failed", caught);
    return NextResponse.json({ error: "The uploaded modlist is unavailable" }, { status: 404 });
  }
}
