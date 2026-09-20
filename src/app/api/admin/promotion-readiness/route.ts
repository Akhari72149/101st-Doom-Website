import { NextResponse } from "next/server";
import { getPostgresPool } from "@/lib/postgres/pool";
import { requirePageAccess } from "@/lib/route-permissions";

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
  manual?: string[];
};

type PersonnelRow = {
  id: string;
  name: string;
  birth_number: string;
  slotted_position: string | null;
  current_rank: string | null;
  tig_days: number;
  service_days: number;
  days_from_ct: number | null;
  attended: number;
  missed: number;
  main_ops_attended: number;
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
  { from: ["CSP"], target: "CTS", minimumTigDays: 145, minimumAttendance: 90, requiresSlot: true, manual: ["Company approval"] },
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
  { from: ["CVX"], target: "CXX", targetAliases: ["CX-X"], minimumTigDays: 125, minimumAttendance: 80, requiresSlot: true },
  { from: ["CXX", "CX-X"], target: "CXT", targetAliases: ["CX-T"], minimumTigDays: 180, minimumAttendance: 90, requiresSlot: true },
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

function criterion(key: string, label: string, current: string, target: string, state: CriterionState) {
  return { key, label, current, target, state };
}

export async function GET(request: Request) {
  if (!(await requirePageAccess(request, "admin.promotion-readiness", "read").catch(() => null))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const pool = getPostgresPool();
    const [personnelResult, ranksResult, windowResult] = await Promise.all([
      pool.query<PersonnelRow>(`
        with attendance as (
          select personnel_id,
                 count(*) filter (where status = 'Y')::integer attended,
                 count(*) filter (where status = 'N')::integer missed,
                 count(*) filter (where status = 'Y' and type = 'MainOp')::integer main_ops_attended
            from public.attendance_records
           group by personnel_id
        ), ct_dates as (
          select history.personnel_id, min(history.changed_at) ct_effective_at
            from public.rank_history history
            join public.ranks history_rank on history_rank.id = history.new_rank_id
           where upper(history_rank.name) = 'CT'
           group by history.personnel_id
        )
        select personnel.id, personnel.name, personnel.birth_number, personnel.slotted_position,
               ranks.name current_rank,
               greatest(0, floor(extract(epoch from (now() - coalesce(
                 personnel.rank_effective_at,
                 personnel.created_at at time zone 'UTC'
               ))) / 86400))::integer tig_days,
               greatest(0, floor(extract(epoch from (now() - personnel.created_at at time zone 'UTC')) / 86400))::integer service_days,
               case when ct_dates.ct_effective_at is null then null else
                 greatest(0, floor(extract(epoch from (now() - ct_dates.ct_effective_at)) / 86400))::integer
               end days_from_ct,
               coalesce(attendance.attended, 0)::integer attended,
               coalesce(attendance.missed, 0)::integer missed,
               coalesce(attendance.main_ops_attended, 0)::integer main_ops_attended
          from public.personnel personnel
          left join public.ranks ranks on ranks.id = personnel.rank_id
          left join attendance on attendance.personnel_id = personnel.id
          left join ct_dates on ct_dates.personnel_id = personnel.id
         where lower(coalesce(personnel.status, 'active')) not in ('retired', 'removed', 'transferred')
         order by personnel.name
      `),
      pool.query<{ name: string }>("select name from public.ranks where is_active = true order by rank_level, name"),
      pool.query<{ first_record: string | null; last_record: string | null; periods: number }>(`
        select min(created_at) first_record, max(created_at) last_record,
               count(distinct (attendance_month, week_number, type))::integer periods
          from public.attendance_records
      `),
    ]);

    const configuredRanks = new Set(ranksResult.rows.map((row) => normalize(row.name)));
    const people = personnelResult.rows.map((person) => {
      const rule = rules.find((candidate) => candidate.from.some((name) => normalize(name) === normalize(person.current_rank)));
      const consideredAttendance = person.attended + person.missed;
      const attendancePercentage = consideredAttendance > 0
        ? Math.round((person.attended / consideredAttendance) * 1000) / 10
        : null;

      if (!rule) {
        const rankLabel = person.current_rank || "Unranked personnel";
        if (person.current_rank && terminalRanks.has(normalize(person.current_rank))) {
          return {
            ...person,
            attendancePercentage,
            targetRank: null,
            targetConfigured: true,
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
          targetConfigured: false,
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
        criteria.push(criterion("attendance", "Attendance", attendancePercentage === null ? "No accountable records" : `${attendancePercentage}% (${person.attended}/${consideredAttendance})`, `${rule.minimumAttendance}%`, state));
      }
      if (rule.minimumServiceDays !== undefined) {
        criteria.push(criterion("service", "Total service", `${person.service_days} days`, `${rule.minimumServiceDays} days`, person.service_days >= rule.minimumServiceDays ? "met" : "not-met"));
      }
      if (rule.minimumDaysFromCt !== undefined) {
        const state = person.days_from_ct === null ? "unavailable" : person.days_from_ct >= rule.minimumDaysFromCt ? "met" : "not-met";
        criteria.push(criterion("ct-service", "Time since CT", person.days_from_ct === null ? "CT date unavailable" : `${person.days_from_ct} days`, `${rule.minimumDaysFromCt} days`, state));
      }
      if (rule.minimumAttendances !== undefined) {
        criteria.push(criterion("operations", "Operations attended", `${person.attended}`, `${rule.minimumAttendances}`, person.attended >= rule.minimumAttendances ? "met" : "not-met"));
      }
      if (rule.minimumMainOps !== undefined) {
        criteria.push(criterion("main-ops", "Main Operations attended", `${person.main_ops_attended}`, `${rule.minimumMainOps}`, person.main_ops_attended >= rule.minimumMainOps ? "met" : "not-met"));
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

      const hasBlocker = criteria.some((item) => item.state === "not-met" || item.state === "unavailable");
      const hasManualReview = criteria.some((item) => item.state === "review");
      const targetNames = [rule.target, ...(rule.targetAliases || [])];
      const targetConfigured = targetNames.some((name) => configuredRanks.has(normalize(name)));
      const setupIssues: SetupIssue[] = targetConfigured ? [] : [{
        key: `target:${normalize(rule.target)}`,
        label: `Create or activate ${rule.target}`,
        detail: `${rule.target} must exist as an active rank in Admin > Rank Management before this progression can be evaluated.`,
      }];
      const status = !targetConfigured ? "setup-required" : hasBlocker ? "in-progress" : hasManualReview ? "review" : "ready";

      return {
        ...person,
        attendancePercentage,
        targetRank: rule.target,
        targetConfigured,
        status,
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

    return NextResponse.json({
      people,
      summary,
      setupIssues,
      attendanceWindow: windowResult.rows[0] || { first_record: null, last_record: null, periods: 0 },
      calculatedAt: new Date().toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[promotion-readiness] Read failed", error);
    return NextResponse.json({ error: "Failed to calculate promotion readiness" }, { status: 500 });
  }
}
