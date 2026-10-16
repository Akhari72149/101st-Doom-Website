import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getPostgresPool, withPostgresTransaction } from "@/lib/postgres/pool";
import { requestHasSameOrigin, requirePageAccess } from "@/lib/route-permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const ACCESS_COOKIE = "hammer_ridealong_access";
const ACCESS_DURATION_MS = 8 * 60 * 60 * 1000;
const DEFAULT_PASSWORD_SHA256 = "c3dc2b25c6d0dca00689848699336c16a4483b7c98c196dc389a1180dd2d1116";
const MAX_ATTEMPTS = 8;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; resetAt: number }>();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MILESTONE_STATUSES = new Set(["Not Complete", "Complete", "Waived"]);
const FLIGHTS = new Set(["", "Hammer 1", "Hammer 2", "Hammer 3", "Hammer 4"]);

type TraineeRow = {
  id: string;
  personnel_id: string | null;
  name: string;
  started_course: string | null;
  ground_school: string;
  flight_school: string;
  sere: string;
  cxc_test: string;
  flight: string;
  joining_hammer: boolean;
  phase1_adjustment: number;
  phase2_adjustment: number;
  notes: string;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type ReportRow = {
  id: string;
  trainee_id: string;
  phase: 1 | 2;
  operation_type: "mainop" | "funop" | "training";
  zeus: string;
  pilot_supervisor: string;
  activity: "ball-gunning" | "flying";
  occurred_on: string;
  created_at: string;
};

type PersonnelOption = {
  id: string;
  name: string;
  birth_number: string | null;
  rank_name: string | null;
};

function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

function cleanText(value: unknown, maxLength: number) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function cleanUuid(value: unknown) {
  const id = cleanText(value, 80);
  return UUID_PATTERN.test(id) ? id : "";
}

function cleanDate(value: unknown) {
  const date = cleanText(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date ? "" : date;
}

function cleanMilestone(value: unknown) {
  const status = cleanText(value, 20);
  return MILESTONE_STATUSES.has(status) ? status : "";
}

function passwordHash() {
  const configured = process.env.HAMMER_RIDEALONG_PASSWORD_SHA256?.trim().toLowerCase();
  return configured && /^[0-9a-f]{64}$/.test(configured) ? configured : DEFAULT_PASSWORD_SHA256;
}

function accessSecret() {
  return process.env.HAMMER_RIDEALONG_SESSION_SECRET
    || process.env.BETTER_AUTH_SECRET
    || process.env.AUTH_SECRET
    || (process.env.NODE_ENV === "production" ? "" : "hammer-ridealong-development-only");
}

function signAccess(expiry: string) {
  const secret = accessSecret();
  if (!secret) return "";
  return createHmac("sha256", secret).update(expiry).digest("base64url");
}

function cookieValue(request: Request, name: string) {
  return request.headers.get("cookie")?.split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${name}=`))
    ?.slice(name.length + 1) || "";
}

function hasFormAccess(request: Request) {
  const [expiry, signature] = cookieValue(request, ACCESS_COOKIE).split(".");
  if (!expiry || !signature || Number(expiry) <= Date.now()) return false;
  const expected = Buffer.from(signAccess(expiry));
  const received = Buffer.from(signature);
  return expected.length > 0 && expected.length === received.length && timingSafeEqual(expected, received);
}

function requestAddress(request: Request) {
  return request.headers.get("cf-connecting-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
}

function verifyPassword(request: Request, supplied: string) {
  const key = requestAddress(request);
  const now = Date.now();
  const current = attempts.get(key);
  const state = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + ATTEMPT_WINDOW_MS }
    : current;
  if (state.count >= MAX_ATTEMPTS) return { valid: false, rateLimited: true };

  const received = createHash("sha256").update(supplied, "utf8").digest();
  const expected = Buffer.from(passwordHash(), "hex");
  const valid = received.length === expected.length && timingSafeEqual(received, expected);
  if (valid) attempts.delete(key);
  else attempts.set(key, { ...state, count: state.count + 1 });
  return { valid, rateLimited: false };
}

async function readTracker(includeArchived: boolean, archivedOnly = false) {
  const pool = getPostgresPool();
  const [trainees, reports] = await Promise.all([
    pool.query<TraineeRow>(
      `select id,personnel_id,name,started_course,ground_school,flight_school,sere,cxc_test,flight,joining_hammer,
              phase1_adjustment,phase2_adjustment,notes,
              sort_order,active,created_at,updated_at
       from public.hammer_ridealong_trainees
       where ($2 and not active) or (not $2 and (active or $1))
       order by active desc,sort_order,lower(name)`,
      [includeArchived, archivedOnly],
    ),
    pool.query<ReportRow>(
      `select reports.id,reports.trainee_id,reports.phase,reports.operation_type,reports.zeus,
              reports.pilot_supervisor,reports.activity,reports.occurred_on,reports.created_at
       from public.hammer_ridealong_reports reports
       join public.hammer_ridealong_trainees trainees on trainees.id=reports.trainee_id
       where ($2 and not trainees.active) or (not $2 and (trainees.active or $1))
       order by reports.occurred_on,reports.created_at`,
      [includeArchived, archivedOnly],
    ),
  ]);
  return { trainees: trainees.rows, reports: reports.rows };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    if (url.searchParams.get("form") === "1") {
      if (!hasFormAccess(request)) return error("Ridealong form password required", 401);
      const tracker = await readTracker(false);
      return NextResponse.json({ unlocked: true, trainees: tracker.trainees.map(({ id, name }) => ({ id, name })) }, { headers: { "Cache-Control": "no-store" } });
    }

    const [edit, full] = await Promise.all([
      requirePageAccess(request, "admin.hammer-ridealongs", "edit").catch(() => null),
      requirePageAccess(request, "admin.hammer-ridealongs", "full").catch(() => null),
    ]);
    const archivedOnly = url.searchParams.get("archive") === "1";
    const includeArchived = !archivedOnly && url.searchParams.get("archived") === "1" && Boolean(edit);
    const tracker = await readTracker(includeArchived, archivedOnly);
    const personnel = edit ? await getPostgresPool().query<PersonnelOption>(
      `select personnel.id,personnel.name,personnel.birth_number,ranks.name rank_name
         from public.personnel personnel
         left join public.ranks ranks on ranks.id=personnel.rank_id
        where lower(coalesce(personnel.status,'active')) not in ('retired','removed','transferred')
        order by lower(personnel.name)`,
    ) : null;
    return NextResponse.json({
      ...tracker,
      trainees: tracker.trainees.map((trainee) => ({
        ...trainee,
        notes: edit ? trainee.notes : "",
      })),
      personnel: personnel?.rows || [],
      permissions: { canEdit: Boolean(edit), canFull: Boolean(full) },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (caught) {
    console.error("[hammer-ridealongs] Read failed", caught);
    return error("Unable to load the Hammer ridealong tracker", 500);
  }
}

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return error("Invalid request origin", 403);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const action = cleanText(body?.action, 40);

  if (action === "unlock") {
    const password = cleanText(body?.password, 256);
    const result = verifyPassword(request, password);
    if (result.rateLimited) return error("Too many password attempts. Try again later.", 429);
    if (!result.valid) return error("Incorrect password", 401);
    const expiry = String(Date.now() + ACCESS_DURATION_MS);
    const signature = signAccess(expiry);
    if (!signature) return error("Ridealong form access is not configured", 503);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(ACCESS_COOKIE, `${expiry}.${signature}`, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    return response;
  }

  if (action === "submit") {
    if (!hasFormAccess(request)) return error("Ridealong form password required", 401);
    const traineeId = cleanUuid(body?.traineeId);
    const phase = Number(body?.phase);
    const operationType = cleanText(body?.operationType, 20);
    const zeus = cleanText(body?.zeus, 120);
    const pilotSupervisor = cleanText(body?.pilotSupervisor, 120);
    const activity = cleanText(body?.activity, 30);
    const occurredOn = cleanDate(body?.occurredOn);
    if (!traineeId || ![1, 2].includes(phase) || !["mainop", "funop", "training"].includes(operationType)
      || !zeus || !pilotSupervisor || !["ball-gunning", "flying"].includes(activity) || !occurredOn) {
      return error("Complete every ridealong field before submitting");
    }
    try {
      const inserted = await getPostgresPool().query<{ id: string }>(
        `insert into public.hammer_ridealong_reports
          (trainee_id,phase,operation_type,zeus,pilot_supervisor,activity,occurred_on)
         select id,$2,$3,$4,$5,$6,$7 from public.hammer_ridealong_trainees
         where id=$1 and active=true returning id`,
        [traineeId, phase, operationType, zeus, pilotSupervisor, activity, occurredOn],
      );
      if (!inserted.rowCount) return error("That trainee is no longer available", 404);
      return NextResponse.json({ ok: true, id: inserted.rows[0].id });
    } catch (caught) {
      console.error("[hammer-ridealongs] Submission failed", caught);
      return error("Unable to save the ridealong report", 500);
    }
  }

  const auth = await requirePageAccess(request, "admin.hammer-ridealongs", "edit").catch(() => null);
  if (!auth) return error("Edit Hammer Ridealong Tracker access is required", 403);

  try {
    if (action === "create-trainee") {
      const personnelId = cleanUuid(body?.personnelId);
      const startedCourse = body?.startedCourse ? cleanDate(body.startedCourse) : null;
      const joiningHammer = body?.joiningHammer === true;
      const groundSchool = cleanMilestone(body?.groundSchool) || "Not Complete";
      const flightSchool = cleanMilestone(body?.flightSchool) || "Not Complete";
      const cxcTest = cleanMilestone(body?.cxcTest) || "Not Complete";
      const requestedFlight = cleanText(body?.flight, 20);
      const flight = joiningHammer && FLIGHTS.has(requestedFlight) ? requestedFlight : "";
      const sere = joiningHammer ? cleanMilestone(body?.sere) : "Waived";
      if (!personnelId || (body?.startedCourse && !startedCourse) || (joiningHammer && !sere) || !FLIGHTS.has(requestedFlight)) return error("Select an active personnel profile and valid progression options");
      await withPostgresTransaction(async (client) => {
        const personnel = await client.query<{ name: string }>(
          `select name from public.personnel
            where id=$1 and lower(coalesce(status,'active')) not in ('retired','removed','transferred')
            for share`, [personnelId],
        );
        if (!personnel.rowCount) throw new Error("PERSONNEL_NOT_ACTIVE");
        const name = personnel.rows[0].name;
        const next = await client.query<{ value: number }>("select coalesce(max(sort_order),-1)+1 value from public.hammer_ridealong_trainees");
        await client.query(
          `insert into public.hammer_ridealong_trainees
            (personnel_id,name,started_course,ground_school,flight_school,sere,cxc_test,joining_hammer,flight,sort_order,updated_by)
           values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [personnelId, name, startedCourse, groundSchool, flightSchool, sere, cxcTest, joiningHammer, flight, next.rows[0].value, auth.userId],
        );
        await client.query("insert into public.audit_logs(user_id,action,details) values($1,'HAMMER_TRAINEE_CREATED',$2)", [auth.userId, `Added ${name} to the Hammer ridealong tracker`]);
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "update-trainee") {
      const id = cleanUuid(body?.id);
      const personnelId = cleanUuid(body?.personnelId);
      const startedCourse = body?.startedCourse ? cleanDate(body.startedCourse) : null;
      const joiningHammer = body?.joiningHammer === true;
      const groundSchool = cleanMilestone(body?.groundSchool);
      const flightSchool = cleanMilestone(body?.flightSchool);
      const sere = joiningHammer ? cleanMilestone(body?.sere) : "Waived";
      const cxcTest = cleanMilestone(body?.cxcTest);
      const requestedFlight = cleanText(body?.flight, 20);
      if (!id || !personnelId || (body?.startedCourse && !startedCourse) || !groundSchool || !flightSchool || !sere || !cxcTest || !FLIGHTS.has(requestedFlight)) return error("Select valid trainee and progression options");
      const personnel = await getPostgresPool().query<{ name: string }>(
        `select name from public.personnel
          where id=$1 and lower(coalesce(status,'active')) not in ('retired','removed','transferred')`, [personnelId],
      );
      if (!personnel.rowCount) return error("The selected personnel profile is no longer active", 409);
      const name = personnel.rows[0].name;
      const values = [
        id,
        name,
        startedCourse,
        groundSchool,
        flightSchool,
        sere,
        cxcTest,
        joiningHammer ? requestedFlight : "",
        String(body?.notes || "").trim().slice(0, 2000),
        auth.userId,
        joiningHammer,
        personnelId,
      ];
      const updated = await getPostgresPool().query(
        `update public.hammer_ridealong_trainees set name=$2,started_course=$3,ground_school=$4,
                flight_school=$5,sere=$6,cxc_test=$7,flight=$8,notes=$9,updated_by=$10,
                joining_hammer=$11,personnel_id=$12,updated_at=now()
         where id=$1`, values,
      );
      if (!updated.rowCount) return error("Trainee not found", 404);
      await getPostgresPool().query("insert into public.audit_logs(user_id,action,details) values($1,'HAMMER_TRAINEE_UPDATED',$2)", [auth.userId, `Updated Hammer trainee profile: ${name}`]);
      return NextResponse.json({ ok: true });
    }

    if (action === "set-active") {
      const id = cleanUuid(body?.id);
      const active = body?.active === true;
      if (!id) return error("Invalid trainee");
      const updated = await getPostgresPool().query<{ name: string }>(
        "update public.hammer_ridealong_trainees set active=$2,updated_by=$3,updated_at=now() where id=$1 returning name",
        [id, active, auth.userId],
      );
      if (!updated.rowCount) return error("Trainee not found", 404);
      await getPostgresPool().query("insert into public.audit_logs(user_id,action,details) values($1,$2,$3)", [auth.userId, active ? "HAMMER_TRAINEE_RESTORED" : "HAMMER_TRAINEE_ARCHIVED", `${active ? "Restored" : "Archived"} Hammer trainee: ${updated.rows[0].name}`]);
      return NextResponse.json({ ok: true });
    }

    if (action === "update-report") {
      const id = cleanUuid(body?.id);
      const traineeId = cleanUuid(body?.traineeId);
      const phase = Number(body?.phase);
      const operationType = cleanText(body?.operationType, 20);
      const zeus = cleanText(body?.zeus, 120);
      const pilotSupervisor = cleanText(body?.pilotSupervisor, 120);
      const activity = cleanText(body?.activity, 30);
      const occurredOn = cleanDate(body?.occurredOn);
      if (!id || !traineeId || ![1, 2].includes(phase) || !["mainop", "funop", "training"].includes(operationType)
        || !zeus || !pilotSupervisor || !["ball-gunning", "flying"].includes(activity) || !occurredOn) {
        return error("Complete every ridealong response field");
      }
      const updated = await getPostgresPool().query<{ name: string }>(
        `update public.hammer_ridealong_reports reports
            set trainee_id=trainees.id,phase=$3,operation_type=$4,zeus=$5,
                pilot_supervisor=$6,activity=$7,occurred_on=$8
           from public.hammer_ridealong_trainees trainees
          where reports.id=$1 and trainees.id=$2 and trainees.active=true
          returning trainees.name`,
        [id, traineeId, phase, operationType, zeus, pilotSupervisor, activity, occurredOn],
      );
      if (!updated.rowCount) return error("Response or active trainee not found", 404);
      await getPostgresPool().query(
        "insert into public.audit_logs(user_id,action,details) values($1,'HAMMER_RIDEALONG_UPDATED',$2)",
        [auth.userId, `Corrected a Phase ${phase} ridealong response for ${updated.rows[0].name}`],
      );
      return NextResponse.json({ ok: true });
    }

    if (action === "set-ridealong-counts") {
      const id = cleanUuid(body?.id);
      const phase1Total = Number(body?.phase1Total);
      const phase2Total = Number(body?.phase2Total);
      if (!id || !Number.isInteger(phase1Total) || !Number.isInteger(phase2Total)
        || phase1Total < 0 || phase1Total > 99 || phase2Total < 0 || phase2Total > 99) {
        return error("Enter valid Phase 1 and Phase 2 totals between 0 and 99");
      }
      const result = await withPostgresTransaction(async (client) => {
        const trainee = await client.query<{ name: string; phase1_adjustment: number; phase2_adjustment: number }>(
          `select name,phase1_adjustment,phase2_adjustment
             from public.hammer_ridealong_trainees where id=$1 for update`, [id],
        );
        if (!trainee.rowCount) throw new Error("TRAINEE_NOT_FOUND");
        const submitted = await client.query<{ phase: number; count: number }>(
          `select phase,count(*)::integer count from public.hammer_ridealong_reports
            where trainee_id=$1 group by phase`, [id],
        );
        const submitted1 = submitted.rows.find((row) => row.phase === 1)?.count || 0;
        const submitted2 = submitted.rows.find((row) => row.phase === 2)?.count || 0;
        const current1 = Math.max(0, submitted1 + trainee.rows[0].phase1_adjustment);
        const current2 = Math.max(0, submitted2 + trainee.rows[0].phase2_adjustment);
        if (current1 === phase1Total && current2 === phase2Total) return { changed: false };
        await client.query(
          `update public.hammer_ridealong_trainees
              set phase1_adjustment=$2,phase2_adjustment=$3,updated_by=$4,updated_at=now()
            where id=$1`,
          [id, phase1Total - submitted1, phase2Total - submitted2, auth.userId],
        );
        await client.query(
          `insert into public.audit_logs(user_id,action,details)
           values($1,'HAMMER_RIDEALONG_TOTALS_ADJUSTED',$2)`,
          [auth.userId, `Manually adjusted ${trainee.rows[0].name} ridealong totals: Phase 1 ${current1} to ${phase1Total}; Phase 2 ${current2} to ${phase2Total}. Submitted forms: Phase 1 ${submitted1}, Phase 2 ${submitted2}.`],
        );
        return { changed: true };
      });
      return NextResponse.json({ ok: true, changed: result.changed });
    }

    if (action === "delete-report") {
      const id = cleanUuid(body?.id);
      if (!id) return error("Invalid ridealong report");
      const removed = await getPostgresPool().query<{ name: string }>(
        `delete from public.hammer_ridealong_reports reports using public.hammer_ridealong_trainees trainees
         where reports.id=$1 and trainees.id=reports.trainee_id returning trainees.name`, [id],
      );
      if (!removed.rowCount) return error("Ridealong report not found", 404);
      await getPostgresPool().query("insert into public.audit_logs(user_id,action,details) values($1,'HAMMER_RIDEALONG_REMOVED',$2)", [auth.userId, `Removed a ridealong report for ${removed.rows[0].name}`]);
      return NextResponse.json({ ok: true });
    }

    if (action === "delete-trainee") {
      const full = await requirePageAccess(request, "admin.hammer-ridealongs", "full").catch(() => null);
      if (!full) return error("Full Hammer Ridealong Tracker access is required", 403);
      const id = cleanUuid(body?.id);
      if (!id) return error("Invalid trainee");
      const removed = await getPostgresPool().query<{ name: string }>("delete from public.hammer_ridealong_trainees where id=$1 returning name", [id]);
      if (!removed.rowCount) return error("Trainee not found", 404);
      await getPostgresPool().query("insert into public.audit_logs(user_id,action,details) values($1,'HAMMER_TRAINEE_DELETED',$2)", [auth.userId, `Permanently deleted Hammer trainee: ${removed.rows[0].name}`]);
      return NextResponse.json({ ok: true });
    }

    return error("Unsupported action");
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "";
    const code = caught && typeof caught === "object" && "code" in caught ? String(caught.code) : "";
    if (message === "PERSONNEL_NOT_ACTIVE") return error("The selected personnel profile is no longer active", 409);
    if (message === "TRAINEE_NOT_FOUND") return error("Trainee not found", 404);
    if (code === "23505" && message.includes("hammer_ridealong_trainees_personnel_idx")) return error("That personnel profile is already on the Hammer tracker", 409);
    if (message.includes("hammer_ridealong_trainees_name_idx")) return error("A trainee with that name already exists", 409);
    console.error("[hammer-ridealongs] Admin action failed", caught);
    return error("Unable to update the Hammer ridealong tracker", 500);
  }
}
