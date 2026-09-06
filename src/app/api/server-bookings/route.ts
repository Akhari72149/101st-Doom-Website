import { NextResponse } from "next/server";
import { pagePermissionDefinitions, type PagePermissionAccess } from "@/data/pagePermissions";
import { getAdminRouteAuth } from "@/lib/admin-route-auth";
import { getNativeSession } from "@/lib/postgres/auth";
import { getPostgresPool, withPostgresTransaction } from "@/lib/postgres/pool";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const PERMISSION_KEY = "operations.server-bookings";
const SERVER_IDS = new Set([1, 2, 3, 4, 5, 6]);
const DURATION_MS = new Set([60, 120, 240].map((minutes) => minutes * 60_000));
const ELIGIBLE_CERTIFICATION_IDS = [
  "0a559b7d-b2d4-4972-a2a7-a64d805d968e",
  "5d61393e-ce1e-40c9-b698-2526b020a486",
  "d6555eb7-3eac-4019-81cb-e11291437156",
  "a4316aa4-f69d-4265-aff0-0760614ff987",
];
const ACCESS_LEVELS: Record<PagePermissionAccess, number> = {
  none: 0,
  read: 1,
  edit: 2,
  full: 3,
};
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type BookingRow = {
  id: string;
  server_id: number;
  start_time: string;
  end_time: string;
  title: string | null;
  booked_for: string | null;
  personnel_name?: string | null;
};

type RecurringRow = {
  id: string;
  server_id: number;
  start_at: string | null;
  end_at: string | null;
  title: string | null;
};

type PersonnelRow = { id: string; name: string };

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

function databaseBackend() {
  const backend = process.env.SERVER_BOOKINGS_BACKEND || "supabase";
  if (backend !== "supabase" && backend !== "postgres") {
    throw new Error("Unknown SERVER_BOOKINGS_BACKEND");
  }
  return backend;
}

function hasRequiredAccess(level: string | null | undefined, required: "read" | "edit") {
  return (ACCESS_LEVELS[level as PagePermissionAccess] || 0) >= ACCESS_LEVELS[required];
}

async function getBookingAccess(request: Request) {
  if (process.env.NATIVE_AUTH_ENABLED === "true") {
    const session = await getNativeSession(request.headers).catch(() => null);
    if (!session) return { userId: null, canRead: true, canEdit: false };

    const [permission, roles] = await Promise.all([
      getPostgresPool().query<{ access_level: string }>(
        "select access_level from public.user_page_permissions where user_id = $1 and permission_key = $2",
        [session.user.id, PERMISSION_KEY],
      ),
      getPostgresPool().query<{ role: string }>(
        "select role from public.user_roles where user_id = $1",
        [session.user.id],
      ),
    ]);
    const level = permission.rows[0]?.access_level;
    const legacyRoles = new Set(
      pagePermissionDefinitions.find((entry) => entry.key === PERMISSION_KEY)?.legacyRoles || [],
    );
    const hasLegacyAccess = roles.rows.some((row) => legacyRoles.has(row.role.toLowerCase()));
    return {
      userId: session.user.id,
      canRead: true,
      canEdit: hasRequiredAccess(level, "edit") || hasLegacyAccess,
    };
  }

  const auth = await getAdminRouteAuth(request);
  if (!auth.userId) return { userId: null, canRead: true, canEdit: false };

  const { data } = await supabaseAdmin
    .from("user_page_permissions")
    .select("access_level")
    .eq("user_id", auth.userId)
    .eq("permission_key", PERMISSION_KEY)
    .maybeSingle();
  const legacyRoles = new Set(
    pagePermissionDefinitions.find((entry) => entry.key === PERMISSION_KEY)?.legacyRoles || [],
  );
  return {
    userId: auth.userId,
    canRead: true,
    canEdit:
      hasRequiredAccess(data?.access_level, "edit") ||
      auth.roles.some((role) => legacyRoles.has(role.toLowerCase())),
  };
}

function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const expected = process.env.APP_ORIGIN || new URL(request.url).origin;
  try {
    return new URL(origin).origin === new URL(expected).origin;
  } catch {
    return false;
  }
}

function parseWindow(request: Request) {
  const url = new URL(request.url);
  const serverId = Number(url.searchParams.get("serverId"));
  const start = new Date(url.searchParams.get("start") || "");
  const end = new Date(url.searchParams.get("end") || "");
  const length = end.getTime() - start.getTime();
  if (
    !SERVER_IDS.has(serverId) ||
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    length < 20 * 60 * 60 * 1000 ||
    length > 28 * 60 * 60 * 1000
  ) {
    return null;
  }
  return { serverId, start, end };
}

function serializeBooking(row: BookingRow) {
  return {
    id: row.id,
    server_id: row.server_id,
    start_time: new Date(row.start_time).toISOString(),
    end_time: new Date(row.end_time).toISOString(),
    title: row.title || "Server Booking",
    booked_for: row.booked_for || "",
    personnel: { name: row.personnel_name || "Unknown" },
  };
}

function serializeRecurring(row: RecurringRow) {
  if (!row.start_at || !row.end_at) return null;
  return {
    id: `recurring-${row.id}`,
    server_id: row.server_id,
    start_time: new Date(row.start_at).toISOString(),
    end_time: new Date(row.end_at).toISOString(),
    title: row.title || "System Block",
    booked_for: "SYSTEM",
    personnel: { name: "System Block" },
  };
}

async function readFromPostgres(serverId: number, start: Date, end: Date, includePersonnel: boolean) {
  const lookupEnd = new Date(end.getTime() + 4 * 60 * 60 * 1000);
  const [bookings, recurring, counts, personnel] = await Promise.all([
    getPostgresPool().query<BookingRow>(
      `select b.id, b.server_id, b.start_time, b.end_time, b.title, b.booked_for,
              p.name as personnel_name
         from public.server_bookings b
         left join public.personnel p on p.id = b.booked_for
        where b.server_id = $1 and b.start_time < $2 and b.end_time > $3
        order by b.start_time`,
      [serverId, lookupEnd, start],
    ),
    getPostgresPool().query<RecurringRow>(
      `select id, server_id, start_at, end_at, title
         from public.recurring_server_blocks
        where server_id = $1 and start_at < $2 and end_at > $3
        order by start_at`,
      [serverId, lookupEnd, start],
    ),
    getPostgresPool().query<{ server_id: number; count: number }>(
      `select server_id, count(*)::integer as count
         from (
           select server_id from public.server_bookings where start_time < $2 and end_time > $1
           union all
           select server_id from public.recurring_server_blocks where start_at < $2 and end_at > $1
         ) occupied
        where server_id between 1 and 6
        group by server_id`,
      [start, end],
    ),
    includePersonnel
      ? getPostgresPool().query<PersonnelRow>(
          `select distinct p.id, p.name
             from public.personnel p
             join public.personnel_certifications pc on pc.personnel_id = p.id
            where pc.certification_id = any($1::uuid[])
            order by p.name`,
          [ELIGIBLE_CERTIFICATION_IDS],
        )
      : Promise.resolve({ rows: [] as PersonnelRow[] }),
  ]);
  return {
    bookings: [...bookings.rows.map(serializeBooking), ...recurring.rows.map(serializeRecurring).filter(Boolean)],
    counts: Object.fromEntries(counts.rows.map((row) => [row.server_id, row.count])),
    personnel: personnel.rows,
  };
}

async function readFromSupabase(serverId: number, start: Date, end: Date, includePersonnel: boolean) {
  const lookupEnd = new Date(end.getTime() + 4 * 60 * 60 * 1000).toISOString();
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const [bookingsResult, recurringResult, countBookings, countRecurring, personnelResult] = await Promise.all([
    supabaseAdmin
      .from("server_bookings")
      .select("id,server_id,start_time,end_time,title,booked_for,personnel:booked_for(name)")
      .eq("server_id", serverId)
      .lt("start_time", lookupEnd)
      .gt("end_time", startIso)
      .order("start_time"),
    supabaseAdmin
      .from("recurring_server_blocks")
      .select("id,server_id,start_at,end_at,title")
      .eq("server_id", serverId)
      .lt("start_at", lookupEnd)
      .gt("end_at", startIso)
      .order("start_at"),
    supabaseAdmin.from("server_bookings").select("server_id").lt("start_time", endIso).gt("end_time", startIso),
    supabaseAdmin.from("recurring_server_blocks").select("server_id").lt("start_at", endIso).gt("end_at", startIso),
    includePersonnel
      ? supabaseAdmin
          .from("personnel")
          .select("id,name,personnel_certifications!inner(certification_id)")
          .in("personnel_certifications.certification_id", ELIGIBLE_CERTIFICATION_IDS)
          .order("name")
      : Promise.resolve({ data: [], error: null }),
  ]);
  const error =
    bookingsResult.error || recurringResult.error || countBookings.error || countRecurring.error || personnelResult.error;
  if (error) throw error;

  const counts: Record<number, number> = {};
  for (const row of [...(countBookings.data || []), ...(countRecurring.data || [])]) {
    counts[row.server_id] = (counts[row.server_id] || 0) + 1;
  }
  const bookings = (bookingsResult.data || []).map((row) => ({
    ...row,
    title: row.title || "Server Booking",
    booked_for: row.booked_for || "",
    personnel: Array.isArray(row.personnel) ? row.personnel[0] : row.personnel,
  }));
  const recurring = (recurringResult.data || [])
    .map((row) => serializeRecurring(row as RecurringRow))
    .filter(Boolean);
  return {
    bookings: [...bookings, ...recurring],
    counts,
    personnel: (personnelResult.data || []).map((row) => ({ id: row.id, name: row.name })),
  };
}

export async function GET(request: Request) {
  const window = parseWindow(request);
  if (!window) return jsonError("Invalid booking window", 400);
  try {
    const access = await getBookingAccess(request);
    const data =
      databaseBackend() === "postgres"
        ? await readFromPostgres(window.serverId, window.start, window.end, access.canEdit)
        : await readFromSupabase(window.serverId, window.start, window.end, access.canEdit);
    return NextResponse.json(
      { ...data, canEdit: access.canEdit },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[server-bookings] Read failed", error);
    return jsonError("Failed to load server bookings", 500);
  }
}

function parseCreateBody(value: unknown) {
  const body = value as Record<string, unknown> | null;
  const serverId = Number(body?.serverId);
  const bookedFor = String(body?.bookedFor || "").trim();
  const title = String(body?.title || "").trim() || "Server Booking";
  const start = new Date(String(body?.startTime || ""));
  const end = new Date(String(body?.endTime || ""));
  const duration = end.getTime() - start.getTime();
  if (
    !SERVER_IDS.has(serverId) ||
    !UUID_PATTERN.test(bookedFor) ||
    !title ||
    title.length > 100 ||
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    !DURATION_MS.has(duration) ||
    start.getUTCSeconds() !== 0 ||
    start.getUTCMilliseconds() !== 0 ||
    ![0, 30].includes(start.getUTCMinutes()) ||
    start.getTime() < Date.now() - 5 * 60_000 ||
    start.getTime() > Date.now() + 366 * 24 * 60 * 60_000
  ) {
    return null;
  }
  return { serverId, bookedFor, title, start, end };
}

async function createInPostgres(
  input: NonNullable<ReturnType<typeof parseCreateBody>>,
  userId: string,
) {
  return withPostgresTransaction(async (client) => {
    await client.query("select pg_advisory_xact_lock($1)", [72150000 + input.serverId]);
    const eligible = await client.query(
      `select 1 from public.personnel_certifications
        where personnel_id = $1 and certification_id = any($2::uuid[]) limit 1`,
      [input.bookedFor, ELIGIBLE_CERTIFICATION_IDS],
    );
    if (!eligible.rowCount) throw new Error("INELIGIBLE_PERSONNEL");
    const conflict = await client.query(
      `select 1
         from (
           select start_time as starts_at, end_time as ends_at
             from public.server_bookings where server_id = $1
           union all
           select start_at, end_at
             from public.recurring_server_blocks where server_id = $1
         ) occupied
        where $2 < ends_at and $3 > starts_at
        limit 1`,
      [input.serverId, input.start, input.end],
    );
    if (conflict.rowCount) throw new Error("BOOKING_CONFLICT");
    const inserted = await client.query<BookingRow>(
      `insert into public.server_bookings
         (server_id, user_id, booked_for, title, start_time, end_time)
       values ($1, $2, $3, $4, $5, $6)
       returning id, server_id, start_time, end_time, title, booked_for`,
      [input.serverId, userId, input.bookedFor, input.title, input.start, input.end],
    );
    return inserted.rows[0];
  });
}

async function createInSupabase(input: NonNullable<ReturnType<typeof parseCreateBody>>, userId: string) {
  const [eligible, bookingConflict, recurringConflict] = await Promise.all([
    supabaseAdmin
      .from("personnel_certifications")
      .select("id")
      .eq("personnel_id", input.bookedFor)
      .in("certification_id", ELIGIBLE_CERTIFICATION_IDS)
      .limit(1),
    supabaseAdmin
      .from("server_bookings")
      .select("id")
      .eq("server_id", input.serverId)
      .lt("start_time", input.end.toISOString())
      .gt("end_time", input.start.toISOString())
      .limit(1),
    supabaseAdmin
      .from("recurring_server_blocks")
      .select("id")
      .eq("server_id", input.serverId)
      .lt("start_at", input.end.toISOString())
      .gt("end_at", input.start.toISOString())
      .limit(1),
  ]);
  if (eligible.error || bookingConflict.error || recurringConflict.error) {
    throw eligible.error || bookingConflict.error || recurringConflict.error;
  }
  if (!eligible.data?.length) throw new Error("INELIGIBLE_PERSONNEL");
  if (bookingConflict.data?.length || recurringConflict.data?.length) throw new Error("BOOKING_CONFLICT");
  const { data, error } = await supabaseAdmin
    .from("server_bookings")
    .insert({
      server_id: input.serverId,
      user_id: userId,
      booked_for: input.bookedFor,
      title: input.title,
      start_time: input.start.toISOString(),
      end_time: input.end.toISOString(),
    })
    .select("id,server_id,start_time,end_time,title,booked_for")
    .single();
  if (error) throw error;
  return data;
}

export async function POST(request: Request) {
  if (!requireSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const access = await getBookingAccess(request).catch(() => null);
  if (!access?.userId) return jsonError("Unauthorized", 401);
  if (!access.canEdit) return jsonError("Forbidden", 403);
  const input = parseCreateBody(await request.json().catch(() => null));
  if (!input) return jsonError("Invalid booking details", 400);
  try {
    const booking =
      databaseBackend() === "postgres"
        ? await createInPostgres(input, access.userId)
        : await createInSupabase(input, access.userId);
    return NextResponse.json({ booking }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("BOOKING_CONFLICT") || message.includes("Booking overlaps")) {
      return jsonError("That booking overlaps an existing booking or block", 409);
    }
    if (message.includes("INELIGIBLE_PERSONNEL")) return jsonError("Selected personnel is not eligible", 400);
    console.error("[server-bookings] Create failed", error);
    return jsonError("Failed to create booking", 500);
  }
}

export async function DELETE(request: Request) {
  if (!requireSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const access = await getBookingAccess(request).catch(() => null);
  if (!access?.userId) return jsonError("Unauthorized", 401);
  if (!access.canEdit) return jsonError("Forbidden", 403);
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!UUID_PATTERN.test(id)) return jsonError("Invalid booking id", 400);
  try {
    if (databaseBackend() === "postgres") {
      const result = await getPostgresPool().query("delete from public.server_bookings where id = $1 returning id", [id]);
      if (!result.rowCount) return jsonError("Booking not found", 404);
    } else {
      const { data, error } = await supabaseAdmin.from("server_bookings").delete().eq("id", id).select("id").maybeSingle();
      if (error) throw error;
      if (!data) return jsonError("Booking not found", 404);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[server-bookings] Delete failed", error);
    return jsonError("Failed to cancel booking", 500);
  }
}
