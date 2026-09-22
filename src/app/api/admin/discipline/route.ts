import { NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { getPostgresPool, withPostgresTransaction } from "@/lib/postgres/pool";
import { requestHasSameOrigin, requirePageAccess } from "@/lib/route-permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PERMISSION = "admin.discipline";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

type EvidenceInput = { label?: unknown; url?: unknown };
type ActionInput = { catalogActionId?: unknown; certificationIds?: unknown; details?: unknown };

function cleanText(value: unknown, max: number) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, max);
}

function validUrl(value: unknown) {
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function actionDetails(value: unknown) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const result: Record<string, string | number> = {};
  const textFields = [
    "instructions", "dueDate", "startsOn", "endsOn", "detachment", "certification",
    "certLead", "chainOfCommandApprover", "companyNcoicApprover", "scope",
    "assignedNco", "course",
  ];
  for (const field of textFields) {
    const text = cleanText(input[field], field === "instructions" ? 1000 : 180);
    if (text) result[field] = text;
  }
  for (const field of ["durationMonths", "operationCount"]) {
    const number = Number(input[field]);
    if (Number.isInteger(number) && number > 0 && number <= 120) result[field] = number;
  }
  for (const field of ["dueDate", "startsOn", "endsOn"]) {
    if (result[field] && !DATE.test(String(result[field]))) delete result[field];
  }
  if (result.scope && !["101st", "GARC", "Both"].includes(String(result.scope))) delete result.scope;
  return result;
}

async function appendEvent(client: PoolClient, caseId: string, eventType: string, details: string, actorId: string) {
  await client.query(
    `insert into public.disciplinary_case_events(case_id,event_type,details,actor_id)
     values($1,$2,$3,$4)`,
    [caseId, eventType, details, actorId],
  );
  await client.query(
    `insert into public.audit_logs(user_id,target_personnel_id,action,details)
     select $3,cases.personnel_id,$2,$4 from public.disciplinary_cases cases where cases.id=$1`,
    [caseId, `DISCIPLINE_${eventType}`, actorId, details],
  );
}

export async function GET(request: Request) {
  const auth = await requirePageAccess(request, PERMISSION, "read").catch(() => null);
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const pool = getPostgresPool();
    if (new URL(request.url).searchParams.get("summary") === "true") {
      const summary = await pool.query(`select
        (select count(*)::integer from public.disciplinary_cases where status='pending_approval') pending_approval,
        (select count(*)::integer from public.disciplinary_cases where status='appealed') open_appeals,
        (select count(*)::integer from public.disciplinary_case_actions actions
          join public.disciplinary_cases cases on cases.id=actions.case_id
          where actions.status='pending' and actions.due_at<now() and cases.status in ('active','appealed')) overdue_actions`);
      const row = summary.rows[0];
      return NextResponse.json({
        pendingApproval: row.pending_approval,
        openAppeals: row.open_appeals,
        overdueActions: row.overdue_actions,
        total: row.pending_approval + row.open_appeals + row.overdue_actions,
      }, { headers: { "Cache-Control": "no-store" } });
    }
    const [personnel, catalog, templates, cases, actions, approvals, appeals, evidence, events, bans, edit, full] = await Promise.all([
      pool.query(`select * from (
          select p.id,p.name,p.status,p.birth_number,false is_legacy,
            coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'discordRoleId',c.cert_id)
              order by c.name) filter (where c.id is not null),'[]'::jsonb) certifications
          from public.personnel p
          left join public.personnel_certifications pc on pc.personnel_id=p.id
          left join public.certifications c on c.id=pc.certification_id
          group by p.id,p.name,p.status,p.birth_number
          union all
          select legacy.id,legacy.display_name,'Legacy record',legacy.birth_number,true,'[]'::jsonb
          from public.disciplinary_legacy_subjects legacy
        ) subjects order by name`),
      pool.query(`select id,slug,name,category,description,active,created_at,updated_at
        from public.disciplinary_action_catalog order by category,name`),
      pool.query(`select id,name,case_kind,summary,reason,witnesses,appeal_wait_days,warning_expiry_days,actions,active,created_at,updated_at
        from public.disciplinary_case_templates order by active desc,name`),
      pool.query(`select cases.*,
          coalesce(personnel.name,legacy.display_name) personnel_name,
          coalesce(personnel.birth_number,legacy.birth_number) birth_number,
          coalesce(cases.personnel_id,cases.legacy_subject_id) profile_id,
          coalesce(nullif(cases.legacy_issuer_name,''),issuer."displayUsername",issuer.name,issuer.username,'Unknown') issuer_name,
          coalesce(approver."displayUsername",approver.name,approver.username) approver_name,
          case when cases.case_kind='warning' and cases.status='active' and cases.expires_at <= now()
            then 'expired' else cases.status end effective_status,
          count(*) filter(where cases.case_kind='warning' and cases.status='active'
            and cases.expires_at>now()) over(partition by coalesce(cases.personnel_id,cases.legacy_subject_id))::integer active_warning_count
        from public.disciplinary_cases cases
        left join public.personnel personnel on personnel.id=cases.personnel_id
        left join public.disciplinary_legacy_subjects legacy on legacy.id=cases.legacy_subject_id
        left join public.app_auth_users issuer on issuer.id=cases.issued_by
        left join public.app_auth_users approver on approver.id=cases.approved_by
        order by cases.created_at desc`),
      pool.query(`select actions.*,catalog.slug
        from public.disciplinary_case_actions actions
        left join public.disciplinary_action_catalog catalog on catalog.id=actions.catalog_action_id
        order by actions.created_at`),
      pool.query(`select approvals.*,
          coalesce(accounts."displayUsername",accounts.name,accounts.username,'Unknown') decided_by_name
        from public.disciplinary_approvals approvals
        left join public.app_auth_users accounts on accounts.id=approvals.decided_by
        order by approvals.decided_at desc`),
      pool.query(`select appeals.*,
          coalesce(submitter."displayUsername",submitter.name,submitter.username,'Unknown') submitted_by_name,
          coalesce(reviewer."displayUsername",reviewer.name,reviewer.username) reviewed_by_name
        from public.disciplinary_appeals appeals
        left join public.app_auth_users submitter on submitter.id=appeals.submitted_by
        left join public.app_auth_users reviewer on reviewer.id=appeals.reviewed_by
        order by appeals.submitted_at desc`),
      pool.query(`select * from public.disciplinary_evidence_links order by added_at`),
      pool.query(`select events.*,
          coalesce(accounts."displayUsername",accounts.name,accounts.username,'System') actor_name
        from public.disciplinary_case_events events
        left join public.app_auth_users accounts on accounts.id=events.actor_id
        order by events.created_at desc`),
      pool.query(`select bans.*,coalesce(bans.personnel_id,bans.legacy_subject_id) profile_id,
          coalesce(creator."displayUsername",creator.name,creator.username,'Unknown') created_by_name,
          coalesce(lifter."displayUsername",lifter.name,lifter.username) lifted_by_name
        from public.disciplinary_bans bans
        left join public.app_auth_users creator on creator.id=bans.created_by
        left join public.app_auth_users lifter on lifter.id=bans.lifted_by
        order by (bans.status='active') desc,bans.banned_on desc,bans.created_at desc`),
      requirePageAccess(request, PERMISSION, "edit").catch(() => null),
      requirePageAccess(request, PERMISSION, "full").catch(() => null),
    ]);

    return NextResponse.json({
      currentUserId: auth.userId,
      access: full ? "full" : edit ? "edit" : "read",
      personnel: personnel.rows,
      catalog: catalog.rows,
      templates: templates.rows,
      bans: bans.rows.map((row) => ({ ...row, personnel_id: row.profile_id })),
      cases: cases.rows.map((row) => ({
        ...row,
        personnel_id: row.profile_id,
        actions: actions.rows.filter((item) => item.case_id === row.id),
        approvals: approvals.rows.filter((item) => item.case_id === row.id),
        appeals: appeals.rows.filter((item) => item.case_id === row.id),
        evidence: evidence.rows.filter((item) => item.case_id === row.id),
        events: events.rows.filter((item) => item.case_id === row.id),
      })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[discipline] Read failed", error);
    return NextResponse.json({ error: "Failed to load disciplinary records" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const operation = cleanText(body?.operation, 40);
  const fullOnly = ["void-case", "catalog-add", "catalog-toggle", "template-save", "template-toggle", "lift-ban"].includes(operation);
  const auth = await requirePageAccess(request, PERMISSION, fullOnly ? "full" : "edit").catch(() => null);
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const actorId = auth.userId;
  if (!actorId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const result = await withPostgresTransaction(async (client) => {
      if (operation === "create-case") {
        const personnelId = cleanText(body?.personnelId, 40);
        const caseKind = body?.caseKind === "verbal" ? "verbal" : body?.caseKind === "warning" ? "warning" : body?.caseKind === "da" ? "da" : "";
        const incidentOn = cleanText(body?.incidentOn, 10);
        const summary = cleanText(body?.summary, 180);
        const reason = cleanText(body?.reason, 5000);
        const witnesses = cleanText(body?.witnesses, 2000);
        const appealWaitDays = Number(body?.appealWaitDays);
        const expiresAt = cleanText(body?.expiresAt, 10);
        const inputActions = Array.isArray(body?.actions) ? body.actions as ActionInput[] : [];
        const inputEvidence = Array.isArray(body?.evidence) ? body.evidence as EvidenceInput[] : [];
        if (!UUID.test(personnelId) || !caseKind || !DATE.test(incidentOn) || summary.length < 3 || reason.length < 3) throw new Error("INVALID_CASE");
        if (!Number.isInteger(appealWaitDays) || appealWaitDays < 0 || appealWaitDays > 3650) throw new Error("INVALID_APPEAL_WAIT");
        if (caseKind === "warning" && !DATE.test(expiresAt)) throw new Error("EXPIRY_REQUIRED");
        if (caseKind === "warning" && expiresAt < incidentOn) throw new Error("INVALID_EXPIRY");
        if (caseKind === "verbal" && (inputActions.length || inputEvidence.length || appealWaitDays !== 0)) throw new Error("INVALID_VERBAL_CASE");
        if (inputActions.length > 30 || inputEvidence.length > 20) throw new Error("TOO_MANY_ITEMS");
        const person = await client.query<{ id: string; name: string }>("select id,name from public.personnel where id=$1", [personnelId]);
        const legacyPerson = person.rowCount ? null : await client.query<{ id: string; display_name: string }>("select id,display_name from public.disciplinary_legacy_subjects where id=$1", [personnelId]);
        if (!person.rowCount && !legacyPerson?.rowCount) throw new Error("PERSON_NOT_FOUND");
        const targetName = person.rows[0]?.name || legacyPerson?.rows[0]?.display_name || "Unknown";
        const reference = await client.query<{ reference: string }>("select public.next_disciplinary_reference($1) reference", [caseKind]);
        const created = await client.query<{ id: string }>(
          `insert into public.disciplinary_cases(reference,personnel_id,legacy_subject_id,case_kind,status,incident_on,summary,reason,witnesses,appeal_wait_days,appeal_eligible_at,expires_at,issued_by)
           values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,($6::date + $10::integer),case when $4='warning' then ($11::date + interval '1 day' - interval '1 second') else null end,$12)
           returning id`,
          [reference.rows[0].reference, person.rowCount ? personnelId : null, legacyPerson?.rowCount ? personnelId : null, caseKind, caseKind === "da" ? "pending_approval" : "active", incidentOn, summary, reason, witnesses, appealWaitDays, expiresAt || null, actorId],
        );
        const caseId = created.rows[0].id;
        const seenActions = new Set<string>();
        for (const input of inputActions) {
          const catalogActionId = cleanText(input.catalogActionId, 40);
          if (!UUID.test(catalogActionId) || seenActions.has(catalogActionId)) continue;
          seenActions.add(catalogActionId);
          const catalog = await client.query<{ name: string; category: string; slug: string }>(
            "select name,category,slug from public.disciplinary_action_catalog where id=$1 and active=true", [catalogActionId],
          );
          if (!catalog.rowCount) throw new Error("INVALID_ACTION");
          if (caseKind === "warning" && catalog.rows[0].slug === "strip-tags") throw new Error("INVALID_ACTION");
          const certificationIds = [...new Set(Array.isArray(input.certificationIds) ? input.certificationIds.map(String) : [])];
          const details = actionDetails(input.details);
          if (catalog.rows[0].slug === "strip-tags") {
            if (!certificationIds.length || certificationIds.some((id) => !UUID.test(id))) throw new Error("TAG_SELECTION_REQUIRED");
            const valid = await client.query("select certification_id from public.personnel_certifications where personnel_id=$1 and certification_id=any($2::uuid[])", [personnelId, certificationIds]);
            if (valid.rowCount !== certificationIds.length) throw new Error("INVALID_TAG_SELECTION");
          }
          await client.query(
            `insert into public.disciplinary_case_actions(case_id,catalog_action_id,action_name,action_category,target_data,due_at)
             values($1,$2,$3,$4,$5::jsonb,case when $6='' then null else ($6::date + interval '1 day' - interval '1 second') end)`,
            [caseId, catalogActionId, catalog.rows[0].name, catalog.rows[0].category, JSON.stringify({ certificationIds, ...details }), String(details.dueDate || "")],
          );
        }
        for (const input of inputEvidence) {
          const label = cleanText(input.label, 100);
          const url = cleanText(input.url, 2000);
          if (!label || !validUrl(url)) throw new Error("INVALID_EVIDENCE");
          await client.query("insert into public.disciplinary_evidence_links(case_id,label,url,added_by) values($1,$2,$3,$4)", [caseId, label, url, actorId]);
        }
        const typeLabel = caseKind === "da" ? "Disciplinary action" : caseKind === "verbal" ? "Verbal warning" : "Warning";
        await appendEvent(client, caseId, "CASE_CREATED", `${typeLabel} issued to ${targetName}${caseKind === "da" ? " and submitted for secondary approval" : ""}.`, actorId);
        return { caseId, reference: reference.rows[0].reference };
      }

      if (operation === "add-ban") {
        const personnelId = cleanText(body?.personnelId, 40);
        const manualName = cleanText(body?.displayName, 180);
        const manualNumber = cleanText(body?.birthNumber, 80);
        const bannedOn = cleanText(body?.bannedOn, 10);
        const reason = cleanText(body?.reason, 5000);
        const evidenceUrl = cleanText(body?.evidenceUrl, 2000);
        const notes = cleanText(body?.notes, 2000);
        if (!DATE.test(bannedOn) || reason.length < 3 || (evidenceUrl && !validUrl(evidenceUrl))) throw new Error("INVALID_BAN");
        let displayName = manualName;
        let birthNumber = manualNumber;
        let linkedPersonnelId: string | null = null;
        if (personnelId) {
          if (!UUID.test(personnelId)) throw new Error("INVALID_BAN");
          const person = await client.query<{ name: string; birth_number: string | null }>("select name,birth_number from public.personnel where id=$1", [personnelId]);
          if (!person.rowCount) throw new Error("PERSON_NOT_FOUND");
          linkedPersonnelId = personnelId;
          displayName = person.rows[0].name;
          birthNumber = person.rows[0].birth_number || birthNumber;
        }
        if (!displayName) throw new Error("INVALID_BAN");
        if (linkedPersonnelId) {
          const existing = await client.query("select 1 from public.disciplinary_bans where personnel_id=$1 and status='active'", [linkedPersonnelId]);
          if (existing.rowCount) throw new Error("BAN_ALREADY_ACTIVE");
        }
        const created = await client.query<{ id: string }>(`insert into public.disciplinary_bans
          (personnel_id,display_name,birth_number,banned_on,reason,evidence_url,notes,created_by)
          values($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
        [linkedPersonnelId, displayName, birthNumber || null, bannedOn, reason, evidenceUrl || null, notes || null, actorId]);
        await client.query("insert into public.audit_logs(user_id,target_personnel_id,action,details) values($1,$2,'DISCIPLINE_BAN_ADDED',$3)", [actorId, linkedPersonnelId, `Added ${displayName} to the banned register.`]);
        return { banId: created.rows[0].id };
      }

      if (operation === "lift-ban") {
        const banId = cleanText(body?.banId, 40);
        const reason = cleanText(body?.reason, 1000);
        if (!UUID.test(banId) || reason.length < 3) throw new Error("INVALID_BAN_LIFT");
        const changed = await client.query<{ personnel_id: string | null; display_name: string }>(`update public.disciplinary_bans
          set status='lifted',lifted_by=$2,lifted_at=now(),lift_reason=$3
          where id=$1 and status='active' returning personnel_id,display_name`, [banId, actorId, reason]);
        if (!changed.rowCount) throw new Error("BAN_NOT_ACTIVE");
        await client.query("insert into public.audit_logs(user_id,target_personnel_id,action,details) values($1,$2,'DISCIPLINE_BAN_LIFTED',$3)", [actorId, changed.rows[0].personnel_id, `Lifted the ban for ${changed.rows[0].display_name}. Reason: ${reason}`]);
        return { banId };
      }

      if (operation === "template-save") {
        const name = cleanText(body?.name, 120);
        const caseKind = body?.caseKind === "warning" ? "warning" : body?.caseKind === "da" ? "da" : "";
        const summary = cleanText(body?.summary, 180);
        const reason = cleanText(body?.reason, 5000);
        const witnesses = cleanText(body?.witnesses, 2000);
        const appealWaitDays = Number(body?.appealWaitDays);
        const warningExpiryDays = Number(body?.warningExpiryDays);
        const inputActions = Array.isArray(body?.actions) ? body.actions as ActionInput[] : [];
        if (name.length < 3 || !caseKind || inputActions.length > 30 || !Number.isInteger(appealWaitDays) || appealWaitDays < 0 || appealWaitDays > 3650 || (caseKind === "warning" && (!Number.isInteger(warningExpiryDays) || warningExpiryDays < 1 || warningExpiryDays > 3650))) throw new Error("INVALID_TEMPLATE");
        const storedActions: { catalogActionId: string; details: Record<string, string | number> }[] = [];
        const seen = new Set<string>();
        for (const input of inputActions) {
          const catalogActionId = cleanText(input.catalogActionId, 40);
          if (!UUID.test(catalogActionId) || seen.has(catalogActionId)) continue;
          const catalog = await client.query<{ slug: string }>("select slug from public.disciplinary_action_catalog where id=$1 and active=true", [catalogActionId]);
          if (!catalog.rowCount || (caseKind === "warning" && catalog.rows[0].slug === "strip-tags")) throw new Error("INVALID_TEMPLATE");
          seen.add(catalogActionId);
          storedActions.push({ catalogActionId, details: actionDetails(input.details) });
        }
        const created = await client.query<{ id: string }>(`insert into public.disciplinary_case_templates
          (name,case_kind,summary,reason,witnesses,appeal_wait_days,warning_expiry_days,actions,created_by)
          values($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9) returning id`,
        [name, caseKind, summary, reason, witnesses, appealWaitDays, caseKind === "warning" ? warningExpiryDays : null, JSON.stringify(storedActions), actorId]);
        await client.query("insert into public.audit_logs(user_id,action,details) values($1,'DISCIPLINE_TEMPLATE_ADDED',$2)", [actorId, `Added disciplinary case template: ${name}`]);
        return { templateId: created.rows[0].id };
      }

      if (operation === "template-toggle") {
        const templateId = cleanText(body?.templateId, 40);
        if (!UUID.test(templateId) || typeof body?.active !== "boolean") throw new Error("INVALID_TEMPLATE");
        const changed = await client.query("update public.disciplinary_case_templates set active=$2,updated_at=now() where id=$1 returning name", [templateId, body.active]);
        if (!changed.rowCount) throw new Error("INVALID_TEMPLATE");
        await client.query("insert into public.audit_logs(user_id,action,details) values($1,'DISCIPLINE_TEMPLATE_UPDATED',$2)", [actorId, `${body.active ? "Enabled" : "Disabled"} disciplinary case template: ${changed.rows[0].name}`]);
        return { templateId };
      }

      const caseId = cleanText(body?.caseId, 40);
      if (["approve-case", "complete-action", "add-evidence", "submit-appeal", "review-appeal", "void-case"].includes(operation) && !UUID.test(caseId)) throw new Error("INVALID_CASE");

      if (operation === "approve-case") {
        const decision = body?.decision === "approved" ? "approved" : body?.decision === "rejected" ? "rejected" : "";
        const notes = cleanText(body?.notes, 1000);
        const target = await client.query<{ personnel_id: string; issued_by: string; status: string; case_kind: string }>("select personnel_id,issued_by,status,case_kind from public.disciplinary_cases where id=$1 for update", [caseId]);
        if (!target.rowCount || target.rows[0].case_kind !== "da" || target.rows[0].status !== "pending_approval") throw new Error("NOT_AWAITING_APPROVAL");
        if (target.rows[0].issued_by === actorId) throw new Error("SELF_APPROVAL");
        if (!decision) throw new Error("INVALID_DECISION");
        await client.query("insert into public.disciplinary_approvals(case_id,decision,notes,decided_by) values($1,$2,$3,$4)", [caseId, decision, notes || null, actorId]);
        if (decision === "approved") {
          await client.query("update public.disciplinary_cases set status='active',approved_by=$2,approved_at=now(),updated_at=now() where id=$1", [caseId, actorId]);
          const tags = await client.query<{ certification_id: string }>(`select distinct jsonb_array_elements_text(actions.target_data->'certificationIds') certification_id
            from public.disciplinary_case_actions actions join public.disciplinary_action_catalog catalog on catalog.id=actions.catalog_action_id
            where actions.case_id=$1 and catalog.slug='strip-tags'`, [caseId]);
          const ids = tags.rows.map((row) => row.certification_id).filter((id) => UUID.test(id));
          if (ids.length) await client.query("delete from public.personnel_certifications where personnel_id=$1 and certification_id=any($2::uuid[])", [target.rows[0].personnel_id, ids]);
          await appendEvent(client, caseId, "DA_APPROVED", `DA approved.${ids.length ? ` ${ids.length} selected tag(s) removed.` : ""}${notes ? ` Notes: ${notes}` : ""}`, actorId);
        } else {
          await client.query("update public.disciplinary_cases set status='voided',voided_by=$2,void_reason=$3,voided_at=now(),updated_at=now() where id=$1", [caseId, actorId, notes || "DA rejected during approval"]);
          await appendEvent(client, caseId, "DA_REJECTED", `DA rejected during secondary approval.${notes ? ` Notes: ${notes}` : ""}`, actorId);
        }
        return { decision };
      }

      if (operation === "complete-action") {
        const actionId = cleanText(body?.actionId, 40);
        const notes = cleanText(body?.notes, 1000);
        if (!UUID.test(actionId)) throw new Error("INVALID_ACTION");
        const action = await client.query<{ action_name: string }>("select action_name from public.disciplinary_case_actions where id=$1 and case_id=$2 and status='pending' for update", [actionId, caseId]);
        if (!action.rowCount) throw new Error("ACTION_NOT_PENDING");
        await client.query("update public.disciplinary_case_actions set status='completed',completed_by=$2,completed_at=now(),completion_notes=$3 where id=$1", [actionId, actorId, notes || null]);
        await appendEvent(client, caseId, "ACTION_COMPLETED", `${action.rows[0].action_name} marked complete.${notes ? ` ${notes}` : ""}`, actorId);
        return { actionId };
      }

      if (operation === "add-evidence") {
        const label = cleanText(body?.label, 100);
        const url = cleanText(body?.url, 2000);
        if (!label || !validUrl(url)) throw new Error("INVALID_EVIDENCE");
        const target = await client.query<{ case_kind: string }>("select case_kind from public.disciplinary_cases where id=$1", [caseId]);
        if (!target.rowCount) throw new Error("CASE_NOT_FOUND");
        if (target.rows[0].case_kind === "verbal") throw new Error("INVALID_VERBAL_CASE");
        await client.query("insert into public.disciplinary_evidence_links(case_id,label,url,added_by) values($1,$2,$3,$4)", [caseId, label, url, actorId]);
        await appendEvent(client, caseId, "EVIDENCE_ADDED", `Evidence link added: ${label}.`, actorId);
        return { caseId };
      }

      if (operation === "submit-appeal") {
        const documentUrl = cleanText(body?.documentUrl, 2000);
        const notes = cleanText(body?.notes, 2000);
        const bypassEligibility = body?.bypassEligibility === true;
        const bypassReason = cleanText(body?.bypassReason, 1000);
        if (!validUrl(documentUrl)) throw new Error("INVALID_APPEAL_LINK");
        const target = await client.query<{ status: string; case_kind: string; appeal_eligible_at: string }>("select status,case_kind,appeal_eligible_at from public.disciplinary_cases where id=$1 for update", [caseId]);
        if (!target.rowCount || target.rows[0].case_kind === "verbal" || !["active", "appealed"].includes(target.rows[0].status)) throw new Error("NOT_APPEALABLE");
        const eligible = new Date(target.rows[0].appeal_eligible_at).getTime() <= Date.now();
        if (!eligible) {
          if (!bypassEligibility) throw new Error("APPEAL_NOT_YET_ELIGIBLE");
          const full = await requirePageAccess(request, PERMISSION, "full").catch(() => null);
          if (!full) throw new Error("APPEAL_BYPASS_FORBIDDEN");
          if (bypassReason.length < 3) throw new Error("APPEAL_BYPASS_REASON_REQUIRED");
        }
        const pending = await client.query("select 1 from public.disciplinary_appeals where case_id=$1 and status in ('pending','more_info') limit 1", [caseId]);
        if (pending.rowCount) throw new Error("APPEAL_ALREADY_PENDING");
        const appeal = await client.query<{ id: string }>("insert into public.disciplinary_appeals(case_id,document_url,notes,submitted_by,eligibility_bypassed,bypass_reason) values($1,$2,$3,$4,$5,$6) returning id", [caseId, documentUrl, notes || null, actorId, !eligible, !eligible ? bypassReason : null]);
        await client.query("update public.disciplinary_cases set status='appealed',updated_at=now() where id=$1", [caseId]);
        await appendEvent(client, caseId, !eligible ? "APPEAL_ELIGIBILITY_BYPASSED" : "APPEAL_SUBMITTED", !eligible ? `Appeal submitted early by a full-access user. Reason: ${bypassReason}` : "Appeal submitted for review.", actorId);
        return { appealId: appeal.rows[0].id };
      }

      if (operation === "review-appeal") {
        const appealId = cleanText(body?.appealId, 40);
        const outcome = ["upheld", "amended", "overturned", "more_info"].includes(String(body?.outcome)) ? String(body?.outcome) : "";
        const notes = cleanText(body?.notes, 2000);
        if (!UUID.test(appealId) || !outcome || notes.length < 3) throw new Error("INVALID_APPEAL_REVIEW");
        const appeal = await client.query("select id from public.disciplinary_appeals where id=$1 and case_id=$2 and status in ('pending','more_info') for update", [appealId, caseId]);
        if (!appeal.rowCount) throw new Error("APPEAL_NOT_PENDING");
        await client.query("update public.disciplinary_appeals set status=$2,reviewed_by=$3,review_notes=$4,reviewed_at=now() where id=$1", [appealId, outcome, actorId, notes]);
        const caseStatus = outcome === "overturned" ? "overturned" : outcome === "more_info" ? "appealed" : "active";
        await client.query("update public.disciplinary_cases set status=$2,updated_at=now() where id=$1", [caseId, caseStatus]);
        await appendEvent(client, caseId, "APPEAL_REVIEWED", `Appeal outcome: ${outcome.replace("_", " ")}. ${notes}`, actorId);
        return { outcome };
      }

      if (operation === "void-case") {
        const reason = cleanText(body?.reason, 1000);
        if (reason.length < 3) throw new Error("VOID_REASON_REQUIRED");
        const changed = await client.query("update public.disciplinary_cases set status='voided',voided_by=$2,void_reason=$3,voided_at=now(),updated_at=now() where id=$1 and status<>'voided' returning id", [caseId, actorId, reason]);
        if (!changed.rowCount) throw new Error("CASE_NOT_FOUND");
        await appendEvent(client, caseId, "CASE_VOIDED", `Record administratively voided. ${reason}`, actorId);
        return { caseId };
      }

      if (operation === "catalog-add") {
        const name = cleanText(body?.name, 180);
        const description = cleanText(body?.description, 1000);
        const category = body?.category === "formal" ? "formal" : body?.category === "community" ? "community" : "";
        if (name.length < 3 || !category) throw new Error("INVALID_CATALOG_ACTION");
        const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)}-${Date.now().toString(36)}`;
        const created = await client.query<{ id: string }>("insert into public.disciplinary_action_catalog(slug,name,category,description,created_by) values($1,$2,$3,$4,$5) returning id", [slug, name, category, description || null, actorId]);
        await client.query("insert into public.audit_logs(user_id,action,details) values($1,'DISCIPLINE_CATALOG_ACTION_ADDED',$2)", [actorId, `Added disciplinary action catalogue entry: ${name}`]);
        return { catalogActionId: created.rows[0].id };
      }

      if (operation === "catalog-toggle") {
        const catalogActionId = cleanText(body?.catalogActionId, 40);
        if (!UUID.test(catalogActionId) || typeof body?.active !== "boolean") throw new Error("INVALID_CATALOG_ACTION");
        const changed = await client.query("update public.disciplinary_action_catalog set active=$2,updated_at=now() where id=$1 returning id", [catalogActionId, body.active]);
        if (!changed.rowCount) throw new Error("INVALID_CATALOG_ACTION");
        await client.query("insert into public.audit_logs(user_id,action,details) values($1,'DISCIPLINE_CATALOG_ACTION_UPDATED',$2)", [actorId, `${body.active ? "Enabled" : "Disabled"} disciplinary action catalogue entry ${catalogActionId}`]);
        return { catalogActionId };
      }

      throw new Error("INVALID_OPERATION");
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const known: Record<string, [string, number]> = {
      INVALID_CASE: ["Complete all required case fields", 400], EXPIRY_REQUIRED: ["Warnings require an expiry date", 400], INVALID_EXPIRY: ["Warning expiry cannot be before the incident date", 400],
      INVALID_VERBAL_CASE: ["Verbal warnings cannot contain formal actions, evidence, or an appeal waiting period", 400],
      INVALID_APPEAL_WAIT: ["Enter an appeal waiting period between 0 and 3650 days", 400],
      TOO_MANY_ITEMS: ["Too many actions or evidence links", 400], PERSON_NOT_FOUND: ["Personnel record not found", 404],
      INVALID_ACTION: ["Select a valid disciplinary action", 400], TAG_SELECTION_REQUIRED: ["Select the tags to remove", 400],
      INVALID_TAG_SELECTION: ["One or more selected tags are no longer assigned", 409], INVALID_EVIDENCE: ["Enter a label and valid evidence link", 400],
      NOT_AWAITING_APPROVAL: ["This DA is no longer awaiting approval", 409], SELF_APPROVAL: ["The issuer cannot approve their own DA", 403],
      INVALID_DECISION: ["Select an approval decision", 400], ACTION_NOT_PENDING: ["This action is no longer pending", 409],
      INVALID_APPEAL_LINK: ["Enter a valid appeal document link", 400], NOT_APPEALABLE: ["This case cannot currently be appealed", 409], APPEAL_NOT_YET_ELIGIBLE: ["The appeal eligibility date has not been reached", 409], APPEAL_BYPASS_FORBIDDEN: ["Full permission is required to bypass appeal eligibility", 403], APPEAL_BYPASS_REASON_REQUIRED: ["Enter a reason for bypassing appeal eligibility", 400], APPEAL_ALREADY_PENDING: ["This case already has an appeal awaiting review", 409],
      INVALID_APPEAL_REVIEW: ["Choose an outcome and enter review notes", 400], APPEAL_NOT_PENDING: ["This appeal is no longer awaiting review", 409],
      VOID_REASON_REQUIRED: ["Enter a reason for voiding the record", 400], CASE_NOT_FOUND: ["Case not found", 404],
      INVALID_CATALOG_ACTION: ["Enter a valid action name and category", 400], INVALID_TEMPLATE: ["Enter a valid unique template name and configuration", 400], INVALID_OPERATION: ["Invalid disciplinary operation", 400],
      INVALID_BAN: ["Complete the banned-person record and use a valid evidence link", 400], BAN_ALREADY_ACTIVE: ["That personnel record already has an active ban", 409], INVALID_BAN_LIFT: ["Enter a reason for lifting the ban", 400], BAN_NOT_ACTIVE: ["This ban is no longer active", 409],
    };
    if (known[code]) return NextResponse.json({ error: known[code][0] }, { status: known[code][1] });
    console.error("[discipline] Update failed", error);
    return NextResponse.json({ error: "Failed to update disciplinary record" }, { status: 500 });
  }
}
