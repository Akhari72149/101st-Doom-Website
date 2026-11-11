import { NextResponse } from "next/server";
import { requestHasSameOrigin, requirePageAccess } from "@/lib/route-permissions";
import { getPostgresPool, withPostgresTransaction } from "@/lib/postgres/pool";
import { configuredServerAgentId } from "@/lib/server-agent-auth";
import agentDefaults from "../../../../scripts/server-agent/config.example.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LEGACY_COMMAND = /^(start|stop) server ([1-4])$/;
const SERVER_COMMAND = /^(start|stop|restart|copy keys) server ([1-4])$/;
const GLOBAL_COMMAND = /^(update arma|update mods) all$/;
const ACTIONS: Record<string, string> = {
  start: "server.start",
  stop: "server.stop",
  restart: "server.restart",
  "copy keys": "mods.keys.copy",
  "update arma": "steamcmd.server.update_all",
  "update mods": "steamcmd.mods.update_all",
};

const DEFAULT_PRESETS = {
  main: agentDefaults.servers["1"].workshopModIds,
  fun: agentDefaults.servers["2"].workshopModIds,
  fotm: agentDefaults.servers["4"].workshopModIds,
} as const;

type ModPresetKey = keyof typeof DEFAULT_PRESETS;

function presetDisplayName(preset: ModPresetKey) {
  if (preset === "main") return "Servers 1 & 3";
  if (preset === "fun") return "Server 2";
  return "Server 4";
}

function normalizeModIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((entry) => String(entry).trim()).filter((entry) => /^\d{6,12}$/.test(entry)))].slice(0, 400);
}

async function resolveWorkshopNames(ids: string[]) {
  if (!ids.length) return {} as Record<string, string>;
  const pool = getPostgresPool();
  const cached = await pool.query<{ workshop_id: string; display_name: string }>(
    `select workshop_id,display_name from public.server_control_workshop_items
      where workshop_id=any($1::text[])`,
    [ids],
  );
  const names = Object.fromEntries(cached.rows.map((row) => [row.workshop_id, row.display_name])) as Record<string, string>;
  const missing = ids.filter((id) => !names[id]).slice(0, 100);
  if (!missing.length) return names;

  try {
    const params = new URLSearchParams({ itemcount: String(missing.length) });
    missing.forEach((id, index) => params.set(`publishedfileids[${index}]`, id));
    const response = await fetch("https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`Steam returned ${response.status}`);
    const body = await response.json() as { response?: { publishedfiledetails?: Array<{ publishedfileid?: string; title?: string; result?: number }> } };
    for (const item of body.response?.publishedfiledetails || []) {
      const id = String(item.publishedfileid || "");
      const title = String(item.title || "").trim().slice(0, 300);
      if (!ids.includes(id) || !title || item.result !== 1) continue;
      names[id] = title;
      await pool.query(
        `insert into public.server_control_workshop_items(workshop_id,display_name,resolved_at,updated_at)
         values($1,$2,now(),now()) on conflict(workshop_id) do update
         set display_name=excluded.display_name,resolved_at=now(),updated_at=now()`,
        [id, title],
      );
    }
  } catch (error) {
    console.warn("[server-control] Steam Workshop title lookup failed", error);
  }
  return names;
}

async function ensureModPresets() {
  const pool = getPostgresPool();
  await Promise.all([
    pool.query(
      `insert into public.server_control_mod_presets(preset_key,display_name,workshop_mod_ids)
       values('main','Servers 1 & 3',$1::jsonb) on conflict(preset_key) do nothing`,
      [JSON.stringify(DEFAULT_PRESETS.main)],
    ),
    pool.query(
      `insert into public.server_control_mod_presets(preset_key,display_name,workshop_mod_ids)
       values('fun','Server 2',$1::jsonb) on conflict(preset_key) do nothing`,
      [JSON.stringify(DEFAULT_PRESETS.fun)],
    ),
    pool.query(
      `insert into public.server_control_mod_presets(preset_key,display_name,workshop_mod_ids)
       values('fotm','Server 4',$1::jsonb) on conflict(preset_key) do nothing`,
      [JSON.stringify(DEFAULT_PRESETS.fotm)],
    ),
  ]);
}

async function readModPresets() {
  await ensureModPresets();
  const result = await getPostgresPool().query<{
    preset_key: ModPresetKey;
    display_name: string;
    workshop_mod_ids: unknown;
    updated_by_name: string | null;
    updated_at: string;
  }>(
    `select preset_key,display_name,workshop_mod_ids,updated_by_name,updated_at
       from public.server_control_mod_presets order by preset_key`,
  );
  const rows = result.rows.map((row) => ({ ...row, modIds: normalizeModIds(row.workshop_mod_ids) }));
  const names = await resolveWorkshopNames([...new Set(rows.flatMap((row) => row.modIds))]);
  return rows.map((row) => ({
    key: row.preset_key,
    displayName: row.display_name,
    modIds: row.modIds,
    modNames: Object.fromEntries(row.modIds.map((id) => [id, names[id] || `Workshop item ${id}`])),
    updatedBy: row.updated_by_name,
    updatedAt: row.updated_at,
  }));
}

function agentEnabled() {
  return process.env.SERVER_CONTROL_AGENT_ENABLED === "true";
}
async function actorName(userId: string, email: string | null) {
  const result = await getPostgresPool().query<{ display_name: string | null }>(
    `select coalesce(nullif("displayUsername",''),nullif(name,''),nullif(username,'')) display_name
       from public.app_auth_users where id=$1`,
    [userId],
  );
  return result.rows[0]?.display_name || email || "Website administrator";
}

export async function GET(request: Request) {
  const auth = await requirePageAccess(request, "admin.server-control", "read").catch(() => null);
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!agentEnabled()) {
    return NextResponse.json({ mode: "legacy", agent: null, jobs: [] }, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const agentId = configuredServerAgentId();
    const [agent, jobs, presets] = await Promise.all([
      getPostgresPool().query(
        `select id,display_name,version,status,details,last_seen_at,
                (last_seen_at is not null and last_seen_at > now()-interval '45 seconds') online
           from public.server_control_agents where id=$1`,
        [agentId],
      ),
      getPostgresPool().query(
        `select jobs.id,jobs.server_id,jobs.action,jobs.status,jobs.requested_by_name,jobs.attempts,
                jobs.error_message,jobs.requested_at,jobs.started_at,jobs.completed_at,jobs.updated_at,
                coalesce((select jsonb_agg(jsonb_build_object('id',logs.id,'level',logs.level,
                  'message',logs.message,'createdAt',logs.created_at) order by logs.id)
                  from (select * from public.server_control_job_logs where job_id=jobs.id order by id desc limit 80) logs),'[]'::jsonb) logs
           from public.server_control_jobs jobs where jobs.agent_id=$1
          order by jobs.requested_at desc limit 25`,
        [agentId],
      ),
      readModPresets(),
    ]);
    return NextResponse.json(
      { mode: "agent", agent: agent.rows[0] || null, jobs: jobs.rows, presets },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[server-control] Status read failed", error);
    return NextResponse.json({ error: "Failed to load server-control activity" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  const body = await request.json().catch(() => null) as {
    command?: unknown;
    action?: unknown;
    preset?: unknown;
    modIds?: unknown;
  } | null;

  if (body?.action === "save-mod-preset") {
    const auth = await requirePageAccess(request, "admin.server-control", "full").catch(() => null);
    if (!auth?.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const preset = body.preset === "main" || body.preset === "fun" || body.preset === "fotm" ? body.preset : null;
    const modIds = normalizeModIds(body.modIds);
    if (!preset) return NextResponse.json({ error: "Invalid mod preset" }, { status: 400 });
    if (!modIds.length) return NextResponse.json({ error: "A preset must contain at least one Workshop mod" }, { status: 400 });
    if (!Array.isArray(body.modIds) || modIds.length !== new Set(body.modIds.map(String)).size) {
      return NextResponse.json({ error: "Every mod must use a unique numeric Workshop ID" }, { status: 400 });
    }
    try {
      const requestedBy = await actorName(auth.userId, auth.email);
      await ensureModPresets();
      await withPostgresTransaction(async (client) => {
        await client.query(
          `update public.server_control_mod_presets
              set workshop_mod_ids=$1::jsonb,updated_by=$2,updated_by_name=$3,updated_at=now()
            where preset_key=$4`,
          [JSON.stringify(modIds), auth.userId, requestedBy, preset],
        );
        await client.query(
          `insert into public.audit_logs(user_id,action,details)
           values($1,'SERVER_MOD_PRESET_UPDATED',$2)`,
          [auth.userId, `${requestedBy} updated the ${presetDisplayName(preset)} mod preset to ${modIds.length} Workshop items.`],
        );
      });
      return NextResponse.json({ saved: true, presets: await readModPresets() });
    } catch (error) {
      console.error("[server-control] Preset save failed", error);
      return NextResponse.json({ error: "Failed to save the mod preset" }, { status: 500 });
    }
  }

  const command = String(body?.command || "").trim().toLowerCase();
  const match = command.match(agentEnabled() ? SERVER_COMMAND : LEGACY_COMMAND);
  const globalMatch = agentEnabled() ? command.match(GLOBAL_COMMAND) : null;
  if (!match && !globalMatch) return NextResponse.json({ error: "Invalid server command" }, { status: 400 });

  const selected = globalMatch || match!;
  const requiresFull = Boolean(globalMatch) || selected[1] === "copy keys";
  const auth = await requirePageAccess(request, "admin.server-control", requiresFull ? "full" : "edit").catch(() => null);
  if (!auth?.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (agentEnabled()) {
    const serverId = globalMatch ? null : Number(match![2]);
    const action = ACTIONS[selected[1]];
    try {
      const requestedBy = await actorName(auth.userId, auth.email);
      const presets = await readModPresets();
      const mainMods = presets.find((preset) => preset.key === "main")?.modIds || [];
      const funMods = presets.find((preset) => preset.key === "fun")?.modIds || [];
      const fotmMods = presets.find((preset) => preset.key === "fotm")?.modIds || [];
      const selectedMods = serverId === 2 ? funMods : serverId === 4 ? fotmMods : mainMods;
      const payload = action === "steamcmd.mods.update_all"
        ? { workshopModIds: [...new Set([...mainMods, ...funMods, ...fotmMods])] }
        : action === "server.start" || action === "server.restart" || action === "mods.keys.copy"
          ? selectedMods.length ? { workshopModIds: selectedMods } : {}
          : {};
      const job = await withPostgresTransaction(async (client) => {
        await client.query(
          `insert into public.server_control_agents(id,display_name,status)
           values($1,'Primary Arma Server','offline') on conflict(id) do nothing`,
          [configuredServerAgentId()],
        );
        const conflict = await client.query(
          `select id from public.server_control_jobs
            where agent_id=$1 and status in ('pending','processing')
              and ($2::boolean or server_id is null)
            limit 1`,
          [configuredServerAgentId(), globalMatch !== null],
        );
        if (conflict.rowCount) throw Object.assign(new Error("ACTIVE_SERVER_JOB"), { code: "ACTIVE_SERVER_JOB" });
        const inserted = await client.query<{ id: string }>(
          `insert into public.server_control_jobs(agent_id,server_id,action,payload,requested_by,requested_by_name)
           values($1,$2,$3,$4::jsonb,$5,$6) returning id`,
          [configuredServerAgentId(), serverId, action, JSON.stringify(payload), auth.userId, requestedBy],
        );
        await client.query(
          `insert into public.audit_logs(user_id,action,details)
           values($1,'SERVER_CONTROL_JOB_QUEUED',$2)`,
          [auth.userId, `${requestedBy} queued ${action}${serverId ? ` for Server ${serverId}` : " for the full server installation"}. Job ${inserted.rows[0].id}.`],
        );
        return inserted.rows[0];
      });
      return NextResponse.json({ queued: true, jobId: job.id }, { status: 202 });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && (error.code === "23505" || error.code === "ACTIVE_SERVER_JOB")) {
        return NextResponse.json({ error: "Another server operation is already pending or processing." }, { status: 409 });
      }
      console.error("[server-control] Queue failed", error);
      return NextResponse.json({ error: "Failed to queue server operation" }, { status: 500 });
    }
  }

  const listenerUrl = process.env.SERVER_CONTROL_LISTENER_URL || "http://199.33.118.13:3001/server";
  try {
    const response = await fetch(listenerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command }),
      signal: AbortSignal.timeout(10_000),
    });
    const result = await response.text();
    if (!response.ok) return NextResponse.json({ error: "Server listener rejected the command" }, { status: 502 });
    return NextResponse.json({ result });
  } catch (error) {
    console.error("[server-control] Listener request failed", error);
    return NextResponse.json({ error: "Server listener is unavailable" }, { status: 502 });
  }
}
