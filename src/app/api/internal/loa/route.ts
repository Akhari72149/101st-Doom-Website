import { NextResponse } from "next/server";
import { authorizeDiscordOutbox } from "@/lib/discord-outbox";
import { withPostgresTransaction } from "@/lib/postgres/pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DISCORD_ID = /^\d{16,22}$/;
const OPTIONS = { headers: { "Cache-Control": "no-store" } };

function cleanText(value: unknown, maximum: number) {
  const cleaned = typeof value === "string" ? value.trim() : "";
  return cleaned ? cleaned.slice(0, maximum) : null;
}

export async function POST(request: Request) {
  if (!authorizeDiscordOutbox(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, ...OPTIONS });
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const action = String(body?.action || "").trim().toLowerCase();
  const discordId = String(body?.discordId || "").trim();
  if (!DISCORD_ID.test(discordId)) {
    return NextResponse.json({ error: "INVALID_DISCORD_ID" }, { status: 400, ...OPTIONS });
  }
  if (action !== "start" && action !== "end") {
    return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400, ...OPTIONS });
  }

  try {
    const result = await withPostgresTransaction(async (client) => {
      const personnel = await client.query<{ id: string; name: string }>(`
        select id, name
          from public.personnel
         where discord_id = $1
           and lower(coalesce(status, 'active')) not in ('retired', 'removed', 'transferred')
         for update
      `, [discordId]);
      const person = personnel.rows[0];
      if (!person) return null;

      if (action === "start") {
        const active = await client.query<{ id: string; started_at: Date }>(`
          select id, started_at
            from public.personnel_loa_periods
           where personnel_id = $1 and ended_at is null
           for update
        `, [person.id]);
        if (active.rows[0]) {
          return { person, period: active.rows[0], alreadyActive: true };
        }

        const inserted = await client.query<{ id: string; started_at: Date }>(`
          insert into public.personnel_loa_periods
            (personnel_id, discord_id, loa_type, expected_end_text, reason)
          values ($1, $2, $3, $4, $5)
          returning id, started_at
        `, [
          person.id,
          discordId,
          cleanText(body?.loaType, 50) || "LOA",
          cleanText(body?.expectedEnd, 100),
          cleanText(body?.reason, 1000),
        ]);
        return { person, period: inserted.rows[0], alreadyActive: false };
      }

      const ended = await client.query<{ id: string; started_at: Date; ended_at: Date }>(`
        update public.personnel_loa_periods
           set ended_at = now(), updated_at = now()
         where personnel_id = $1 and ended_at is null
         returning id, started_at, ended_at
      `, [person.id]);
      return { person, period: ended.rows[0] || null, alreadyEnded: !ended.rows[0] };
    });

    if (!result) {
      return NextResponse.json({ error: "PERSONNEL_NOT_LINKED" }, { status: 404, ...OPTIONS });
    }
    return NextResponse.json(result, OPTIONS);
  } catch (error) {
    console.error("[loa] Failed to record Discord LOA:", error);
    return NextResponse.json({ error: "LOA_RECORD_FAILED" }, { status: 500, ...OPTIONS });
  }
}

