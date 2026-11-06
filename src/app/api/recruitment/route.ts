import { NextResponse } from "next/server";
import { getPostgresPool } from "@/lib/postgres/pool";
import { requestHasSameOrigin } from "@/lib/route-permissions";
import { normalizeBlock, validateAnswers, type RecruitmentBlock } from "@/lib/recruitment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function publicBlocks() {
  const result = await getPostgresPool().query<RecruitmentBlock>(
    `select id,block_type,field_key,title,description,input_type,options,required,active,sort_order
       from public.recruitment_form_blocks where active=true order by sort_order,id`,
  );
  return result.rows.map(normalizeBlock);
}

async function activePersonnelDuplicate(field: "name" | "birth_number", value: string) {
  const result = await getPostgresPool().query<{ duplicate: boolean }>(
    `select exists(
       select 1 from public.personnel
        where lower(${field})=lower($1)
          and lower(coalesce(status,''))<>all(array['removed','retired'])
     ) duplicate`,
    [value],
  );
  return Boolean(result.rows[0]?.duplicate);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const check = url.searchParams.get("check");
    const value = String(url.searchParams.get("value") || "").trim().slice(0, 100);
    if (check) {
      const field = check === "nickname" ? "name" : check === "service_number" ? "birth_number" : null;
      if (!field || !value) return NextResponse.json({ error: "Invalid availability check" }, { status: 400 });
      return NextResponse.json({ duplicate: await activePersonnelDuplicate(field, value) }, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ blocks: await publicBlocks() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[recruitment] Form read failed", error);
    return NextResponse.json({ error: "Unable to load the recruitment form" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  const body = await request.json().catch(() => null) as { answers?: unknown; website?: unknown } | null;
  if (String(body?.website || "").trim()) return NextResponse.json({ ok: true }, { status: 201 });

  try {
    const parsed = validateAnswers(await publicBlocks(), body?.answers);
    const [duplicateName, duplicateNumber] = await Promise.all([
      activePersonnelDuplicate("name", parsed.nickname),
      activePersonnelDuplicate("birth_number", parsed.serviceNumber),
    ]);
    if (duplicateName) return NextResponse.json({ error: "An active personnel record already uses this nickname" }, { status: 409 });
    if (duplicateNumber) return NextResponse.json({ error: "An active personnel record already uses this service number" }, { status: 409 });
    const inserted = await getPostgresPool().query<{ id: string }>(
      `insert into public.recruitment_responses
         (answers,service_number,nickname,discord_name,selected_platoons)
       values($1::jsonb,$2,$3,$4,$5::jsonb) returning id`,
      [JSON.stringify(parsed.answers), parsed.serviceNumber, parsed.nickname, parsed.discordName, JSON.stringify(parsed.selectedPlatoons)],
    );
    return NextResponse.json({ ok: true, id: inserted.rows[0].id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to submit the recruitment form";
    const expected = message.startsWith("Complete") || message.startsWith("Enter") || message.startsWith("Choose");
    if (!expected) console.error("[recruitment] Submission failed", error);
    return NextResponse.json({ error: expected ? message : "Unable to submit the recruitment form" }, { status: expected ? 400 : 500 });
  }
}
