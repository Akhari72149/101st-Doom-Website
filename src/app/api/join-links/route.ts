import { NextResponse } from "next/server";
import {
  defaultJoinPageLinks,
  isJoinPageLinkKey,
  joinPageLinkDefinitions,
  type JoinPageLinkKey,
} from "@/data/joinPageLinks";
import { getPostgresPool, withPostgresTransaction } from "@/lib/postgres/pool";
import { requestHasSameOrigin, requirePageAccess } from "@/lib/route-permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LinkRow = {
  link_key: JoinPageLinkKey;
  url: string;
  updated_at: Date;
  updated_by_name: string | null;
};

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function validUrl(value: unknown) {
  const candidate = String(value || "").trim();
  if (!candidate || candidate.length > 2048) return null;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

async function readLinks() {
  const result = await getPostgresPool().query<LinkRow>(`
    select links.link_key, links.url, links.updated_at,
           coalesce(actor."displayUsername", actor.name, actor.username) as updated_by_name
      from public.join_page_links links
      left join public.app_auth_users actor on actor.id = links.updated_by
     order by links.link_key`);
  const rows = new Map(result.rows.map((row) => [row.link_key, row]));
  return joinPageLinkDefinitions.map((definition) => {
    const row = rows.get(definition.key);
    return {
      key: definition.key,
      label: definition.label,
      description: definition.description,
      url: row?.url || definition.defaultUrl,
      updatedAt: row?.updated_at || null,
      updatedBy: row?.updated_by_name || null,
    };
  });
}

export async function GET(request: Request) {
  const wantsAdminDetails = new URL(request.url).searchParams.get("admin") === "1";
  if (wantsAdminDetails && !(await requirePageAccess(request, "admin.join-links", "read").catch(() => null))) {
    return error("Forbidden", 403);
  }
  try {
    const links = await readLinks();
    if (wantsAdminDetails) return NextResponse.json({ links }, { headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({
      links: Object.fromEntries(links.map((link) => [link.key, link.url])),
    }, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
  } catch (caught) {
    console.error("[join-links] Read failed", caught);
    if (wantsAdminDetails) return error("Failed to load Join page links", 500);
    return NextResponse.json({ links: defaultJoinPageLinks }, { headers: { "Cache-Control": "no-store" } });
  }
}

export async function PATCH(request: Request) {
  if (!requestHasSameOrigin(request)) return error("Invalid request origin", 403);
  const auth = await requirePageAccess(request, "admin.join-links", "edit").catch(() => null);
  if (!auth) return error("Edit Join Page Links access is required", 403);
  const body = await request.json().catch(() => null) as { links?: unknown } | null;
  if (!body?.links || typeof body.links !== "object" || Array.isArray(body.links)) {
    return error("Invalid link update", 400);
  }
  const entries = Object.entries(body.links as Record<string, unknown>);
  if (!entries.length || entries.length > joinPageLinkDefinitions.length) return error("Invalid link update", 400);
  const updates = entries.map(([key, rawUrl]) => ({ key, url: validUrl(rawUrl) }));
  if (updates.some((entry) => !isJoinPageLinkKey(entry.key) || !entry.url) || new Set(updates.map((entry) => entry.key)).size !== updates.length) {
    return error("Every link must use a valid HTTP or HTTPS address", 400);
  }

  try {
    const changed = await withPostgresTransaction(async (client) => {
      const keys = updates.map((entry) => entry.key);
      const existing = await client.query<{ link_key: JoinPageLinkKey; url: string }>(
        "select link_key, url from public.join_page_links where link_key = any($1::text[]) for update",
        [keys],
      );
      if (existing.rowCount !== updates.length) throw new Error("JOIN_LINKS_MISSING");
      const oldByKey = new Map(existing.rows.map((row) => [row.link_key, row.url]));
      const changedEntries = updates.filter((entry) => oldByKey.get(entry.key as JoinPageLinkKey) !== entry.url);
      for (const entry of changedEntries) {
        await client.query(
          "update public.join_page_links set url = $2, updated_at = now(), updated_by = $3 where link_key = $1",
          [entry.key, entry.url, auth.userId],
        );
      }
      if (changedEntries.length) {
        const labels = changedEntries.map((entry) => joinPageLinkDefinitions.find((definition) => definition.key === entry.key)?.label || entry.key);
        await client.query(
          "insert into public.audit_logs(user_id, action, details) values($1, 'JOIN_PAGE_LINKS_UPDATED', $2)",
          [auth.userId, `Updated Join page links: ${labels.join(", ")}`],
        );
      }
      return changedEntries.length;
    });
    return NextResponse.json({ success: true, changed, links: await readLinks() });
  } catch (caught) {
    console.error("[join-links] Update failed", caught);
    return error("Failed to update Join page links", 500);
  }
}
