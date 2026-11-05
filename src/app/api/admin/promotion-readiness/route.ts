import { NextResponse } from "next/server";
import { resolveAdminActor } from "@/lib/admin-actor";
import { broadcastWebsiteAction } from "@/lib/broadcastWebsiteAction";
import { getPostgresPool, withPostgresTransaction } from "@/lib/postgres/pool";
import { resolvePromotionFormation, resolvePromotionLeadership } from "@/lib/promotion-leadership";
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
  current_rank_role_id: string | null;
  tig_days: number;
  service_days: number;
  days_from_ct: number | null;
  ct_effective_at: string | null;
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

type CompanyApprovalRow = {
  id: string;
  personnel_id: string;
  from_rank_id: string;
  to_rank_id: string;
  approved_by_name: string;
  approved_at: string;
};

type RequirementConfirmationRow = {
  id: string;
  personnel_id: string;
  from_rank_id: string;
  to_rank_id: string;
  criterion_key: string;
  confirmed_by_name: string;
  confirmed_at: string;
  notes: string | null;
  evidence_url: string | null;
};

type ReadinessCriterion = {
  key: string;
  label: string;
  current: string;
  target: string;
  state: CriterionState;
  remaining?: string;
  projectedAt?: string;
  manual?: boolean;
  confirmation?: RequirementConfirmationRow | null;
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

function criterion(
  key: string,
  label: string,
  current: string,
  target: string,
  state: CriterionState,
  extra: Partial<ReadinessCriterion> = {},
): ReadinessCriterion {
  return { key, label, current, target, state, ...extra };
}

function futureDate(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + Math.max(0, days));
  return date.toISOString();
}

function attendanceNeeded(attended: number, total: number, target: number) {
  if (target >= 100) return attended >= total && total > 0 ? 0 : 1;
  return Math.max(0, Math.ceil(((target / 100) * total - attended) / (1 - target / 100)));
}

export async function GET(request: Request) {
  try {
    const pool = getPostgresPool();
    const [personnelResult, ranksResult, windowResult, announcementResult, companyApprovalsResult, confirmationsResult] = await Promise.all([
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
               ranks.name current_rank, ranks.discord_role_id current_rank_role_id,
               greatest(0, floor(extract(epoch from (now() - coalesce(
                 personnel.rank_effective_at,
                 personnel.created_at at time zone 'UTC'
               ))) / 86400))::integer tig_days,
               greatest(0, floor(extract(epoch from (now() - personnel.created_at at time zone 'UTC')) / 86400))::integer service_days,
                ct_dates.ct_effective_at,
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
      pool.query<{ id: string; name: string; discord_role_id: string | null }>("select id,name,discord_role_id from public.ranks where is_active = true order by rank_level, name"),
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
      pool.query<CompanyApprovalRow>(`
        select id,personnel_id,from_rank_id,to_rank_id,approved_by_name,approved_at
          from public.promotion_company_approvals
         where consumed_at is null and revoked_at is null
      `),
      pool.query<RequirementConfirmationRow>(`
        select id,personnel_id,from_rank_id,to_rank_id,criterion_key,confirmed_by_name,
               confirmed_at,notes,evidence_url
          from public.promotion_requirement_confirmations
         where revoked_at is null
      `),
    ]);

    const configuredRanksByName = new Map(ranksResult.rows.map((row) => [normalize(row.name), row]));
    const companyApprovals = new Map(companyApprovalsResult.rows.map((approval) => [
      `${approval.personnel_id}:${approval.from_rank_id}:${approval.to_rank_id}`,
      approval,
    ]));
    const confirmations = new Map(confirmationsResult.rows.map((confirmation) => [
      `${confirmation.personnel_id}:${confirmation.from_rank_id}:${confirmation.to_rank_id}:${confirmation.criterion_key}`,
      confirmation,
    ]));
    const occupants = personnelResult.rows.map((person) => ({
      slotted_position: person.slotted_position,
      discord_id: person.discord_id,
    }));
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
            companyApproval: null,
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
          companyApproval: null,
          status: "setup-required",
          criteria: [],
          setupIssues,
        };
      }

      const targetNames = [rule.target, ...(rule.targetAliases || [])];
      const configuredTarget = targetNames.map((name) => configuredRanksByName.get(normalize(name))).find(Boolean);
      const targetConfigured = Boolean(configuredTarget);
      const targetRankId = configuredTarget?.id || null;
      const formation = resolvePromotionFormation(person.slotted_position);
      const companyApproval = person.rank_id && targetRankId
        ? companyApprovals.get(`${person.id}:${person.rank_id}:${targetRankId}`) || null
        : null;
      const criteria: ReadinessCriterion[] = [];
      if (rule.minimumTigDays !== undefined) {
        const remaining = Math.max(0, rule.minimumTigDays - person.tig_days);
        criteria.push(criterion("tig", "Time in grade", `${person.tig_days} days`, `${rule.minimumTigDays} days`, remaining === 0 ? "met" : "not-met", remaining ? { remaining: `${remaining} TIG day${remaining === 1 ? "" : "s"} remaining`, projectedAt: futureDate(remaining) } : {}));
      }
      if (rule.minimumAttendance !== undefined) {
        const state = attendancePercentage === null ? "unavailable" : attendancePercentage >= rule.minimumAttendance ? "met" : "not-met";
        const needed = Math.max(1, attendanceNeeded(person.main_ops_attended, consideredAttendance, rule.minimumAttendance));
        criteria.push(criterion("attendance", "MainOp attendance", attendancePercentage === null ? "No accountable MainOps" : `${attendancePercentage}% (${person.main_ops_attended}/${consideredAttendance})`, `${rule.minimumAttendance}%`, state, state === "met" ? {} : { remaining: `Attend the next ${needed} accountable MainOp${needed === 1 ? "" : "s"} to reach the threshold` }));
      }
      if (rule.minimumServiceDays !== undefined) {
        const remaining = Math.max(0, rule.minimumServiceDays - person.service_days);
        criteria.push(criterion("service", "Total service", `${person.service_days} days`, `${rule.minimumServiceDays} days`, remaining === 0 ? "met" : "not-met", remaining ? { remaining: `${remaining} service day${remaining === 1 ? "" : "s"} remaining`, projectedAt: futureDate(remaining) } : {}));
      }
      if (rule.minimumDaysFromCt !== undefined) {
        const state = person.days_from_ct === null ? "unavailable" : person.days_from_ct >= rule.minimumDaysFromCt ? "met" : "not-met";
        const remaining = person.days_from_ct === null ? null : Math.max(0, rule.minimumDaysFromCt - person.days_from_ct);
        criteria.push(criterion("ct-service", "Time since CT", person.days_from_ct === null ? "CT date unavailable" : `${person.days_from_ct} days`, `${rule.minimumDaysFromCt} days`, state, remaining ? { remaining: `${remaining} day${remaining === 1 ? "" : "s"} from CT remaining`, projectedAt: futureDate(remaining) } : {}));
      }
      if (rule.minimumAttendances !== undefined) {
        const remaining = Math.max(0, rule.minimumAttendances - person.attended);
        criteria.push(criterion("operations", "Operation-count credits", `${person.attended} / ${rule.minimumAttendances}`, `${rule.minimumAttendances} total; maximum 3 non-MainOps`, remaining === 0 ? "met" : "not-met", remaining ? { remaining: `${remaining} operation credit${remaining === 1 ? "" : "s"} remaining` } : {}));
      }
      if (rule.minimumMainOps !== undefined) {
        const remaining = Math.max(0, rule.minimumMainOps - person.main_ops_attended);
        criteria.push(criterion("main-ops", "MainOp count", `${person.main_ops_attended}`, `${rule.minimumMainOps} required`, remaining === 0 ? "met" : "not-met", remaining ? { remaining: `${remaining} MainOp${remaining === 1 ? "" : "s"} remaining` } : {}));
      }
      if (rule.requiresSlot) {
        criteria.push(criterion("slot", "Slotted member", person.slotted_position || "Not slotted", "Required", person.slotted_position ? "met" : "not-met", person.slotted_position ? {} : { remaining: "Assign a formation slot" }));
      }
      if (rule.requiresAlphaPilotSlot) {
        const alphaPilot = /(?:^|[-_\s])(?:alpha|\d+a)(?:$|[-_\s])/i.test(person.slotted_position || "");
        criteria.push(criterion("alpha-pilot-slot", "Alpha pilot billet", person.slotted_position || "Not slotted", "Required for the pilot NCO route", alphaPilot ? "met" : "not-met", alphaPilot ? {} : { remaining: "Assign an Alpha pilot billet" }));
      }
      for (const [index, requirement] of (rule.manual || []).entries()) {
        const key = `manual-${index}`;
        const confirmation = person.rank_id && targetRankId
          ? confirmations.get(`${person.id}:${person.rank_id}:${targetRankId}:${key}`) || null
          : null;
        criteria.push(criterion(key, requirement, confirmation ? `Confirmed by ${confirmation.confirmed_by_name}` : "Requires review", "Command confirmation", confirmation ? "met" : "review", {
          manual: true,
          confirmation,
          remaining: confirmation ? undefined : `Confirm ${requirement}`,
        }));
      }
      if (rule.approvalPermission === "company") {
        criteria.push(criterion(
          "company-approval",
          "Company approval",
          companyApproval
            ? `Approved by ${companyApproval.approved_by_name}`
            : "Pending approval",
          "Company authorised",
          companyApproval ? "met" : "review",
        ));
      }

      const hasBlocker = criteria.some((item) => item.state === "not-met" || item.state === "unavailable");
      const hasManualReview = criteria.some((item) => item.state === "review");
      const setupIssues: SetupIssue[] = targetConfigured ? [] : [{
        key: `target:${normalize(rule.target)}`,
        label: `Create or activate ${rule.target}`,
        detail: `${rule.target} must exist as an active rank in Admin > Rank Management before this progression can be evaluated.`,
      }];
      const status = !targetConfigured ? "setup-required" : hasBlocker ? "in-progress" : hasManualReview ? "review" : "ready";
      const nextBlocker = criteria.find((item) => item.state !== "met") || null;
      const projectedDates = criteria.map((item) => typeof item.projectedAt === "string" ? item.projectedAt : null).filter((value): value is string => Boolean(value));
      const hasNonTimeBlocker = criteria.some((item) => item.state !== "met" && !item.projectedAt);
      const leadershipDiscordIds = ["CR", "CR-C"].includes(normalize(person.current_rank || ""))
        ? []
        : resolvePromotionLeadership(person.slotted_position, occupants, person.discord_id);

      return {
        ...person,
        attendancePercentage,
        targetRank: configuredTarget?.name || rule.target,
        targetRankId,
        targetConfigured,
        status,
        approvalPermission: rule.approvalPermission || null,
        companyApproval,
        formation: formation?.formation || "Unslotted",
        unit: formation?.unit || "Unslotted",
        formationRole: formation?.role || null,
        criteria,
        nextBlocker: nextBlocker ? { label: nextBlocker.label, detail: nextBlocker.remaining || nextBlocker.current, state: nextBlocker.state } : null,
        unmetCount: criteria.filter((item) => item.state !== "met").length,
        readinessScore: criteria.length ? Math.round((criteria.filter((item) => item.state === "met").length / criteria.length) * 100) : 0,
        projectedEligibility: !hasNonTimeBlocker && projectedDates.length
          ? projectedDates.sort().at(-1) || null
          : status === "ready" ? new Date().toISOString() : null,
        promotionPreview: {
          currentRoleId: person.current_rank_role_id,
          targetRoleId: configuredTarget?.discord_role_id || null,
          roleChange: person.current_rank_role_id === configuredTarget?.discord_role_id ? "none" : "replace",
          notificationRoute: ["CR", "CR-C"].includes(normalize(person.current_rank || ""))
            ? "Recruitment leadership role"
            : rule.approvalPermission === "company" || !leadershipDiscordIds.length
              ? "Company leadership role"
              : "Squad and platoon leadership",
          notificationRecipients: leadershipDiscordIds.length || 1,
        },
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

    const [canPromote, canCompanyApprove, canCorrectHistory] = await Promise.all([
      requirePageAccess(request, "admin.promotion-readiness", "edit").then(Boolean).catch(() => false),
      requirePageAccess(request, "admin.promotion-readiness-company-approval", "edit").then(Boolean).catch(() => false),
      requirePageAccess(request, "admin.promotion-readiness", "full").then(Boolean).catch(() => false),
    ]);
    const readyPeople = people.filter((person) =>
      (person.status === "ready" || (person.status === "review" && person.approvalPermission === "company"))
      && person.rank_id
      && person.targetRankId,
    );
    if (readyPeople.length) {
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
        criteria: person.criteria.map((item) => ({
          ...item,
          canConfirm: canPromote && item.manual === true && item.state === "review",
          canRevoke: canPromote && item.manual === true && item.state === "met" && Boolean(item.confirmation),
          canSetHistoricalDate: canCorrectHistory && item.key === "ct-service",
        })),
        canApprove: person.approvalPermission === "company"
          && canCompanyApprove
          && person.status === "review"
          && !person.companyApproval,
        canRevokeApproval: person.approvalPermission === "company"
          && canCompanyApprove
          && Boolean(person.companyApproval),
        canPromote: canPromote && person.status === "ready",
      })),
      summary,
      setupIssues,
      canPromote,
      canCompanyApprove,
      canCorrectHistory,
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
  const [standardAuth, companyAuth, fullAuth] = await Promise.all([
    requirePageAccess(request, "admin.promotion-readiness", "edit").catch(() => null),
    requirePageAccess(request, "admin.promotion-readiness-company-approval", "edit").catch(() => null),
    requirePageAccess(request, "admin.promotion-readiness", "full").catch(() => null),
  ]);
  const body = await request.json().catch(() => null) as {
    personnelId?: string;
    action?: string;
    enabled?: unknown;
    criterionKey?: string;
    notes?: string;
    evidenceUrl?: string;
    reason?: string;
    effectiveDate?: string;
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
      `, [body.enabled, standardAuth.userId]);
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
  if (body?.action === "set-ct-history") {
    if (!fullAuth) {
      return NextResponse.json({ error: "Full promotion readiness permission is required" }, { status: 403 });
    }
    const personnelId = String(body.personnelId || "");
    const reason = String(body.reason || "").trim();
    const evidenceUrl = String(body.evidenceUrl || "").trim();
    const effectiveDate = String(body.effectiveDate || "");
    if (!UUID.test(personnelId)) return NextResponse.json({ error: "Invalid personnel record" }, { status: 400 });
    if (reason.length < 5) return NextResponse.json({ error: "Enter a correction reason" }, { status: 400 });
    if (evidenceUrl && !/^https?:\/\//i.test(evidenceUrl)) {
      return NextResponse.json({ error: "Evidence must be a valid http or https link" }, { status: 400 });
    }
    const effectiveAt = /^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)
      ? new Date(`${effectiveDate}T12:00:00.000Z`)
      : new Date(Number.NaN);
    if (Number.isNaN(effectiveAt.getTime()) || effectiveAt > new Date() || effectiveAt < new Date("2010-01-01T00:00:00.000Z")) {
      return NextResponse.json({ error: "Select a valid historical CT date" }, { status: 400 });
    }
    try {
      const actor = await resolveAdminActor(fullAuth);
      const result = await withPostgresTransaction(async (client) => {
        const person = await client.query<{ name: string; discord_id: string | null }>(
          "select name,discord_id from public.personnel where id=$1 for update",
          [personnelId],
        );
        if (!person.rows[0]) throw new Error("NOT_FOUND");
        const ctRank = await client.query<{ id: string }>(
          "select id from public.ranks where upper(btrim(name))='CT' and is_active=true order by rank_level limit 1",
        );
        if (!ctRank.rows[0]) throw new Error("CT_RANK_MISSING");
        const existing = await client.query<{ id: string; changed_at: Date }>(
          `select id,changed_at from public.rank_history
            where personnel_id=$1 and new_rank_id=$2
            order by changed_at asc nulls last limit 1 for update`,
          [personnelId, ctRank.rows[0].id],
        );
        if (existing.rows[0]) {
          await client.query(
            `update public.rank_history
                set changed_at=$2,correction_reason=$3,evidence_url=$4,recorded_by_user_id=$5,
                    recorded_by_name=$6,recorded_at=now()
              where id=$1`,
            [existing.rows[0].id, effectiveAt, reason, evidenceUrl || null, fullAuth.userId, actor.displayName],
          );
        } else {
          await client.query(
            `insert into public.rank_history
               (personnel_id,discord_id,old_rank_id,new_rank_id,changed_at,correction_reason,evidence_url,
                recorded_by_user_id,recorded_by_name,recorded_at)
             values($1,$2,$3,$3,$4,$5,$6,$7,$8,now())`,
            [personnelId, person.rows[0].discord_id || "", ctRank.rows[0].id, effectiveAt, reason,
              evidenceUrl || null, fullAuth.userId, actor.displayName],
          );
        }
        const evidenceDetail = evidenceUrl ? ` Evidence: ${evidenceUrl}` : "";
        const previousDate = existing.rows[0]?.changed_at
          ? new Date(existing.rows[0].changed_at).toISOString().slice(0, 10)
          : null;
        const changeDetail = previousDate
          ? `Historical CT date changed from ${previousDate} to ${effectiveDate}`
          : `Historical CT date recorded as ${effectiveDate}`;
        await client.query(
          `insert into public.audit_logs
             (user_id,target_personnel_id,action,target_rank_id,details,processed_by)
           values($1,$2,'RANK_HISTORY_CORRECTED',$3,$4,$5)`,
          [fullAuth.userId, personnelId, ctRank.rows[0].id,
            `${changeDetail} by ${actor.displayName}. Reason: ${reason}.${evidenceDetail}`,
            actor.personnelId],
        );
        return { personnelName: person.rows[0].name, processedBy: actor.displayName, updated: Boolean(existing.rows[0]) };
      });
      return NextResponse.json({ ok: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message === "NOT_FOUND") return NextResponse.json({ error: "Personnel record was not found" }, { status: 404 });
      if (message === "CT_RANK_MISSING") return NextResponse.json({ error: "The active CT rank could not be found" }, { status: 409 });
      console.error("[promotion-readiness] Historical CT correction failed", error);
      return NextResponse.json({ error: "Failed to record the historical CT date" }, { status: 500 });
    }
  }
  const action = body?.action || "promote";
  const standardActions = new Set(["promote", "confirm-requirement", "revoke-requirement"]);
  const companyActions = new Set(["approve-company", "revoke-company"]);
  if (!standardActions.has(action) && !companyActions.has(action)) {
    return NextResponse.json({ error: "Invalid promotion action" }, { status: 400 });
  }
  const auth = companyActions.has(action) ? companyAuth : standardAuth;
  if (!auth) {
    return NextResponse.json({
      error: companyActions.has(action)
        ? "Company promotion approval permission is required"
        : "Promotion action permission is required",
    }, { status: 403 });
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
                ct_dates.ct_effective_at,
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
       if (!rule) throw new Error("NOT_READY");
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
       if ((action === "promote" || action === "approve-company") && !ready) throw new Error("NOT_READY");
      const targetNames = [rule.target, ...(rule.targetAliases || [])].map(normalize);
      const target = await client.query<{ id: string; name: string }>(
        `select id,name from public.ranks where is_active=true and upper(btrim(name))=any($1::text[])
         order by array_position($1::text[],upper(btrim(name))) limit 1`, [targetNames]);
      if (!target.rows[0]) throw new Error("TARGET_MISSING");
       const criterionKey = String(body?.criterionKey || "");
       const manualIndex = /^manual-(\d+)$/.exec(criterionKey);
       const manualRequirement = manualIndex ? rule.manual?.[Number(manualIndex[1])] : undefined;
       if (action === "confirm-requirement") {
         if (!manualRequirement) throw new Error("INVALID_REQUIREMENT");
         const evidenceUrl = String(body?.evidenceUrl || "").trim();
         if (evidenceUrl && !/^https?:\/\//i.test(evidenceUrl)) throw new Error("INVALID_EVIDENCE_URL");
         const confirmed = await client.query<{ id: string }>(`
           insert into public.promotion_requirement_confirmations
             (personnel_id,from_rank_id,to_rank_id,criterion_key,requirement_label,notes,evidence_url,
              confirmed_by_user_id,confirmed_by_personnel_id,confirmed_by_name)
           values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           on conflict (personnel_id,from_rank_id,to_rank_id,criterion_key) where revoked_at is null do nothing
           returning id
         `, [person.id, person.rank_id, target.rows[0].id, criterionKey, manualRequirement,
           String(body?.notes || "").trim() || null, evidenceUrl || null, auth.userId, actor.personnelId, actor.displayName]);
         if (!confirmed.rows[0]) throw new Error("ALREADY_CONFIRMED");
         await client.query(
           `insert into public.audit_logs(user_id,target_personnel_id,action,old_rank_id,target_rank_id,details,processed_by)
            values($1,$2,'PROMOTION_REQUIREMENT_CONFIRMED',$3,$4,$5,$6)`,
           [auth.userId, person.id, person.rank_id, target.rows[0].id, `${manualRequirement} confirmed by ${actor.displayName}`, actor.personnelId],
         );
         return { action: "PROMOTION_REQUIREMENT_CONFIRMED", target_personnel_id: person.id, personnelName: person.name, processedBy: actor.displayName };
       }
       if (action === "revoke-requirement") {
         if (!manualRequirement) throw new Error("INVALID_REQUIREMENT");
         const reason = String(body?.reason || "").trim();
         if (!reason) throw new Error("REASON_REQUIRED");
         const revoked = await client.query<{ id: string }>(`
           update public.promotion_requirement_confirmations
              set revoked_at=now(),revoked_by_user_id=$5,revoked_by_name=$6,revoke_reason=$7
            where personnel_id=$1 and from_rank_id=$2 and to_rank_id=$3 and criterion_key=$4 and revoked_at is null
            returning id
         `, [person.id, person.rank_id, target.rows[0].id, criterionKey, auth.userId, actor.displayName, reason]);
         if (!revoked.rows[0]) throw new Error("CONFIRMATION_MISSING");
         await client.query(
           `insert into public.audit_logs(user_id,target_personnel_id,action,old_rank_id,target_rank_id,details,processed_by)
            values($1,$2,'PROMOTION_REQUIREMENT_REVOKED',$3,$4,$5,$6)`,
           [auth.userId, person.id, person.rank_id, target.rows[0].id, `${manualRequirement} confirmation revoked by ${actor.displayName}: ${reason}`, actor.personnelId],
         );
         return { action: "PROMOTION_REQUIREMENT_REVOKED", target_personnel_id: person.id, personnelName: person.name, processedBy: actor.displayName };
       }
      if (action === "approve-company") {
        if (rule.approvalPermission !== "company") throw new Error("APPROVAL_NOT_REQUIRED");
        const approved = await client.query<{ id: string; approved_at: string }>(`
          insert into public.promotion_company_approvals
            (personnel_id,from_rank_id,to_rank_id,approved_by_user_id,approved_by_personnel_id,approved_by_name)
          values($1,$2,$3,$4,$5,$6)
           on conflict (personnel_id,from_rank_id,to_rank_id) where consumed_at is null and revoked_at is null do nothing
          returning id,approved_at
        `, [person.id, person.rank_id, target.rows[0].id, auth.userId, actor.personnelId, actor.displayName]);
        if (!approved.rows[0]) throw new Error("ALREADY_APPROVED");
        await client.query(
          `insert into public.audit_logs
             (user_id,target_personnel_id,action,old_rank_id,target_rank_id,details,processed_by)
           values($1,$2,'PROMOTION_COMPANY_APPROVED',$3,$4,$5,$6)`,
          [auth.userId, person.id, person.rank_id, target.rows[0].id, `Company promotion approval recorded by ${actor.displayName}`, actor.personnelId],
        );
        return {
          action: "PROMOTION_COMPANY_APPROVED",
          target_personnel_id: person.id,
          personnelName: person.name,
          processedBy: actor.displayName,
          oldRankName: person.current_rank || "Unranked",
          rankName: target.rows[0].name,
        };
      }
       if (action === "revoke-company") {
         if (rule.approvalPermission !== "company") throw new Error("APPROVAL_NOT_REQUIRED");
         const reason = String(body?.reason || "").trim();
         if (!reason) throw new Error("REASON_REQUIRED");
         const revoked = await client.query<{ id: string }>(`
           update public.promotion_company_approvals
              set revoked_at=now(),revoked_by_user_id=$4,revoked_by_name=$5,revoke_reason=$6
            where personnel_id=$1 and from_rank_id=$2 and to_rank_id=$3
              and consumed_at is null and revoked_at is null
            returning id
         `, [person.id, person.rank_id, target.rows[0].id, auth.userId, actor.displayName, reason]);
         if (!revoked.rows[0]) throw new Error("APPROVAL_MISSING");
         await client.query(
           `insert into public.audit_logs(user_id,target_personnel_id,action,old_rank_id,target_rank_id,details,processed_by)
            values($1,$2,'PROMOTION_COMPANY_APPROVAL_REVOKED',$3,$4,$5,$6)`,
           [auth.userId, person.id, person.rank_id, target.rows[0].id, `Company approval revoked by ${actor.displayName}: ${reason}`, actor.personnelId],
         );
         return { action: "PROMOTION_COMPANY_APPROVAL_REVOKED", target_personnel_id: person.id, personnelName: person.name, processedBy: actor.displayName };
       }
       if (rule.manual?.length) {
         const confirmed = await client.query<{ criterion_key: string }>(`
           select criterion_key from public.promotion_requirement_confirmations
            where personnel_id=$1 and from_rank_id=$2 and to_rank_id=$3 and revoked_at is null
         `, [person.id, person.rank_id, target.rows[0].id]);
         const confirmedKeys = new Set(confirmed.rows.map((row) => row.criterion_key));
         if (rule.manual.some((_, index) => !confirmedKeys.has(`manual-${index}`))) throw new Error("MANUAL_REQUIREMENTS_PENDING");
       }
      const companyApproval = rule.approvalPermission === "company"
        ? (await client.query<{ id: string; approved_by_name: string }>(`
            select id,approved_by_name
              from public.promotion_company_approvals
             where personnel_id=$1 and from_rank_id=$2 and to_rank_id=$3 and consumed_at is null and revoked_at is null
             for update
          `, [person.id, person.rank_id, target.rows[0].id])).rows[0]
        : null;
      if (rule.approvalPermission === "company" && !companyApproval) {
        throw new Error("COMPANY_APPROVAL_REQUIRED");
      }
      const promotedAt = new Date();
      await client.query("update public.personnel set rank_id=$2,rank_effective_at=$3 where id=$1", [person.id, target.rows[0].id, promotedAt]);
      await client.query(
        "insert into public.rank_history(personnel_id,discord_id,old_rank_id,new_rank_id,changed_at) values($1,$2,$3,$4,$5)",
        [person.id, person.discord_id || "", person.rank_id, target.rows[0].id, promotedAt],
      );
      await client.query("select public.enqueue_rank_role_sync($1,$2,$3)", [person.id, person.rank_id, target.rows[0].id]);
      if (companyApproval) {
        await client.query(
          "update public.promotion_company_approvals set consumed_at=$2,consumed_by_user_id=$3 where id=$1",
          [companyApproval.id, promotedAt, auth.userId],
        );
      }
      await client.query(
        "insert into public.audit_logs(user_id,target_personnel_id,action,old_rank_id,target_rank_id,details,processed_by) values($1,$2,'RANK_CHANGED',$3,$4,$5,$6)",
        [
          auth.userId,
          person.id,
          person.rank_id,
          target.rows[0].id,
          `Promoted from Promotion Readiness by ${actor.displayName}${companyApproval ? ` after company approval by ${companyApproval.approved_by_name}` : ""}`,
          actor.personnelId,
        ],
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
    if (notification.action === "RANK_CHANGED") await broadcastWebsiteAction(notification);
    return NextResponse.json({ ok: true, action: notification.action, processedBy: notification.processedBy });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "NOT_FOUND") return NextResponse.json({ error: "Personnel record was not found" }, { status: 404 });
    if (message === "NOT_READY") return NextResponse.json({ error: "This person no longer meets every automatic requirement" }, { status: 409 });
    if (message === "TARGET_MISSING") return NextResponse.json({ error: "The target rank is not active" }, { status: 409 });
    if (message === "APPROVAL_NOT_REQUIRED") return NextResponse.json({ error: "This promotion does not require company approval" }, { status: 409 });
    if (message === "ALREADY_APPROVED") return NextResponse.json({ error: "Company approval has already been recorded" }, { status: 409 });
    if (message === "COMPANY_APPROVAL_REQUIRED") return NextResponse.json({ error: "Company approval must be recorded before this promotion" }, { status: 409 });
    if (message === "INVALID_REQUIREMENT") return NextResponse.json({ error: "That manual requirement is not valid for this promotion" }, { status: 400 });
    if (message === "INVALID_EVIDENCE_URL") return NextResponse.json({ error: "Evidence must be a valid http or https link" }, { status: 400 });
    if (message === "ALREADY_CONFIRMED") return NextResponse.json({ error: "That requirement has already been confirmed" }, { status: 409 });
    if (message === "CONFIRMATION_MISSING") return NextResponse.json({ error: "That requirement confirmation is no longer active" }, { status: 409 });
    if (message === "APPROVAL_MISSING") return NextResponse.json({ error: "That company approval is no longer active" }, { status: 409 });
    if (message === "REASON_REQUIRED") return NextResponse.json({ error: "Enter a reason for the revocation" }, { status: 400 });
    if (message === "MANUAL_REQUIREMENTS_PENDING") return NextResponse.json({ error: "Every manual requirement must be confirmed before promotion" }, { status: 409 });
    console.error("[promotion-readiness] Promotion failed", error);
    return NextResponse.json({ error: "Failed to complete promotion" }, { status: 500 });
  }
}
