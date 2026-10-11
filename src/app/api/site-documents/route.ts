import { NextResponse } from "next/server";
import type { DocumentAlignment, DocumentBlock, DocumentBlockType, DocumentColour, DocumentFont, DocumentRun } from "@/data/siteDocuments";
import { documentFonts } from "@/data/siteDocuments";
import { getPostgresPool, withPostgresTransaction } from "@/lib/postgres/pool";
import { requestHasSameOrigin, requirePageAccess } from "@/lib/route-permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const blockTypes = new Set<DocumentBlockType>(["paragraph", "heading1", "heading2", "heading3", "numbered", "bullet", "divider"]);
const alignments = new Set<DocumentAlignment>(["left", "center", "right"]);
const colours = new Set<DocumentColour>(["default", "green", "cyan", "amber", "red"]);
const fonts = new Set<DocumentFont>(documentFonts);

type DocumentRow = {
  id: string; slug: string; title: string; summary: string; category: string; content: DocumentBlock[];
  source_url: string | null; published: boolean; updated_at: Date; updated_by_name: string | null;
};

function error(message: string, status: number) { return NextResponse.json({ error: message }, { status }); }
function text(value: unknown, maximum: number) { return String(value || "").trim().replace(/\s+/g, " ").slice(0, maximum); }
function webUrl(value: unknown) {
  const candidate = String(value || "").trim();
  if (!candidate) return "";
  try { const url = new URL(candidate); return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : ""; } catch { return ""; }
}

function parseContent(value: unknown): DocumentBlock[] | null {
  if (!Array.isArray(value) || value.length > 600) return null;
  let total = 0;
  const content: DocumentBlock[] = [];
  for (const rawBlock of value) {
    if (!rawBlock || typeof rawBlock !== "object") return null;
    const item = rawBlock as Record<string, unknown>;
    if (!blockTypes.has(item.type as DocumentBlockType) || !alignments.has(item.align as DocumentAlignment)) return null;
    if (!Array.isArray(item.runs) || item.runs.length > 250) return null;
    const runs: DocumentRun[] = [];
    for (const rawRun of item.runs) {
      if (!rawRun || typeof rawRun !== "object") return null;
      const candidate = rawRun as Record<string, unknown>;
      const runText = String(candidate.text ?? "").slice(0, 12000);
      total += runText.length;
      if (total > 250000) return null;
      const href = candidate.href ? webUrl(candidate.href) : "";
      if (candidate.href && !href) return null;
      const font = fonts.has(candidate.font as DocumentFont) ? candidate.font as DocumentFont : undefined;
      const colour = colours.has(candidate.colour as DocumentColour) ? candidate.colour as DocumentColour : undefined;
      const size = Number(candidate.size);
      runs.push({ text: runText, ...(candidate.bold ? { bold: true } : {}), ...(candidate.italic ? { italic: true } : {}),
        ...(candidate.underline ? { underline: true } : {}), ...(font ? { font } : {}),
        ...(Number.isFinite(size) && size >= 8 && size <= 36 ? { size: Math.round(size) } : {}),
        ...(colour ? { colour } : {}), ...(href ? { href } : {}) });
    }
    content.push({ type: item.type as DocumentBlockType, align: item.align as DocumentAlignment,
      level: Math.max(0, Math.min(3, Number(item.level) || 0)),
      ...(Number(item.start) > 0 ? { start: Math.min(999, Math.round(Number(item.start))) } : {}), runs });
  }
  return content;
}

function mapDocument(row: DocumentRow) {
  return { id: row.id, slug: row.slug, title: row.title, summary: row.summary, category: row.category,
    content: row.content, sourceUrl: row.source_url, published: row.published,
    updatedAt: row.updated_at.toISOString(), updatedBy: row.updated_by_name };
}

async function readDocuments(includeAdmin: boolean, slug: string) {
  const params: unknown[] = [];
  const where: string[] = [];
  if (!includeAdmin) where.push("documents.published=true");
  if (slug) { params.push(slug); where.push(`documents.slug=$${params.length}`); }
  const result = await getPostgresPool().query<DocumentRow>(
    `select documents.id,documents.slug,documents.title,documents.summary,documents.category,documents.content,
            documents.source_url,documents.published,documents.updated_at,
            coalesce(actor."displayUsername",actor.name,actor.username) as updated_by_name
       from public.site_documents documents left join public.app_auth_users actor on actor.id=documents.updated_by
      ${where.length ? `where ${where.join(" and ")}` : ""} order by documents.sort_order,documents.title`, params);
  return result.rows.map(mapDocument);
}

async function readRevisions() {
  const result = await getPostgresPool().query<{ id: string; document_slug: string; action: string; changed_at: Date; changed_by_name: string | null; title: string }>(
    `select revisions.id::text,revisions.document_slug,revisions.action,revisions.changed_at,
            coalesce(actor."displayUsername",actor.name,actor.username) as changed_by_name,
            coalesce(revisions.snapshot->>'title',revisions.document_slug) as title
       from public.site_document_revisions revisions left join public.app_auth_users actor on actor.id=revisions.changed_by
      order by revisions.changed_at desc limit 40`);
  return result.rows.map((row) => ({ id: row.id, documentSlug: row.document_slug, title: row.title,
    action: row.action, changedAt: row.changed_at.toISOString(), changedBy: row.changed_by_name }));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const includeAdmin = url.searchParams.get("admin") === "1";
  if (includeAdmin && !(await requirePageAccess(request, "admin.documents", "read").catch(() => null))) return error("Document Library access is required", 403);
  try {
    const documents = await readDocuments(includeAdmin, text(url.searchParams.get("slug"), 120));
    return NextResponse.json({ documents, ...(includeAdmin ? { revisions: await readRevisions() } : {}) });
  } catch (caught) { console.error("[site-documents] Read failed", caught); return error("Failed to load documents", 500); }
}

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return error("Invalid request origin", 403);
  const auth = await requirePageAccess(request, "admin.documents", "edit").catch(() => null);
  if (!auth) return error("Edit Document Library access is required", 403);
  const full = Boolean(await requirePageAccess(request, "admin.documents", "full").catch(() => null));
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const action = text(body?.action, 30);
  try {
    await withPostgresTransaction(async (client) => {
      if (action === "create" || action === "update") {
        if (action === "create" && !full) throw new Error("FULL_REQUIRED");
        const id = text(body?.id, 80);
        const title = text(body?.title, 180);
        const summary = String(body?.summary || "").trim().slice(0, 1200);
        const category = text(body?.category, 80) || "General";
        const content = parseContent(body?.content);
        const suppliedSource = body?.sourceUrl;
        const sourceUrl = suppliedSource ? webUrl(suppliedSource) : "";
        if (!title || !content || !content.length || (suppliedSource && !sourceUrl)) throw new Error("INVALID");
        if (action === "create") {
          const slug = text(body?.slug, 120).toLowerCase();
          if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("INVALID_SLUG");
          const published = full && body?.published === true;
          const created = await client.query<{ id: string }>(
            `insert into public.site_documents(slug,title,summary,category,content,source_url,published,updated_by)
             values($1,$2,$3,$4,$5::jsonb,$6,$7,$8) returning id`,
            [slug,title,summary,category,JSON.stringify(content),sourceUrl || null,published,auth.userId]);
          await client.query(`insert into public.site_document_revisions(document_id,document_slug,action,snapshot,changed_by)
            select id,slug,'created',to_jsonb(documents),$2 from public.site_documents documents where id=$1`, [created.rows[0].id,auth.userId]);
          await client.query("insert into public.audit_logs(user_id,action,details) values($1,'DOCUMENT_CREATED',$2)", [auth.userId,`Created website document: ${title}`]);
          return;
        }
        const existing = await client.query<{ published: boolean }>("select published from public.site_documents where id=$1 for update", [id]);
        if (!existing.rowCount) throw new Error("NOT_FOUND");
        const published = full ? body?.published === true : existing.rows[0].published;
        await client.query(`insert into public.site_document_revisions(document_id,document_slug,action,snapshot,changed_by)
          select id,slug,'updated',to_jsonb(documents),$2 from public.site_documents documents where id=$1`, [id,auth.userId]);
        await client.query(`update public.site_documents set title=$2,summary=$3,category=$4,content=$5::jsonb,source_url=$6,published=$7,updated_at=now(),updated_by=$8 where id=$1`,
          [id,title,summary,category,JSON.stringify(content),sourceUrl || null,published,auth.userId]);
        await client.query("insert into public.audit_logs(user_id,action,details) values($1,'DOCUMENT_UPDATED',$2)", [auth.userId,`Updated website document: ${title}`]);
        return;
      }
      if (action === "delete") {
        if (!full) throw new Error("FULL_REQUIRED");
        const id = text(body?.id, 80);
        const existing = await client.query<{ slug: string; title: string }>("select slug,title from public.site_documents where id=$1 for update", [id]);
        if (!existing.rowCount) throw new Error("NOT_FOUND");
        await client.query(`insert into public.site_document_revisions(document_id,document_slug,action,snapshot,changed_by)
          select id,slug,'deleted',to_jsonb(documents),$2 from public.site_documents documents where id=$1`, [id,auth.userId]);
        await client.query("delete from public.site_documents where id=$1", [id]);
        await client.query("insert into public.audit_logs(user_id,action,details) values($1,'DOCUMENT_DELETED',$2)", [auth.userId,`Deleted website document: ${existing.rows[0].title}`]);
        return;
      }
      throw new Error("INVALID_ACTION");
    });
    return NextResponse.json({ success: true, documents: await readDocuments(true, ""), revisions: await readRevisions() });
  } catch (caught) {
    const code = caught instanceof Error ? caught.message : "";
    if (["INVALID","INVALID_SLUG","INVALID_ACTION"].includes(code)) return error("The document content is invalid", 400);
    if (code === "NOT_FOUND") return error("Document not found", 404);
    if (code === "FULL_REQUIRED") return error("Full Document Library access is required", 403);
    if ((caught as { code?: string })?.code === "23505") return error("That document address is already in use", 409);
    console.error("[site-documents] Write failed", caught); return error("Failed to update the document", 500);
  }
}
