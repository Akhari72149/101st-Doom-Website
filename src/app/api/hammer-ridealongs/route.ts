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

type TraineeRow = {
  id: string;
  name: string;
  started_course: string | null;
  ground_school: string;
  flight_school: string;
  sere: string;
  cxc_test: string;
  flight: string;
  joining_hammer: boolean;
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

async function readTracker(includeArchived: boolean) {
  const pool = getPostgresPool();
  const [trainees, reports] = await Promise.all([
    pool.query<TraineeRow>(
      `select id,name,started_course,ground_school,flight_school,sere,cxc_test,flight,joining_hammer,notes,
              sort_order,active,created_at,updated_at
       from public.hammer_ridealong_trainees
       where active or $1
       order by active desc,sort_order,lower(name)`,
      [includeArchived],
    ),
    pool.query<ReportRow>(
      `select reports.id,reports.trainee_id,reports.phase,reports.operation_type,reports.zeus,
              reports.pilot_supervisor,reports.activity,reports.occurred_on,reports.created_at
       from public.hammer_ridealong_reports reports
       join public.hammer_ridealong_trainees trainees on trainees.id=reports.trainee_id
       where trainees.active or $1
       order by reports.occurred_on,reports.created_at`,
      [includeArchived],
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
    const includeArchived = url.searchParams.get("archived") === "1" && Boolean(edit);
    const tracker = await readTracker(includeArchived);
    return NextResponse.json({
      ...tracker,
      trainees: tracker.trainees.map((trainee) => ({
        ...trainee,
        notes: edit ? trainee.notes : "",
      })),
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
      const name = cleanText(body?.name, 100);
      const startedCourse = body?.startedCourse ? cleanDate(body.startedCourse) : null;
      const joiningHammer = body?.joiningHammer === true;
      const flight = joiningHammer ? cleanText(body?.flight, 100) : "";
      const sere = joiningHammer ? cleanText(body?.sere, 160) : "Waived";
      if (!name || (body?.startedCourse && !startedCourse)) return error("Enter a valid trainee name and course date");
      await withPostgresTransaction(async (client) => {
        const next = await client.query<{ value: number }>("select coalesce(max(sort_order),-1)+1 value from public.hammer_ridealong_trainees");
        await client.query(
          `insert into public.hammer_ridealong_trainees
            (name,started_course,joining_hammer,flight,sere,sort_order,updated_by)
           values($1,$2,$3,$4,$5,$6,$7)`,
          [name, startedCourse, joiningHammer, flight, sere, next.rows[0].value, auth.userId],
        );
        await client.query("insert into public.audit_logs(user_id,action,details) values($1,'HAMMER_TRAINEE_CREATED',$2)", [auth.userId, `Added ${name} to the Hammer ridealong tracker`]);
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "update-trainee") {
      const id = cleanUuid(body?.id);
      const name = cleanText(body?.name, 100);
      const startedCourse = body?.startedCourse ? cleanDate(body.startedCourse) : null;
      const joiningHammer = body?.joiningHammer === true;
      if (!id || !name || (body?.startedCourse && !startedCourse)) return error("Enter valid trainee details");
      const values = [
        id,
        name,
        startedCourse,
        cleanText(body?.groundSchool, 160),
        cleanText(body?.flightSchool, 160),
        joiningHammer ? cleanText(body?.sere, 160) : "Waived",
        cleanText(body?.cxcTest, 160),
        joiningHammer ? cleanText(body?.flight, 100) : "",
        String(body?.notes || "").trim().slice(0, 2000),
        auth.userId,
        joiningHammer,
      ];
      const updated = await getPostgresPool().query(
        `update public.hammer_ridealong_trainees set name=$2,started_course=$3,ground_school=$4,
                flight_school=$5,sere=$6,cxc_test=$7,flight=$8,notes=$9,updated_by=$10,
                joining_hammer=$11,updated_at=now()
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
    if (message.includes("hammer_ridealong_trainees_name_idx")) return error("A trainee with that name already exists", 409);
    console.error("[hammer-ridealongs] Admin action failed", caught);
    return error("Unable to update the Hammer ridealong tracker", 500);
  }
}
