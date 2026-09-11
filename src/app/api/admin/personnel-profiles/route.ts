import { NextResponse } from "next/server";
import { getPostgresPool, withPostgresTransaction } from "@/lib/postgres/pool";
import { requestHasSameOrigin, requirePageAccess } from "@/lib/route-permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PERMISSION = "admin.personnel-profiles";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const INACTIVE_STATUSES = ["removed", "retired", "transferred"];

type PersonnelAction = "update-join-date" | "unlink-discord" | "reactivate" | "set-reservist";

function isRealDate(value: string) {
  if (!DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export async function GET(request: Request) {
  if (!(await requirePageAccess(request, PERMISSION, "read"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const query = (params.get("q") || "").trim().slice(0, 100);
  const view = params.get("view") === "inactive" ? "inactive" : "active";

  try {
    const [result, ranks] = await Promise.all([
      getPostgresPool().query(
      `select personnel.id,
              personnel.name,
              personnel.birth_number,
              personnel.rank_id,
              personnel.discord_id,
              personnel.ts_id,
              personnel.status,
              personnel.slotted_position,
              personnel.reservist_since,
              to_char(personnel.created_at, 'YYYY-MM-DD') as join_date,
              ranks.name as rank_name,
              (select count(*)::integer from public.personnel_certifications awarded
               where awarded.personnel_id = personnel.id) as certification_count,
              coalesce(
                (select jsonb_agg(
                  jsonb_build_object(
                    'id', definitions.id,
                    'name', definitions.name,
                    'discordRoleId', definitions.cert_id
                  ) order by definitions.name
                )
                 from public.personnel_certifications awarded
                 join public.certifications definitions on definitions.id = awarded.certification_id
                 where awarded.personnel_id = personnel.id),
                '[]'::jsonb
              ) as certifications,
              (select jsonb_build_object(
                  'steamId', links.steam_id,
                  'displayName', links.steam_display_name,
                  'profileUrl', coalesce(links.steam_profile_url, 'https://steamcommunity.com/profiles/' || links.steam_id),
                  'linkedAt', links.linked_at
                )
               from public.personnel_steam_links links
               where links.personnel_id = personnel.id and links.revoked_at is null
               order by links.linked_at desc nulls last limit 1) as steam_link,
              (select jsonb_build_object(
                  'id', accounts.id,
                  'username', accounts.username,
                  'displayName', coalesce(accounts."displayUsername", accounts.name, accounts.username),
                  'disabled', accounts.disabled,
                  'matchType', case when accounts.id = personnel.auth_user_id then 'linked' else 'name-match' end
                )
               from public.app_auth_users accounts
               left join public.profiles profiles on profiles.id = accounts.id
               where accounts.id = personnel.auth_user_id
                  or (personnel.auth_user_id is null and lower(coalesce(profiles.display_name, accounts."displayUsername", accounts.name, accounts.username)) = lower(personnel.name))
               order by (accounts.id = personnel.auth_user_id) desc, accounts.disabled asc
               limit 1) as website_account,
              coalesce(
                (select jsonb_agg(to_jsonb(history) order by history.created_at desc)
                 from (
                   select audit.id::text as id,
                          audit.action,
                          audit.details,
                          audit.created_at,
                          coalesce(accounts."displayUsername", accounts.name, processor.name, 'System') as actor
                   from public.audit_logs audit
                   left join public.app_auth_users accounts on accounts.id = audit.user_id
                   left join public.personnel processor on processor.id = audit.processed_by
                   where audit.target_personnel_id = personnel.id
                     and audit.action = any(array[
                       'JOIN_DATE_UPDATED','DISCORD_UNLINKED','PERSONNEL_REMOVED',
                       'PERSONNEL_RETIRED','PERSONNEL_TRANSFERRED','PERSONNEL_REACTIVATED',
                       'PERSONNEL_RESERVIST_STARTED','PERSONNEL_RESERVIST_ENDED','RANK_CHANGED'
                     ])
                   order by audit.created_at desc nulls last
                   limit 12
                 ) history),
                '[]'::jsonb
              ) as recent_history
       from public.personnel personnel
       left join public.ranks ranks on ranks.id = personnel.rank_id
       where ($1 = '' or personnel.name ilike '%' || $1 || '%')
         and case when $2 = 'inactive'
           then lower(coalesce(personnel.status, '')) = any($3::text[])
           else lower(coalesce(personnel.status, '')) <> all($3::text[])
         end
       order by personnel.name
       limit 100`,
      [query, view, INACTIVE_STATUSES],
      ),
      getPostgresPool().query("select id,name,rank_level from public.ranks order by rank_level,name"),
    ]);

    return NextResponse.json({ personnel: result.rows, ranks: ranks.rows });
  } catch (error) {
    console.error("[personnel-profiles] Read failed", error);
    return NextResponse.json({ error: "Failed to load personnel profiles" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as {
    action?: PersonnelAction;
    personnelId?: string;
    joinDate?: string;
    keepCertificationIds?: string[];
    reason?: string;
    rankId?: string;
    reservist?: boolean;
  } | null;
  const action = body?.action;
  const personnelId = String(body?.personnelId || "");
  const validActions: PersonnelAction[] = ["update-join-date", "unlink-discord", "reactivate", "set-reservist"];

  if (!action || !validActions.includes(action)) {
    return NextResponse.json({ error: "Invalid personnel action" }, { status: 400 });
  }

  const requiredAccess: "edit" | "full" = action === "reactivate" ? "full" : "edit";
  const auth = await requirePageAccess(request, PERMISSION, requiredAccess);

  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!UUID.test(personnelId)) {
    return NextResponse.json({ error: "Invalid personnel action" }, { status: 400 });
  }

  try {
    const result = await withPostgresTransaction(async (client) => {
      const person = await client.query<{
        id: string;
        name: string;
        discord_id: string;
        status: string | null;
        join_date: string;
        rank_id: string | null;
        slotted_position: string | null;
        reservist_since: string | null;
      }>(
        `select id, name, discord_id, status, rank_id, slotted_position, reservist_since,
                to_char(created_at, 'YYYY-MM-DD') as join_date
         from public.personnel where id=$1 for update`,
        [personnelId],
      );
      if (!person.rowCount) throw new Error("NOT_FOUND");
      const current = person.rows[0];

      if (action === "update-join-date") {
        const joinDate = String(body.joinDate || "");
        if (!isRealDate(joinDate)) throw new Error("INVALID_DATE");
        await client.query("update public.personnel set created_at=$2::date where id=$1", [personnelId, joinDate]);
        await client.query(
          `insert into public.audit_logs(user_id,target_personnel_id,action,details)
           values($1,$2,'JOIN_DATE_UPDATED',$3)`,
          [auth.userId, personnelId, `Join date changed from ${current.join_date} to ${joinDate}`],
        );
        return { joinDate };
      }

      if (action === "unlink-discord") {
        if (!current.discord_id.trim()) throw new Error("NOT_LINKED");
        await client.query("update public.personnel set discord_id='' where id=$1", [personnelId]);
        await client.query(
          `insert into public.audit_logs(user_id,target_personnel_id,action,details)
           values($1,$2,'DISCORD_UNLINKED','Discord account unlinked from personnel profile')`,
          [auth.userId, personnelId],
        );
        return { discordId: "" };
      }

      if (action === "set-reservist") {
        if (INACTIVE_STATUSES.includes((current.status || "").toLowerCase())) throw new Error("INACTIVE_PROFILE");
        const reservist = body.reservist === true;
        if (reservist === Boolean(current.reservist_since)) throw new Error("NO_CHANGE");
        await client.query(
          reservist
            ? "update public.personnel set reservist_since=now(), slotted_position=null where id=$1"
            : "update public.personnel set reservist_since=null where id=$1",
          [personnelId],
        );
        await client.query(
          `insert into public.audit_logs(user_id,target_personnel_id,action,details)
           values($1,$2,$3,$4)`,
          [
            auth.userId,
            personnelId,
            reservist ? "PERSONNEL_RESERVIST_STARTED" : "PERSONNEL_RESERVIST_ENDED",
            reservist
              ? `Moved to reservist status${current.slotted_position ? `; previous slot ${current.slotted_position} cleared` : ""}`
              : "Returned from reservist status",
          ],
        );
        return { reservistSince: reservist ? new Date().toISOString() : null };
      }

      const status = (current.status || "").toLowerCase();
      if (!INACTIVE_STATUSES.includes(status)) throw new Error("ALREADY_ACTIVE");
      const reason = String(body.reason || "").trim().replace(/\s+/g, " ").slice(0, 500);
      const rankId = String(body.rankId || "");
      if (reason.length < 3) throw new Error("REASON_REQUIRED");
      if (!UUID.test(rankId)) throw new Error("INVALID_RANK");
      const rank = await client.query<{ name: string }>("select name from public.ranks where id=$1", [rankId]);
      if (!rank.rowCount) throw new Error("INVALID_RANK");
      const keepIds = [...new Set((body.keepCertificationIds || []).map(String))];
      if (keepIds.some((id) => !UUID.test(id))) throw new Error("INVALID_CERTIFICATIONS");

      const awarded = await client.query<{ certification_id: string }>(
        "select certification_id from public.personnel_certifications where personnel_id=$1",
        [personnelId],
      );
      const existing = new Set(awarded.rows.map((row) => row.certification_id));
      if (keepIds.some((id) => !existing.has(id))) throw new Error("INVALID_CERTIFICATIONS");

      if (keepIds.length) {
        await client.query(
          "delete from public.personnel_certifications where personnel_id=$1 and not (certification_id = any($2::uuid[]))",
          [personnelId, keepIds],
        );
      } else {
        await client.query("delete from public.personnel_certifications where personnel_id=$1", [personnelId]);
      }
      await client.query(
        "update public.personnel set status=null, rank_id=$2, slotted_position=null where id=$1",
        [personnelId, rankId],
      );
      if (current.rank_id !== rankId) {
        await client.query(
          `insert into public.rank_history(personnel_id,discord_id,old_rank_id,new_rank_id,changed_at)
           values($1,$2,$3,$4,now())`,
          [personnelId, current.discord_id, current.rank_id, rankId],
        );
      }
      const queued = await client.query<{ queued_count: number }>(
        "select public.enqueue_personnel_reactivation($1) as queued_count",
        [personnelId],
      );
      await client.query(
        `insert into public.audit_logs(user_id,target_personnel_id,action,details,old_rank_id,target_rank_id)
         values($1,$2,'PERSONNEL_REACTIVATED',$3,$4,$5)`,
        [
          auth.userId,
          personnelId,
          `Reactivated from ${current.status} as ${rank.rows[0].name}; retained ${keepIds.length} certification(s). Reason: ${reason}`,
          current.rank_id,
          rankId,
        ],
      );
      return { status: null, rankId, retainedCertificationCount: keepIds.length, discordEventsQueued: queued.rows[0].queued_count };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const known: Record<string, [string, number]> = {
      NOT_FOUND: ["Personnel profile not found", 404],
      INVALID_DATE: ["Enter a valid join date", 400],
      NOT_LINKED: ["This profile does not have a Discord account linked", 409],
      ALREADY_ACTIVE: ["This personnel profile is already active", 409],
      INACTIVE_PROFILE: ["Inactive profiles cannot be placed in reserves", 409],
      NO_CHANGE: ["The personnel profile already has that reservist status", 409],
      REASON_REQUIRED: ["Enter a reactivation reason", 400],
      INVALID_RANK: ["Select a valid rank", 400],
      INVALID_CERTIFICATIONS: ["Invalid certification selection", 400],
    };
    if (known[code]) return NextResponse.json({ error: known[code][0] }, { status: known[code][1] });
    console.error("[personnel-profiles] Update failed", error);
    return NextResponse.json({ error: "Failed to update personnel profile" }, { status: 500 });
  }
}
