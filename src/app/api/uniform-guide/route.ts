import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { UniformGuideCategory, UniformGuideLink } from "@/data/uniformGuide";
import { getPostgresPool, withPostgresTransaction } from "@/lib/postgres/pool";
import { requestHasSameOrigin, requirePageAccess } from "@/lib/route-permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SectionRow = {
  section_key: string;
  label: string;
  description: string;
  sort_order: number;
  published: boolean;
};

type EntryRow = {
  id: string;
  entry_key: string;
  section_key: string;
  title: string;
  subtitle: string;
  summary: string;
  categories: UniformGuideCategory[];
  notes: string[];
  links: UniformGuideLink[];
  image_path: string | null;
  sort_order: number;
  published: boolean;
  updated_at: Date;
  updated_by_name: string | null;
};

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function webUrl(value: unknown) {
  const candidate = String(value || "").trim();
  if (!candidate) return "";
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : "";
  } catch {
    return "";
  }
}

function cleanText(value: unknown, maximum: number) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, maximum);
}

function parseCategories(value: unknown): UniformGuideCategory[] | null {
  if (!Array.isArray(value) || value.length > 16) return null;
  const categories: UniformGuideCategory[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") return null;
    const label = cleanText((raw as { label?: unknown }).label, 80);
    const rawItems = (raw as { items?: unknown }).items;
    if (!label || !Array.isArray(rawItems) || rawItems.length > 120) return null;
    const items = rawItems.map((item) => {
      if (!item || typeof item !== "object") return null;
      const text = cleanText((item as { text?: unknown }).text, 500);
      const suppliedUrl = (item as { url?: unknown }).url;
      const url = suppliedUrl ? webUrl(suppliedUrl) : "";
      if (!text || (suppliedUrl && !url)) return null;
      return { text, ...(url ? { url } : {}) };
    });
    if (items.some((item) => !item)) return null;
    categories.push({ label, items: items as UniformGuideCategory["items"] });
  }
  return categories;
}

function parseStringList(value: unknown, maximumItems: number, maximumLength: number) {
  if (!Array.isArray(value) || value.length > maximumItems) return null;
  const values = value.map((item) => cleanText(item, maximumLength)).filter(Boolean);
  return values.length === value.length ? values : null;
}

function parseLinks(value: unknown): UniformGuideLink[] | null {
  if (!Array.isArray(value) || value.length > 20) return null;
  const links = value.map((item) => {
    if (!item || typeof item !== "object") return null;
    const text = cleanText((item as { text?: unknown }).text, 120);
    const url = webUrl((item as { url?: unknown }).url);
    return text && url ? { text, url } : null;
  });
  return links.some((item) => !item) ? null : links as UniformGuideLink[];
}

async function readGuide(includeAdmin: boolean) {
  const sectionWhere = includeAdmin ? "" : "where published = true";
  const entryWhere = includeAdmin ? "" : "where entries.published = true";
  const [sectionResult, entryResult] = await Promise.all([
    getPostgresPool().query<SectionRow>(
      `select section_key, label, description, sort_order, published
         from public.uniform_guide_sections ${sectionWhere}
        order by sort_order, label`,
    ),
    getPostgresPool().query<EntryRow>(
      `select entries.id, entries.entry_key, entries.section_key, entries.title, entries.subtitle,
              entries.summary, entries.categories, entries.notes, entries.links, entries.image_path,
              entries.sort_order, entries.published, entries.updated_at,
              coalesce(actor."displayUsername", actor.name, actor.username) as updated_by_name
         from public.uniform_guide_entries entries
         left join public.app_auth_users actor on actor.id = entries.updated_by
         ${entryWhere}
        order by entries.section_key, entries.sort_order, entries.title`,
    ),
  ]);
  const entriesBySection = new Map<string, ReturnType<typeof mapEntry>[]>();
  for (const row of entryResult.rows) {
    entriesBySection.set(row.section_key, [...(entriesBySection.get(row.section_key) || []), mapEntry(row)]);
  }
  return sectionResult.rows.map((row) => ({
    key: row.section_key,
    label: row.label,
    description: row.description,
    sortOrder: row.sort_order,
    published: row.published,
    entries: entriesBySection.get(row.section_key) || [],
  }));
}

function mapEntry(row: EntryRow) {
  return {
    id: row.id,
    entryKey: row.entry_key,
    sectionKey: row.section_key,
    title: row.title,
    subtitle: row.subtitle,
    summary: row.summary,
    categories: row.categories,
    notes: row.notes,
    links: row.links,
    imagePath: row.image_path,
    sortOrder: row.sort_order,
    published: row.published,
    updatedAt: row.updated_at.toISOString(),
    updatedBy: row.updated_by_name,
  };
}

async function readRevisions() {
  const result = await getPostgresPool().query<{
    id: string;
    entry_key: string;
    action: string;
    changed_at: Date;
    changed_by_name: string | null;
    title: string;
  }>(`select revisions.id::text, revisions.entry_key, revisions.action, revisions.changed_at,
             coalesce(actor."displayUsername", actor.name, actor.username) as changed_by_name,
             coalesce(revisions.snapshot->>'title', revisions.entry_key) as title
        from public.uniform_guide_revisions revisions
        left join public.app_auth_users actor on actor.id = revisions.changed_by
       order by revisions.changed_at desc limit 30`);
  return result.rows.map((row) => ({
    id: row.id,
    entryKey: row.entry_key,
    action: row.action,
    changedAt: row.changed_at.toISOString(),
    changedBy: row.changed_by_name,
    title: row.title,
  }));
}

export async function GET(request: Request) {
  const includeAdmin = new URL(request.url).searchParams.get("admin") === "1";
  if (includeAdmin && !(await requirePageAccess(request, "admin.uniform-guide", "read").catch(() => null))) {
    return error("Uniform Guide access is required", 403);
  }
  try {
    return NextResponse.json({
      sections: await readGuide(includeAdmin),
      ...(includeAdmin ? { revisions: await readRevisions() } : {}),
    });
  } catch (caught) {
    console.error("[uniform-guide] Read failed", caught);
    return error("Failed to load the Uniform Guide", 500);
  }
}

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return error("Invalid request origin", 403);
  const auth = await requirePageAccess(request, "admin.uniform-guide", "edit").catch(() => null);
  if (!auth) return error("Edit Uniform Guide access is required", 403);
  const full = Boolean(await requirePageAccess(request, "admin.uniform-guide", "full").catch(() => null));
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const action = cleanText(body?.action, 40);
  try {
    await withPostgresTransaction(async (client) => {
      if (action === "create" || action === "update") {
        const id = cleanText(body?.id, 80);
        const sectionKey = cleanText(body?.sectionKey, 80);
        const title = cleanText(body?.title, 160);
        const subtitle = cleanText(body?.subtitle, 160);
        const summary = String(body?.summary || "").trim().slice(0, 2000);
        const categories = parseCategories(body?.categories);
        const notes = parseStringList(body?.notes, 40, 500);
        const links = parseLinks(body?.links);
        if (!sectionKey || !title || !categories || !notes || !links) throw new Error("INVALID");
        const section = await client.query("select 1 from public.uniform_guide_sections where section_key=$1", [sectionKey]);
        if (!section.rowCount) throw new Error("INVALID");

        if (action === "create") {
          const published = full ? body?.published !== false : false;
          const nextOrder = await client.query<{ value: number }>(
            "select coalesce(max(sort_order), -1) + 1 as value from public.uniform_guide_entries where section_key=$1",
            [sectionKey],
          );
          const created = await client.query<{ id: string; entry_key: string }>(
            `insert into public.uniform_guide_entries
              (entry_key, section_key, title, subtitle, summary, categories, notes, links, sort_order, published, updated_by)
             values($1,$2,$3,$4,$5,$6::jsonb,$7,$8::jsonb,$9,$10,$11)
             returning id, entry_key`,
            [`custom-${randomUUID()}`, sectionKey, title, subtitle, summary, JSON.stringify(categories), notes,
              JSON.stringify(links), nextOrder.rows[0].value, published, auth.userId],
          );
          await client.query(
            `insert into public.uniform_guide_revisions(entry_id,entry_key,action,snapshot,changed_by)
             select id,entry_key,'created',to_jsonb(entries),$2 from public.uniform_guide_entries entries where id=$1`,
            [created.rows[0].id, auth.userId],
          );
          await client.query("insert into public.audit_logs(user_id,action,details) values($1,'UNIFORM_GUIDE_ENTRY_CREATED',$2)", [auth.userId, `Created Uniform Guide entry: ${title}`]);
          return;
        }

        if (!id) throw new Error("INVALID");
        const existing = await client.query<{ published: boolean; entry_key: string }>(
          "select published,entry_key from public.uniform_guide_entries where id=$1 for update", [id],
        );
        if (!existing.rowCount) throw new Error("NOT_FOUND");
        const published = full ? body?.published !== false : existing.rows[0].published;
        await client.query(
          `insert into public.uniform_guide_revisions(entry_id,entry_key,action,snapshot,changed_by)
           select id,entry_key,'updated',to_jsonb(entries),$2 from public.uniform_guide_entries entries where id=$1`,
          [id, auth.userId],
        );
        await client.query(
          `update public.uniform_guide_entries set section_key=$2,title=$3,subtitle=$4,summary=$5,
                  categories=$6::jsonb,notes=$7,links=$8::jsonb,published=$9,updated_at=now(),updated_by=$10
            where id=$1`,
          [id, sectionKey, title, subtitle, summary, JSON.stringify(categories), notes, JSON.stringify(links), published, auth.userId],
        );
        await client.query("insert into public.audit_logs(user_id,action,details) values($1,'UNIFORM_GUIDE_ENTRY_UPDATED',$2)", [auth.userId, `Updated Uniform Guide entry: ${title}`]);
        return;
      }

      if (action === "delete") {
        if (!full) throw new Error("FULL_REQUIRED");
        const id = cleanText(body?.id, 80);
        const existing = await client.query<{ title: string }>("select title from public.uniform_guide_entries where id=$1 for update", [id]);
        if (!existing.rowCount) throw new Error("NOT_FOUND");
        await client.query(
          `insert into public.uniform_guide_revisions(entry_id,entry_key,action,snapshot,changed_by)
           select id,entry_key,'deleted',to_jsonb(entries),$2 from public.uniform_guide_entries entries where id=$1`,
          [id, auth.userId],
        );
        await client.query("delete from public.uniform_guide_entries where id=$1", [id]);
        await client.query("insert into public.audit_logs(user_id,action,details) values($1,'UNIFORM_GUIDE_ENTRY_DELETED',$2)", [auth.userId, `Deleted Uniform Guide entry: ${existing.rows[0].title}`]);
        return;
      }

      if (action === "move") {
        if (!full) throw new Error("FULL_REQUIRED");
        const id = cleanText(body?.id, 80);
        const direction = body?.direction === "up" ? -1 : body?.direction === "down" ? 1 : 0;
        if (!id || !direction) throw new Error("INVALID");
        const current = await client.query<{ id: string; entry_key: string; section_key: string; sort_order: number }>(
          "select id,entry_key,section_key,sort_order from public.uniform_guide_entries where id=$1 for update", [id],
        );
        if (!current.rowCount) throw new Error("NOT_FOUND");
        const adjacent = await client.query<{ id: string; sort_order: number }>(
          `select id,sort_order from public.uniform_guide_entries
            where section_key=$1 and ${direction < 0 ? "sort_order < $2" : "sort_order > $2"}
            order by sort_order ${direction < 0 ? "desc" : "asc"} limit 1 for update`,
          [current.rows[0].section_key, current.rows[0].sort_order],
        );
        if (!adjacent.rowCount) return;
        await client.query("update public.uniform_guide_entries set sort_order=$2,updated_at=now(),updated_by=$3 where id=$1", [id, adjacent.rows[0].sort_order, auth.userId]);
        await client.query("update public.uniform_guide_entries set sort_order=$2,updated_at=now(),updated_by=$3 where id=$1", [adjacent.rows[0].id, current.rows[0].sort_order, auth.userId]);
        await client.query(
          `insert into public.uniform_guide_revisions(entry_id,entry_key,action,snapshot,changed_by)
           select id,entry_key,'reordered',to_jsonb(entries),$2 from public.uniform_guide_entries entries where id=$1`,
          [id, auth.userId],
        );
        return;
      }

      throw new Error("INVALID");
    });
    return NextResponse.json({ success: true, sections: await readGuide(true), revisions: await readRevisions() });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "";
    if (message === "INVALID") return error("Review the Uniform Guide fields and try again", 400);
    if (message === "NOT_FOUND") return error("Uniform Guide entry not found", 404);
    if (message === "FULL_REQUIRED") return error("Full Uniform Guide access is required", 403);
    console.error("[uniform-guide] Write failed", caught);
    return error("Failed to update the Uniform Guide", 500);
  }
}
