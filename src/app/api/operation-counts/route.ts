import { NextResponse } from "next/server";
import { getPostgresPool, withPostgresTransaction } from "@/lib/postgres/pool";
import { requestHasSameOrigin, requirePageAccess } from "@/lib/route-permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ATTENDANCE_TYPES = new Set(["mainop", "funop", "rto-course", "cls-course"]);
const COURSE_TYPES = new Set(["rto-course", "cls-course"]);

type PersonnelRow = {
  id: string;
  name: string;
  birth_number: string | null;
  rank_id: string;
  rank_stage: "CR" | "CR-C";
};

type SubmissionRow = {
  id: string;
  personnel_id: string;
  personnel_name: string;
  birth_number: string | null;
  rank_stage: "CR" | "CR-C";
  attendance_type: "mainop" | "funop" | "rto-course" | "cls-course";
  host_name: string;
  occurred_on: string;
  created_at: string;
};

function jsonError(error: string, status = 400) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

function cleanText(value: unknown, maxLength: number) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function cleanDate(value: unknown) {
  const date = cleanText(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return "";
  return date;
}

function summarise(person: PersonnelRow, submissions: SubmissionRow[]) {
  const eligibleStages = person.rank_stage === "CR-C" ? new Set(["CR", "CR-C"]) : new Set(["CR"]);
  const current = submissions.filter((entry) => entry.personnel_id === person.id && eligibleStages.has(entry.rank_stage));
  const mainOps = current.filter((entry) => entry.attendance_type === "mainop").length;
  const funOps = current.filter((entry) => entry.attendance_type === "funop").length;
  const courses = current.filter((entry) => COURSE_TYPES.has(entry.attendance_type)).length;
  const nonMainCredits = Math.min(3, funOps + courses);
  const creditedTotal = mainOps + nonMainCredits;
  return {
    ...person,
    mainOps,
    funOps,
    courses,
    nonMainCredits,
    creditedTotal,
    ready: mainOps >= 1 && creditedTotal >= 4,
  };
}

async function readPersonnel() {
  return getPostgresPool().query<PersonnelRow>(
    `select personnel.id,personnel.name,personnel.birth_number,ranks.id rank_id,ranks.name rank_stage
       from public.personnel personnel
       join public.ranks ranks on ranks.id=personnel.rank_id
      where upper(ranks.name) in ('CR','CR-C')
        and lower(coalesce(personnel.status,'active')) not in ('retired','removed','transferred')
      order by ranks.rank_level,lower(personnel.name)`,
  );
}

async function readSubmissions(allStages = false) {
  return getPostgresPool().query<SubmissionRow>(
    `select submissions.id,submissions.personnel_id,personnel.name personnel_name,
            personnel.birth_number,submissions.rank_stage,submissions.attendance_type,
            submissions.host_name,submissions.occurred_on::text occurred_on,submissions.created_at
       from public.operation_count_submissions submissions
       join public.personnel personnel on personnel.id=submissions.personnel_id
       left join public.ranks current_rank on current_rank.id=personnel.rank_id
      where $1
         or upper(coalesce(current_rank.name,''))=submissions.rank_stage
         or (upper(coalesce(current_rank.name,''))='CR-C' and submissions.rank_stage='CR')
      order by submissions.occurred_on desc,submissions.created_at desc`,
    [allStages],
  );
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const canViewResponses = await requirePageAccess(request, "admin.operation-counts", "read").catch(() => null);
    if (url.searchParams.get("responses") === "1") {
      if (!canViewResponses) return jsonError("Operation Count Responses permission required", 403);
      const [submissions, personnel, canEdit] = await Promise.all([
        readSubmissions(true),
        readPersonnel(),
        requirePageAccess(request, "admin.operation-counts", "edit").catch(() => null),
      ]);
      const currentSubmissions = await readSubmissions(false);
      return NextResponse.json({
        submissions: submissions.rows,
        personnel: personnel.rows.map((person) => summarise(person, currentSubmissions.rows)),
        canEdit: Boolean(canEdit),
      }, { headers: { "Cache-Control": "no-store" } });
    }

    const [personnel, submissions] = await Promise.all([readPersonnel(), readSubmissions(false)]);
    return NextResponse.json({
      personnel: personnel.rows.map((person) => summarise(person, submissions.rows)),
      canViewResponses: Boolean(canViewResponses),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (caught) {
    console.error("[operation-counts] Read failed", caught);
    return jsonError("Unable to load operation counts", 500);
  }
}

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return jsonError("Invalid request origin", 403);

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const personnelId = cleanText(body?.personnelId, 80);
  const attendanceType = cleanText(body?.attendanceType, 30);
  const hostName = cleanText(body?.hostName, 120);
  const occurredOn = cleanDate(body?.occurredOn);

  if (!UUID_PATTERN.test(personnelId)) return jsonError("Select a valid personnel profile");
  if (!ATTENDANCE_TYPES.has(attendanceType)) return jsonError("Select a valid attendance type");
  if (!hostName) return jsonError("Enter the Zeus or operation host");
  if (!occurredOn) return jsonError("Select a valid operation date");
  if (occurredOn > new Date().toISOString().slice(0, 10)) return jsonError("Operation date cannot be in the future");

  try {
    const saved = await withPostgresTransaction(async (client) => {
      const person = await client.query<PersonnelRow>(
        `select personnel.id,personnel.name,personnel.birth_number,ranks.id rank_id,ranks.name rank_stage
           from public.personnel personnel
           join public.ranks ranks on ranks.id=personnel.rank_id
          where personnel.id=$1
            and upper(ranks.name) in ('CR','CR-C')
            and lower(coalesce(personnel.status,'active')) not in ('retired','removed','transferred')
          for update of personnel`,
        [personnelId],
      );
      if (!person.rowCount) throw new Error("INELIGIBLE_PERSONNEL");
      const target = person.rows[0];
      if (COURSE_TYPES.has(attendanceType) && target.rank_stage !== "CR-C") throw new Error("COURSE_REQUIRES_CRC");

      if (attendanceType !== "mainop") {
        const count = await client.query<{ count: number }>(
          `select count(*)::integer count
             from public.operation_count_submissions
            where personnel_id=$1
              and (rank_stage=$2 or ($2='CR-C' and rank_stage='CR'))
              and attendance_type <> 'mainop'`,
          [target.id, target.rank_stage],
        );
        if ((count.rows[0]?.count || 0) >= 3) throw new Error("NON_MAIN_CAP_REACHED");
      }

      const inserted = await client.query<{ id: string }>(
        `insert into public.operation_count_submissions
          (personnel_id,rank_id,rank_stage,attendance_type,host_name,occurred_on)
         values($1,$2,$3,$4,$5,$6) returning id`,
        [target.id, target.rank_id, target.rank_stage, attendanceType, hostName, occurredOn],
      );
      return { id: inserted.rows[0].id, name: target.name, rankStage: target.rank_stage };
    });
    return NextResponse.json({ ok: true, submission: saved }, { status: 201 });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "";
    if (message === "INELIGIBLE_PERSONNEL") return jsonError("That profile is no longer an active CR or CR-C", 409);
    if (message === "COURSE_REQUIRES_CRC") return jsonError("Qualification courses only count while the member is CR-C", 409);
    if (message === "NON_MAIN_CAP_REACHED") return jsonError("This member already has three non-Main Operation credits. Their next count must be a Main Operation.", 409);
    if ((caught as { code?: string })?.code === "23505") return jsonError("That operation form has already been submitted for this member", 409);
    console.error("[operation-counts] Submission failed", caught);
    return jsonError("Unable to save the operation count", 500);
  }
}
