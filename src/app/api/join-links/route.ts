import { NextResponse } from "next/server";
import {
  defaultJoinPageLinks,
  isJoinPageLinkKey,
  isJoinModlistKey,
  joinPageLinkDefinitions,
  type JoinPageLinkKey,
} from "@/data/joinPageLinks";
import { getPostgresPool, withPostgresTransaction } from "@/lib/postgres/pool";
import { JoinModlistValidationError, restoreJoinModlist, saveJoinModlist } from "@/lib/join-modlist-files";
import { requestHasSameOrigin, requirePageAccess } from "@/lib/route-permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LinkRow = {
  link_key: JoinPageLinkKey;
  url: string;
  updated_at: Date;
  updated_by_name: string | null;
  file_name: string | null;
  file_size_bytes: string | null;
  file_sha256: string | null;
  uploaded_at: Date | null;
  uploaded_by_name: string | null;
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
           links.file_name, links.file_size_bytes, links.file_sha256, links.uploaded_at,
           coalesce(actor."displayUsername", actor.name, actor.username) as updated_by_name,
           coalesce(uploader."displayUsername", uploader.name, uploader.username) as uploaded_by_name
      from public.join_page_links links
      left join public.app_auth_users actor on actor.id = links.updated_by
      left join public.app_auth_users uploader on uploader.id = links.uploaded_by
     order by links.link_key`);
  const rows = new Map(result.rows.map((row) => [row.link_key, row]));
  return joinPageLinkDefinitions.map((definition) => {
    const row = rows.get(definition.key);
    return {
      key: definition.key,
      label: definition.label,
      description: definition.description,
      uploadEnabled: definition.uploadEnabled,
      url: row?.file_sha256 && definition.uploadEnabled
        ? `/api/join-links/files/${definition.key}`
        : row?.url || definition.defaultUrl,
      updatedAt: row?.updated_at || null,
      updatedBy: row?.updated_by_name || null,
      fileName: row?.file_name || null,
      fileSize: row?.file_size_bytes ? Number(row.file_size_bytes) : null,
      fileSha256: row?.file_sha256 || null,
      uploadedAt: row?.uploaded_at || null,
      uploadedBy: row?.uploaded_by_name || null,
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
  if (entries.length !== 1 || entries[0][0] !== "unit-whitelist") return error("Only the unit whitelist uses an editable link", 400);
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

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return error("Invalid request origin", 403);
  const auth = await requirePageAccess(request, "admin.join-links", "edit").catch(() => null);
  if (!auth) return error("Edit Join Page Content access is required", 403);

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 11 * 1024 * 1024) return error("Modlist files must not exceed 10 MB", 413);
  const form = await request.formData().catch(() => null);
  const key = String(form?.get("key") || "");
  const file = form?.get("file");
  if (!isJoinModlistKey(key) || !(file instanceof File)) return error("Select a valid MainOp or FunOp HTML modlist", 400);

  let saved: Awaited<ReturnType<typeof saveJoinModlist>> | null = null;
  let metadataCommitted = false;
  try {
    saved = await saveJoinModlist(key, file);
    const label = joinPageLinkDefinitions.find((definition) => definition.key === key)?.label || key;
    await withPostgresTransaction(async (client) => {
      const changed = await client.query(
        `update public.join_page_links
            set file_name = $2,
                file_size_bytes = $3,
                file_sha256 = $4,
                uploaded_at = now(),
                uploaded_by = $5,
                updated_at = now(),
                updated_by = $5
          where link_key = $1`,
        [key, saved?.originalName, saved?.size, saved?.sha256, auth.userId],
      );
      if (changed.rowCount !== 1) throw new Error("JOIN_LINK_MISSING");
      await client.query(
        "insert into public.audit_logs(user_id, action, details) values($1, 'JOIN_MODLIST_UPLOADED', $2)",
        [auth.userId, `Published ${label}: ${saved?.originalName} (${saved?.size} bytes)`],
      );
    });
    metadataCommitted = true;
    return NextResponse.json({ success: true, links: await readLinks() });
  } catch (caught) {
    if (saved && !metadataCommitted) await restoreJoinModlist(key, saved.previous).catch((rollbackError) => {
      console.error("[join-links] File rollback failed", rollbackError);
    });
    console.error("[join-links] Upload failed", caught);
    if (caught instanceof JoinModlistValidationError) return error(caught.message, 400);
    return error("Failed to upload the modlist", 500);
  }
}
