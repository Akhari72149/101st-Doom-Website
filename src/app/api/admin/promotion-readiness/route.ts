import { NextResponse } from "next/server";
import { resolveAdminActor } from "@/lib/admin-actor";
import { broadcastWebsiteAction } from "@/lib/broadcastWebsiteAction";
import { getPostgresPool, withPostgresTransaction } from "@/lib/postgres/pool";
import { resolvePromotionLeadership } from "@/lib/promotion-leadership";
import { requestHasSameOrigin, requirePageAccess } from "@/lib/route-permissions";
import { ATTENDANCE_ACCOUNTING_START } from "@/lib/attendance-periods";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PromotionRule = {
  from: string[];
  target: string;
  targetAliases?: string[];
  minimumTigDays?: number;
  minimumAttendance?: number;
  minimumServiceDays?: number;
  minimumDaysFromCt?: number;
  minimumAttendances?: number;
  minimumMainOps?: number;
  requiresSlot?: boolean;
  requiresAlphaPilotSlot?: boolean;
  approvalPermission?: "company";
  manual?: string[];
};

type PersonnelRow = {
  id: string;
  name: string;
  birth_number: string;
  rank_id: string | null;
  discord_id: string | null;
  slotted_position: string | null;
  current_rank: string | null;
  tig_days: number;
  service_days: number;
  days_from_ct: number | null;
  attended: number;
  missed: number;
  main_ops_attended: number;
  main_ops_missed: number;
};

type CriterionState = "met" | "not-met" | "review" | "unavailable";

type SetupIssue = {
  key: string;
  label: string;
  detail: string;
};

const rules: PromotionRule[] = [
  { from: ["CR", "Clone Recruit"], target: "CR-C", minimumAttendances: 4, minimumMainOps: 1 },
  { from: ["CR-C", "Clone Cadet"], target: "CT", minimumAttendances: 4, minimumMainOps: 1, manual: ["BCT completion"] },
  { from: ["CT", "Clone Trooper"], target: "PTC", targetAliases: ["CT/PTC"], minimumTigDays: 60, minimumAttendance: 50, requiresSlot: true },
  { from: ["PTC", "CT/PTC"], target: "PSC", targetAliases: ["CT/PSC"], minimumTigDays: 80, minimumAttendance: 50, minimumServiceDays: 140, requiresSlot: true },
  { from: ["PSC", "CT/PSC"], target: "PFC", targetAliases: ["CT/PFC"], minimumTigDays: 100, minimumAttendance: 50, minimumServiceDays: 240, requiresSlot: true },
  { from: ["PFC", "CT/PFC"], target: "CST", minimumTigDays: 125, minimumAttendance: 50, minimumDaysFromCt: 365, requiresSlot: true },
  { from: ["CST"], target: "CVT", targetAliases: ["VCT"], minimumTigDays: 100, minimumAttendance: 70, minimumServiceDays: 465, requiresSlot: true },
  { from: ["CVT", "VCT"], target: "CSP", minimumTigDays: 120, minimumAttendance: 80, requiresSlot: true, manual: ["Company approval"] },
  { from: ["CSP"], target: "CTS", minimumTigDays: 145, minimumAttendance: 90, requiresSlot: true, approvalPermission: "company" },
  { from: ["CTS"], target: "LCP", requiresSlot: true, manual: ["Appointment to a Corporal NCO billet"] },
  { from: ["LCP"], target: "CP", manual: ["Corporals Course completion"] },
  { from: ["CP"], target: "CSC", targetAliases: ["CPS"], minimumTigDays: 100, minimumAttendance: 50, requiresSlot: true },
  { from: ["CSC", "CPS"], target: "CVC", minimumTigDays: 120, minimumAttendance: 70, requiresSlot: true },
  { from: ["CVC"], target: "CMC", minimumTigDays: 145, minimumAttendance: 80, requiresSlot: true, manual: ["Company approval"] },
  { from: ["CMC"], target: "CFC", minimumTigDays: 165, minimumAttendance: 90, requiresSlot: true, manual: ["Company approval", "Selection by Platoon HQ"] },
  { from: ["CFC"], target: "LCS", requiresSlot: true, manual: ["Appointment to a Sergeant NCO billet"] },
  { from: ["LCS"], target: "CS", manual: ["Sergeants Course completion", "Corporals Course when required"] },
  { from: ["CS"], target: "CSS", minimumTigDays: 100, minimumAttendance: 50, requiresSlot: true },
  { from: ["CSS"], target: "CGS", minimumTigDays: 120, minimumAttendance: 70, requiresSlot: true },
  { from: ["CGS"], target: "CMS", minimumTigDays: 145, minimumAttendance: 80, requiresSlot: true, manual: ["Company approval"] },
  { from: ["CMS"], target: "CFS", minimumTigDays: 165, minimumAttendance: 90, requiresSlot: true, manual: ["Company approval", "Selection by Platoon HQ"] },
  { from: ["CFS"], target: "CSM", manual: ["CSM Course completion", "Corporal and Sergeant courses when required"] },
  { from: ["CSM"], target: "SSM", minimumTigDays: 200, minimumAttendance: 80, requiresSlot: true, manual: ["Company approval"] },
  { from: ["SSM"], target: "BSM", manual: ["Battalion command selection", "Rank is not currently in active use"] },
  { from: ["CXC", "CX-C"], target: "CX", minimumTigDays: 90, minimumAttendance: 75, requiresSlot: true, manual: ["CX Course completion"] },
  { from: ["CX"], target: "CSX", minimumTigDays: 150, minimumAttendance: 75, requiresSlot: true, manual: ["VTOL qualification", "Platoon approval"] },
  { from: ["CSX"], target: "CVX", minimumTigDays: 120, minimumAttendance: 80, requiresSlot: true, manual: ["Platoon approval"] },
  { from: ["CVX", "CX-V"], target: "CXX", targetAliases: ["CX-X"], minimumTigDays: 125, minimumAttendance: 80, requiresSlot: true },
  { from: ["CXX", "CX-X"], target: "CXT", targetAliases: ["CX-T"], minimumTigDays: 180, minimumAttendance: 90, requiresSlot: true, approvalPermission: "company" },
  { from: ["CXT", "CX-T"], target: "CXP", targetAliases: ["CX-P"], requiresAlphaPilotSlot: true, manual: ["Corporals Course completion"] },
  { from: ["CXP", "CX-P"], target: "CXS", manual: ["Sergeants Course completion"] },
  { from: ["CXS"], target: "CXSS", minimumTigDays: 125, minimumAttendance: 75, requiresSlot: true },
  { from: ["CXSS"], target: "CXMS", minimumTigDays: 145, minimumAttendance: 80, requiresSlot: true, manual: ["Company approval"] },
  { from: ["CXMS"], target: "CXM", manual: ["CSM Course completion"] },
  { from: ["CE", "Clone Ensign"], target: "Clone 2nd Lieutenant", manual: ["OCS completion", "Prior leadership courses when required"] },
  { from: ["Clone 2nd Lieutenant"], target: "Clone 1st Lieutenant", manual: ["Command review"] },
  { from: ["Clone 1st Lieutenant"], target: "Clone Captain", manual: ["Captains Course completion", "OCS when required", "Company appointment"] },
  { from: ["Clone Captain"], target: "CMaj.", targetAliases: ["Clone Major"], manual: ["Selection by the Unit Owner"] },
];

const terminalRanks = new Set([
  "CXM",
  "CXO",
  "CX-O",
  "CMAJ.",
  "CLONE MAJOR",
  "BC",
  "BATTALION COMMANDER",
  "CLONE BATTALION COMMANDER",
  "CLONE COMMANDER",
  "CWO",
  "COMMAND WARRANT OFFICER",
]);

const normalize = (value: string | null | undefined) => (value || "").trim().toUpperCase();
const RECRUIT_PROMOTION_ROLE_ID = "704516430531395634";
const DEFAULT_PROMOTION_FALLBACK_ROLE_ID = "813525376906821642";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function criterion(key: string, label: string, current: string, target: string, state: CriterionState) {
  return { key, label, current, target, state };
}

export async function GET(request: Request) {
  try {
    const pool = getPostgresPool();
    const [personnelResult, ranksResult, windowResult, announcementResult] = await Promise.all([
      pool.query<PersonnelRow>(`
        with attendance as (
          select personnel_id,
                 count(*) filter (where status = 'Y')::integer attended,
                 count(*) filter (where status = 'N')::integer missed,
                 count(*) filter (where status = 'Y' and lower(coalesce(type, '')) = 'mainop')::integer main_ops_attended,
                 count(*) filter (where status = 'N' and lower(coalesce(type, '')) = 'mainop')::integer main_ops_missed
            from public.attendance_records
           where coalesce(cycle_end_date, created_at::date) >= date '${ATTENDANCE_ACCOUNTING_START}'
           group by personnel_id
        ), operation_counts as (
          select submissions.personnel_id,
                 count(*) filter (where submissions.attendance_type='mainop')::integer main_ops,
                 least(3,count(*) filter (where submissions.attendance_type<>'mainop'))::integer non_main_credits
            from public.operation_count_submissions submissions
            join public.personnel current_personnel on current_personnel.id=submissions.personnel_id
            join public.ranks current_rank on current_rank.id=current_personnel.rank_id
           where ((upper(current_rank.name)='CR' and submissions.rank_stage='CR')
               or (upper(current_rank.name)='CR-C' and submissions.rank_stage in ('CR','CR-C')))
           group by submissions.personnel_id
        ), ct_dates as (
          select history.personnel_id, min(history.changed_at) ct_effective_at
            from public.rank_history history
            join public.ranks history_rank on history_rank.id = history.new_rank_id
           where upper(history_rank.name) = 'CT'
           group by history.personnel_id
        )
        select personnel.id, personnel.name, personnel.birth_number, personnel.rank_id,
               personnel.discord_id, personnel.slotted_position,
               ranks.name current_rank,
               greatest(0, floor(extract(epoch from (now() - coalesce(
                 personnel.rank_effective_at,
                 personnel.created_at at time zone 'UTC'
               ))) / 86400))::integer tig_days,
               greatest(0, floor(extract(epoch from (now() - personnel.created_at at time zone 'UTC')) / 86400))::integer service_days,
               case when ct_dates.ct_effective_at is null then null else
                 greatest(0, floor(extract(epoch from (now() - ct_dates.ct_effective_at)) / 86400))::integer
               end days_from_ct,
               case when upper(coalesce(ranks.name,'')) in ('CR','CR-C')
                    then coalesce(operation_counts.main_ops,0)+coalesce(operation_counts.non_main_credits,0)
                    else coalesce(attendance.attended,0) end::integer attended,
               coalesce(attendance.missed, 0)::integer missed,
               case when upper(coalesce(ranks.name,'')) in ('CR','CR-C')
                    then coalesce(operation_counts.main_ops,0)
                    else coalesce(attendance.main_ops_attended,0) end::integer main_ops_attended,
               coalesce(attendance.main_ops_missed, 0)::integer main_ops_missed
          from public.personnel personnel
          left join public.ranks ranks on ranks.id = personnel.rank_id
          left join attendance on attendance.personnel_id = personnel.id
          left join operation_counts on operation_counts.personnel_id=personnel.id
          left join ct_dates on ct_dates.personnel_id = personnel.id
         where lower(coalesce(personnel.status, 'active')) not in ('retired', 'removed', 'transferred')
         order by personnel.name
      `),
      pool.query<{ id: string; name: string }>("select id,name from public.ranks where is_active = true order by rank_level, name"),
      pool.query<{ first_record: string | null; last_record: string | null; periods: number }>(`
        select min(coalesce(cycle_end_date,created_at::date)) first_record,
               max(coalesce(cycle_end_date,created_at::date)) last_record,
               count(distinct (attendance_month, week_number, type))::integer periods
          from public.attendance_records
          where coalesce(cycle_end_date, created_at::date) >= date '${ATTENDANCE_ACCOUNTING_START}'
      `),
      pool.query<{ announcements_enabled: boolean; pending_announcements: number }>(`
        select settings.announcements_enabled,
               count(outbox.id)::integer pending_announcements
          from public.promotion_announcement_settings settings
          left join public.discord_role_outbox outbox
            on outbox.event_type = 'PROMOTION_READY'
           and outbox.status in ('pending','processing')
         where settings.singleton = true
         group by settings.announcements_enabled
      `),
    ]);

    const configuredRanksByName = new Map(ranksResult.rows.map((row) => [normalize(row.name), row]));
    const people = personnelResult.rows.map((person) => {
      const rule = rules.find((candidate) => candidate.from.some((name) => normalize(name) === normalize(person.current_rank)));
      const consideredAttendance = person.main_ops_attended + person.main_ops_missed;
      const attendancePercentage = consideredAttendance > 0
        ? Math.round((person.main_ops_attended / consideredAttendance) * 1000) / 10
        : null;

      if (!rule) {
        const rankLabel = person.current_rank || "Unranked personnel";
        if (person.current_rank && terminalRanks.has(normalize(person.current_rank))) {
          return {
            ...person,
            attendancePercentage,
            targetRank: null,
            targetRankId: null,
            targetConfigured: true,
            approvalPermission: null,
            status: "terminal",
            criteria: [],
            setupIssues: [],
          };
        }
        const setupIssues: SetupIssue[] = person.current_rank
          ? [{
              key: `route:${normalize(person.current_rank)}`,
              label: `Define progression from ${rankLabel}`,
              detail: `Add the next rank and promotion requirements for ${rankLabel} to the Promotion Readiness rules.`,
            }]
          : [{
              key: "rank:unassigned",
              label: "Assign a current rank",
              detail: "Assign a current rank in Ranks & Slots before promotion readiness can be calculated.",
            }];
        return {
          ...person,
          attendancePercentage,
          targetRank: null,
          targetRankId: null,
          targetConfigured: false,
          approvalPermission: null,
          status: "setup-required",
          criteria: [],
          setupIssues,
        };
      }

      const criteria = [];
      if (rule.minimumTigDays !== undefined) {
        criteria.push(criterion("tig", "Time in grade", `${person.tig_days} days`, `${rule.minimumTigDays} days`, person.tig_days >= rule.minimumTigDays ? "met" : "not-met"));
      }
      if (rule.minimumAttendance !== undefined) {
        const state = attendancePercentage === null ? "unavailable" : attendancePercentage >= rule.minimumAttendance ? "met" : "not-met";
        criteria.push(criterion("attendance", "MainOp attendance", attendancePercentage === null ? "No accountable MainOps" : `${attendancePercentage}% (${person.main_ops_attended}/${consideredAttendance})`, `${rule.minimumAttendance}%`, state));
      }
      if (rule.minimumServiceDays !== undefined) {
        criteria.push(criterion("service", "Total service", `${person.service_days} days`, `${rule.minimumServiceDays} days`, person.service_days >= rule.minimumServiceDays ? "met" : "not-met"));
      }
      if (rule.minimumDaysFromCt !== undefined) {
        const state = person.days_from_ct === null ? "unavailable" : person.days_from_ct >= rule.minimumDaysFromCt ? "met" : "not-met";
        criteria.push(criterion("ct-service", "Time since CT", person.days_from_ct === null ? "CT date unavailable" : `${person.days_from_ct} days`, `${rule.minimumDaysFromCt} days`, state));
      }
      if (rule.minimumAttendances !== undefined) {
        criteria.push(criterion("operations", "Operation-count credits", `${person.attended} / ${rule.minimumAttendances}`, `${rule.minimumAttendances} total; maximum 3 non-MainOps`, person.attended >= rule.minimumAttendances ? "met" : "not-met"));
      }
      if (rule.minimumMainOps !== undefined) {
        criteria.push(criterion("main-ops", "MainOp count", `${person.main_ops_attended}`, `${rule.minimumMainOps} required`, person.main_ops_attended >= rule.minimumMainOps ? "met" : "not-met"));
      }
      if (rule.requiresSlot) {
        criteria.push(criterion("slot", "Slotted member", person.slotted_position || "Not slotted", "Required", person.slotted_position ? "met" : "not-met"));
      }
      if (rule.requiresAlphaPilotSlot) {
        const alphaPilot = /(?:^|[-_\s])(?:alpha|\d+a)(?:$|[-_\s])/i.test(person.slotted_position || "");
        criteria.push(criterion("alpha-pilot-slot", "Alpha pilot billet", person.slotted_position || "Not slotted", "Required for the pilot NCO route", alphaPilot ? "met" : "not-met"));
      }
      for (const [index, requirement] of (rule.manual || []).entries()) {
        criteria.push(criterion(`manual-${index}`, requirement, "Requires review", "Command confirmation", "review"));
      }
      if (rule.approvalPermission === "company") {
        criteria.push(criterion("company-approval", "Company approval", "Pending approval", "Company authorised", "review"));
      }

      const hasBlocker = criteria.some((item) => item.state === "not-met" || item.state === "unavailable");
      const hasManualReview = criteria.some((item) => item.state === "review");
      const targetNames = [rule.target, ...(rule.targetAliases || [])];
      const configuredTarget = targetNames.map((name) => configuredRanksByName.get(normalize(name))).find(Boolean);
      const targetConfigured = Boolean(configuredTarget);
      const targetRankId = configuredTarget?.id || null;
      const setupIssues: SetupIssue[] = targetConfigured ? [] : [{
        key: `target:${normalize(rule.target)}`,
        label: `Create or activate ${rule.target}`,
        detail: `${rule.target} must exist as an active rank in Admin > Rank Management before this progression can be evaluated.`,
      }];
      const status = !targetConfigured ? "setup-required" : hasBlocker ? "in-progress" : hasManualReview ? "review" : "ready";

      return {
        ...person,
        attendancePercentage,
        targetRank: configuredTarget?.name || rule.target,
        targetRankId,
        targetConfigured,
        status,
        approvalPermission: rule.approvalPermission || null,
        criteria,
        setupIssues,
      };
    });

    const summary = {
      ready: people.filter((person) => person.status === "ready").length,
      review: people.filter((person) => person.status === "review").length,
      inProgress: people.filter((person) => person.status === "in-progress").length,
      needsSetup: people.filter((person) => person.status === "setup-required").length,
      terminal: people.filter((person) => person.status === "terminal").length,
    };
    const setupIssueMap = new Map<string, SetupIssue & { affected: number }>();
    for (const person of people) {
      for (const issue of person.setupIssues) {
        const existing = setupIssueMap.get(issue.key);
        setupIssueMap.set(issue.key, {
          ...issue,
          affected: (existing?.affected || 0) + 1,
        });
      }
    }
    const setupIssues = [...setupIssueMap.values()].sort((left, right) =>
      right.affected - left.affected || left.label.localeCompare(right.label)
    );

    const [canPromote, canCompanyApprove] = await Promise.all([
      requirePageAccess(request, "admin.promotion-readiness", "edit").then(Boolean).catch(() => false),
      requirePageAccess(request, "admin.promotion-readiness-company-approval", "edit").then(Boolean).catch(() => false),
    ]);
    const readyPeople = people.filter((person) =>
      (person.status === "ready" || (person.status === "review" && person.approvalPermission === "company"))
      && person.rank_id
      && person.targetRankId,
    );
    if (readyPeople.length) {
      const occupants = (await pool.query<{ slotted_position: string | null; discord_id: string | null }>(
        `select slotted_position,discord_id from public.personnel
          where lower(coalesce(status,'active')) not in ('retired','removed','transferred')`,
      )).rows;
      for (const person of readyPeople) {
        const recruitPromotion = ["CR", "CR-C"].includes(normalize(person.current_rank || ""));
        const companyApprovalRequired = person.approvalPermission === "company";
        const leadershipDiscordIds = recruitPromotion
          ? []
          : resolvePromotionLeadership(person.slotted_position, occupants, person.discord_id);
        await pool.query(
          "select public.enqueue_promotion_ready_notification($1,$2,$3,$4::jsonb)",
          [person.id, person.rank_id, person.targetRankId, JSON.stringify({
            targetPersonnelId: person.id,
            discordId: person.discord_id,
            personnelName: person.name,
            oldRankName: person.current_rank || "Unranked",
            rankName: person.targetRank,
            tigDays: person.tig_days,
            attendancePercentage: person.attendancePercentage,
            companyApprovalRequired,
            leadershipDiscordIds,
            leadershipRoleIds: recruitPromotion
              ? [RECRUIT_PROMOTION_ROLE_ID]
              : companyApprovalRequired || !leadershipDiscordIds.length
                ? [DEFAULT_PROMOTION_FALLBACK_ROLE_ID]
                : [],
          })],
        );
      }
    }

    const announcementIssues = canPromote
      ? (await pool.query<{
          id: string;
          status: "pending" | "processing" | "dead";
          attempt_count: number;
          last_error: string | null;
          created_at: string;
          updated_at: string;
          personnel_name: string;
          old_rank_name: string;
          new_rank_name: string;
        }>(`
          select id,status,attempt_count,last_error,created_at,updated_at,
                 coalesce(payload->>'personnelName','Unknown Member') personnel_name,
                 coalesce(payload->>'oldRankName','Unknown') old_rank_name,
                 coalesce(payload->>'rankName','Unknown') new_rank_name
            from public.discord_role_outbox
           where event_type='PROMOTION_READY'
             and status in ('pending','processing','dead')
           order by case status when 'dead' then 0 when 'processing' then 1 else 2 end,
                    created_at
        `)).rows
      : [];

    return NextResponse.json({
      people: people.map((person) => ({
        ...person,
        canPromote: person.approvalPermission === "company"
          ? canCompanyApprove && person.status === "review"
          : canPromote && person.status === "ready",
      })),
      summary,
      setupIssues,
      canPromote,
      announcementControl: {
        enabled: announcementResult.rows[0]?.announcements_enabled ?? false,
        pending: announcementResult.rows[0]?.pending_announcements ?? 0,
      },
      announcementIssues,
      attendanceWindow: {
        ...(windowResult.rows[0] || { first_record: null, last_record: null, periods: 0 }),
        startsAt: ATTENDANCE_ACCOUNTING_START,
      },
      calculatedAt: new Date().toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[promotion-readiness] Read failed", error);
    return NextResponse.json({ error: "Failed to calculate promotion readiness" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }
  const [standardAuth, companyAuth] = await Promise.all([
    requirePageAccess(request, "admin.promotion-readiness", "edit").catch(() => null),
    requirePageAccess(request, "admin.promotion-readiness-company-approval", "edit").catch(() => null),
  ]);
  const auth = standardAuth || companyAuth;
  if (!auth) return NextResponse.json({ error: "Promotion permission is required" }, { status: 403 });
  const body = await request.json().catch(() => null) as {
    personnelId?: string;
    action?: string;
    enabled?: unknown;
  } | null;
  if (body?.action === "set-announcements") {
    if (!standardAuth) {
      return NextResponse.json({ error: "Promotion action permission is required" }, { status: 403 });
    }
    if (typeof body.enabled !== "boolean") {
      return NextResponse.json({ error: "Select a valid announcement state" }, { status: 400 });
    }
    try {
      const updated = await getPostgresPool().query<{ announcements_enabled: boolean }>(`
        update public.promotion_announcement_settings
           set announcements_enabled=$1,updated_at=now(),updated_by=$2
         where singleton=true
         returning announcements_enabled
      `, [body.enabled, auth.userId]);
      if (!updated.rows[0]) throw new Error("SETTING_MISSING");
      return NextResponse.json({
        ok: true,
        announcementsEnabled: updated.rows[0].announcements_enabled,
      });
    } catch (error) {
      console.error("[promotion-readiness] Announcement control failed", error);
      return NextResponse.json({ error: "Failed to update promotion announcements" }, { status: 500 });
    }
  }
  const personnelId = String(body?.personnelId || "");
  if (!UUID.test(personnelId)) return NextResponse.json({ error: "Invalid personnel record" }, { status: 400 });

  try {
    const actor = await resolveAdminActor(auth);
    const notification = await withPostgresTransaction(async (client) => {
      const result = await client.query<PersonnelRow>(`
        with attendance as (
          select personnel_id,
                 count(*) filter (where status='Y')::integer attended,
                 count(*) filter (where status='N')::integer missed,
                 count(*) filter (where status='Y' and lower(coalesce(type,''))='mainop')::integer main_ops_attended,
                 count(*) filter (where status='N' and lower(coalesce(type,''))='mainop')::integer main_ops_missed
            from public.attendance_records
           where personnel_id=$1 and coalesce(cycle_end_date,created_at::date)>=date '${ATTENDANCE_ACCOUNTING_START}'
           group by personnel_id
        ), operation_counts as (
          select submissions.personnel_id,
                 count(*) filter (where submissions.attendance_type='mainop')::integer main_ops,
                 least(3,count(*) filter (where submissions.attendance_type<>'mainop'))::integer non_main_credits
            from public.operation_count_submissions submissions
           where submissions.personnel_id=$1
             and ((submissions.rank_stage='CR' and exists(select 1 from public.personnel p join public.ranks r on r.id=p.rank_id where p.id=$1 and upper(r.name)='CR'))
               or (submissions.rank_stage in ('CR','CR-C') and exists(select 1 from public.personnel p join public.ranks r on r.id=p.rank_id where p.id=$1 and upper(r.name)='CR-C')))
           group by submissions.personnel_id
        ), ct_dates as (
          select history.personnel_id,min(history.changed_at) ct_effective_at
            from public.rank_history history join public.ranks history_rank on history_rank.id=history.new_rank_id
           where history.personnel_id=$1 and upper(history_rank.name)='CT' group by history.personnel_id
        )
        select personnel.id,personnel.name,personnel.birth_number,personnel.rank_id,personnel.discord_id,
               personnel.slotted_position,ranks.name current_rank,
               greatest(0,floor(extract(epoch from (now()-coalesce(personnel.rank_effective_at,personnel.created_at at time zone 'UTC')))/86400))::integer tig_days,
               greatest(0,floor(extract(epoch from (now()-personnel.created_at at time zone 'UTC'))/86400))::integer service_days,
               case when ct_dates.ct_effective_at is null then null else greatest(0,floor(extract(epoch from (now()-ct_dates.ct_effective_at))/86400))::integer end days_from_ct,
               case when upper(coalesce(ranks.name,'')) in ('CR','CR-C') then coalesce(operation_counts.main_ops,0)+coalesce(operation_counts.non_main_credits,0) else coalesce(attendance.attended,0) end::integer attended,
               coalesce(attendance.missed,0)::integer missed,
               case when upper(coalesce(ranks.name,'')) in ('CR','CR-C') then coalesce(operation_counts.main_ops,0) else coalesce(attendance.main_ops_attended,0) end::integer main_ops_attended,
               coalesce(attendance.main_ops_missed,0)::integer main_ops_missed
          from public.personnel personnel left join public.ranks ranks on ranks.id=personnel.rank_id
          left join attendance on attendance.personnel_id=personnel.id left join ct_dates on ct_dates.personnel_id=personnel.id
          left join operation_counts on operation_counts.personnel_id=personnel.id
         where personnel.id=$1 for update of personnel`, [personnelId]);
      const person = result.rows[0];
      if (!person || !person.rank_id) throw new Error("NOT_FOUND");
      const rule = rules.find((candidate) => candidate.from.some((name) => normalize(name) === normalize(person.current_rank)));
      if (!rule || rule.manual?.length) throw new Error("NOT_READY");
      if (rule.approvalPermission === "company" ? !companyAuth : !standardAuth) {
        throw new Error("FORBIDDEN");
      }
      const accountable = person.main_ops_attended + person.main_ops_missed;
      const attendance = accountable ? (person.main_ops_attended / accountable) * 100 : null;
      const alphaPilot = /(?:^|[-_\s])(?:alpha|\d+a)(?:$|[-_\s])/i.test(person.slotted_position || "");
      const ready = (rule.minimumTigDays === undefined || person.tig_days >= rule.minimumTigDays)
        && (rule.minimumAttendance === undefined || (attendance !== null && attendance >= rule.minimumAttendance))
        && (rule.minimumServiceDays === undefined || person.service_days >= rule.minimumServiceDays)
        && (rule.minimumDaysFromCt === undefined || (person.days_from_ct !== null && person.days_from_ct >= rule.minimumDaysFromCt))
        && (rule.minimumAttendances === undefined || person.attended >= rule.minimumAttendances)
        && (rule.minimumMainOps === undefined || person.main_ops_attended >= rule.minimumMainOps)
        && (!rule.requiresSlot || Boolean(person.slotted_position))
        && (!rule.requiresAlphaPilotSlot || alphaPilot);
      if (!ready) throw new Error("NOT_READY");
      const targetNames = [rule.target, ...(rule.targetAliases || [])].map(normalize);
      const target = await client.query<{ id: string; name: string }>(
        `select id,name from public.ranks where is_active=true and upper(btrim(name))=any($1::text[])
         order by array_position($1::text[],upper(btrim(name))) limit 1`, [targetNames]);
      if (!target.rows[0]) throw new Error("TARGET_MISSING");
      const promotedAt = new Date();
      await client.query("update public.personnel set rank_id=$2,rank_effective_at=$3 where id=$1", [person.id, target.rows[0].id, promotedAt]);
      await client.query(
        "insert into public.rank_history(personnel_id,discord_id,old_rank_id,new_rank_id,changed_at) values($1,$2,$3,$4,$5)",
        [person.id, person.discord_id || "", person.rank_id, target.rows[0].id, promotedAt],
      );
      await client.query("select public.enqueue_rank_role_sync($1,$2,$3)", [person.id, person.rank_id, target.rows[0].id]);
      await client.query(
        "insert into public.audit_logs(user_id,target_personnel_id,action,old_rank_id,target_rank_id,details,processed_by) values($1,$2,'RANK_CHANGED',$3,$4,$5,$6)",
        [auth.userId, person.id, person.rank_id, target.rows[0].id, `Promoted from Promotion Readiness by ${actor.displayName}`, actor.personnelId],
      );
      return {
        action: "RANK_CHANGED",
        target_personnel_id: person.id,
        personnelName: person.name,
        personnelDiscordId: person.discord_id,
        processedBy: actor.displayName,
        oldRankName: person.current_rank || "Unranked",
        rankName: target.rows[0].name,
      };
    });
    await broadcastWebsiteAction(notification);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "NOT_FOUND") return NextResponse.json({ error: "Personnel record was not found" }, { status: 404 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "The required promotion approval permission is missing" }, { status: 403 });
    if (message === "NOT_READY") return NextResponse.json({ error: "This person no longer meets every automatic requirement" }, { status: 409 });
    if (message === "TARGET_MISSING") return NextResponse.json({ error: "The target rank is not active" }, { status: 409 });
    console.error("[promotion-readiness] Promotion failed", error);
    return NextResponse.json({ error: "Failed to complete promotion" }, { status: 500 });
  }
}
