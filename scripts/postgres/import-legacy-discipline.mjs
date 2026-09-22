import pg from 'pg';
import { assertTarget } from './target-guard.mjs';

assertTarget({ purpose: 'legacy disciplinary import' });

const apply = process.argv.includes('--apply');
const spreadsheetId = process.env.LEGACY_DISCIPLINE_SPREADSHEET_ID
  || '18FMOmFmE0Q4UbhIIw3_EnPWgMBmpziPkgIBlF8iQtNw';
const sourceSystem = `google-sheet:${spreadsheetId}`;
const warningExpiryDays = 180;

function cellValue(cell) {
  if (!cell) return '';
  return String(cell.f ?? cell.v ?? '').trim();
}

async function readSheet(sheet) {
  const url = new URL(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq`);
  url.searchParams.set('tqx', 'out:json');
  url.searchParams.set('sheet', sheet);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to read ${sheet}: HTTP ${response.status}`);
  const text = await response.text();
  const match = text.match(/setResponse\((.*)\);?\s*$/s);
  if (!match) throw new Error(`Unexpected Google Sheets response for ${sheet}`);
  const payload = JSON.parse(match[1]);
  if (payload.status !== 'ok') throw new Error(`Google Sheets query failed for ${sheet}`);
  const headers = payload.table.cols.map((column, index) => column.label || `column_${index}`);
  return payload.table.rows.map((row, rowIndex) => ({
    rowNumber: rowIndex + 2,
    values: Object.fromEntries(headers.map((header, index) => [header, cellValue(row.c[index])])),
  })).filter((row) => Object.values(row.values).some(Boolean));
}

function normalize(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeBirth(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function parseSubject(value) {
  const appealed = /^\s*x\s+/i.test(value);
  const cleaned = String(value || '').replace(/^\s*x\s+/i, '').trim();
  const numberMatch = cleaned.match(/(?:^|[-\s])([0-9]{3,6}(?:-[0-9]+)?)(?=\s|$)/);
  const birthNumber = numberMatch?.[1] || '';
  let name = birthNumber ? cleaned.slice((numberMatch?.index || 0) + numberMatch[0].length) : cleaned;
  name = name.replace(/^[\s"“”'-]+|[\s"“”'-]+$/g, '').trim();
  if (!name && birthNumber) name = cleaned.slice(0, numberMatch?.index || 0).replace(/[^A-Za-z]+/g, ' ').trim();
  if (!name && birthNumber) name = birthNumber;
  return {
    appealed,
    birthNumber,
    name,
  };
}

function parseDate(value, defaultOrder = 'mdy') {
  const cleaned = String(value || '').trim();
  const match = cleaned.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{2}|\d{4})$/);
  if (!match) return null;
  let first = Number(match[1]);
  let second = Number(match[2]);
  const year = Number(match[3]) < 100 ? 2000 + Number(match[3]) : Number(match[3]);
  let day;
  let month;
  if (first > 12) [day, month] = [first, second];
  else if (second > 12) [month, day] = [first, second];
  else if (defaultOrder === 'dmy') [day, month] = [first, second];
  else [month, day] = [first, second];
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

function validUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function shortSummary(value) {
  const compact = String(value || '').replace(/\s+/g, ' ').trim();
  return compact.length <= 180 ? compact : `${compact.slice(0, 177)}...`;
}

function personnelMatcher(rows) {
  const byBirth = new Map();
  const byName = new Map();
  for (const row of rows) {
    const birth = normalizeBirth(row.birth_number);
    const name = normalize(row.name);
    if (birth) byBirth.set(birth, [...(byBirth.get(birth) || []), row]);
    if (name) byName.set(name, [...(byName.get(name) || []), row]);
  }
  return (subject) => {
    const birthMatches = subject.birthNumber ? byBirth.get(normalizeBirth(subject.birthNumber)) || [] : [];
    if (birthMatches.length === 1) return { row: birthMatches[0], method: 'service-number' };
    const nameMatches = subject.name ? byName.get(normalize(subject.name)) || [] : [];
    if (nameMatches.length === 1) return { row: nameMatches[0], method: 'name' };
    return { row: null, method: birthMatches.length > 1 || nameMatches.length > 1 ? 'ambiguous' : 'unmatched' };
  };
}

const [reports, warnings, bans] = await Promise.all([
  readSheet('Reports'),
  readSheet('Warnings'),
  readSheet('Banned members'),
]);

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  const personnel = (await client.query('select id,name,birth_number,status from public.personnel order by name')).rows;
  const actor = await client.query(`select id from public.app_auth_users where lower(username)='akhari' limit 1`);
  if (!actor.rowCount) throw new Error('The Akhari application account is required as the accountable import actor');
  const actorId = actor.rows[0].id;
  const matchPersonnel = personnelMatcher(personnel);
  const preparedCases = [];
  const preparedBans = [];
  const rejected = [];

  for (const row of reports) {
    const values = row.values;
    const subject = parseSubject(values['Person being Reported:']);
    const incident = parseDate(values.Date, 'mdy');
    const reason = String(values.Reason || '').trim();
    const match = matchPersonnel(subject);
    if (!subject.name || !incident || reason.length < 3) {
      rejected.push({ tab: 'Reports', row: row.rowNumber, subject: values['Person being Reported:'], reason: 'invalid required data' });
      continue;
    }
    preparedCases.push({
      sourceKey: `reports:${row.rowNumber}`,
      reference: `LEGACY-DA-${String(row.rowNumber - 1).padStart(3, '0')}`,
      personnelId: match.row?.id || null,
      legacySubject: match.row ? null : subject,
      kind: 'da',
      status: subject.appealed ? 'overturned' : 'active',
      incident,
      summary: shortSummary(reason),
      reason,
      witnesses: '',
      legacyIssuer: String(values.NCO || 'Unknown').trim(),
      appealWaitDays: /^\d+$/.test(values.Appealability || '') ? Math.min(3650, Number(values.Appealability)) : 0,
      expiresAt: null,
      evidenceUrl: validUrl(values['Document Link']),
      matchMethod: match.method,
    });
  }

  for (const row of warnings) {
    const values = row.values;
    const subject = parseSubject(values['Person getting Warned:']);
    const incident = parseDate(values.Date, 'mdy');
    const happened = String(values['What happened?'] || '').trim();
    const notes = String(values.Notes || '').trim();
    const reason = [happened, notes].filter(Boolean).join('\n\nNotes: ');
    const match = matchPersonnel(subject);
    if (!subject.name || !incident || reason.length < 3) {
      rejected.push({ tab: 'Warnings', row: row.rowNumber, subject: values['Person getting Warned:'], reason: 'invalid required data' });
      continue;
    }
    const expiresAt = new Date(incident);
    expiresAt.setUTCDate(expiresAt.getUTCDate() + warningExpiryDays);
    preparedCases.push({
      sourceKey: `warnings:${row.rowNumber}`,
      reference: `LEGACY-WARN-${String(row.rowNumber - 1).padStart(3, '0')}`,
      personnelId: match.row?.id || null,
      legacySubject: match.row ? null : subject,
      kind: 'warning',
      status: subject.appealed ? 'overturned' : 'active',
      incident,
      summary: shortSummary(happened || notes),
      reason,
      witnesses: String(values['Witnesses / Other people Present'] || '').trim(),
      legacyIssuer: String(values.NCO || 'Unknown').trim(),
      appealWaitDays: 0,
      expiresAt,
      evidenceUrl: null,
      matchMethod: match.method,
    });
  }

  for (const row of bans) {
    const values = row.values;
    const name = String(values.Name || '').trim();
    const birthNumber = String(values.Numbers || '').trim();
    const bannedOn = parseDate(values.Date, 'dmy') || new Date(Date.UTC(2020, 0, 1, 12));
    const match = matchPersonnel({ name, birthNumber });
    if (!name) continue;
    preparedBans.push({
      sourceKey: `bans:${row.rowNumber}`,
      personnelId: match.row?.id || null,
      legacySubject: match.row ? null : { name, birthNumber },
      displayName: name,
      birthNumber: birthNumber || null,
      bannedOn,
      matchMethod: match.row ? match.method : 'unlinked',
    });
  }

  const existingCases = new Set((await client.query('select source_key from public.disciplinary_cases where source_system=$1', [sourceSystem])).rows.map((row) => row.source_key));
  const existingBans = new Set((await client.query('select source_key from public.disciplinary_bans where source_system=$1', [sourceSystem])).rows.map((row) => row.source_key));
  const summary = {
    mode: apply ? 'apply' : 'preview',
    source: sourceSystem,
    sheetRows: { reports: reports.length, warnings: warnings.length, bans: bans.length },
    matched: {
      disciplinaryCases: preparedCases.length,
      byServiceNumber: preparedCases.filter((item) => item.matchMethod === 'service-number').length,
      byName: preparedCases.filter((item) => item.matchMethod === 'name').length,
      legacyProfiles: preparedCases.filter((item) => item.legacySubject).length,
      bans: preparedBans.length,
      linkedBans: preparedBans.filter((item) => item.personnelId).length,
    },
    alreadyImported: { cases: preparedCases.filter((item) => existingCases.has(item.sourceKey)).length, bans: preparedBans.filter((item) => existingBans.has(item.sourceKey)).length },
    rejected,
  };

  if (!apply) {
    console.log(JSON.stringify(summary, null, 2));
    console.log('Preview only. Re-run with --apply after reviewing unmatched records.');
    process.exitCode = rejected.length ? 2 : 0;
  } else {
    await client.query('begin');
    try {
      for (const item of preparedCases) {
        let legacySubjectId = null;
        if (item.legacySubject) {
          const subjectKey = item.legacySubject.birthNumber
            ? `number:${normalizeBirth(item.legacySubject.birthNumber)}`
            : `name:${normalize(item.legacySubject.name)}`;
          const subject = await client.query(
            `insert into public.disciplinary_legacy_subjects(source_system,subject_key,display_name,birth_number)
             values($1,$2,$3,$4)
             on conflict(source_system,subject_key) do update
             set display_name=excluded.display_name,birth_number=coalesce(excluded.birth_number,public.disciplinary_legacy_subjects.birth_number)
             returning id`,
            [sourceSystem, subjectKey, item.legacySubject.name, item.legacySubject.birthNumber || null],
          );
          legacySubjectId = subject.rows[0].id;
        }
        const inserted = await client.query(
          `insert into public.disciplinary_cases
            (reference,personnel_id,legacy_subject_id,case_kind,status,incident_on,summary,reason,witnesses,appeal_wait_days,appeal_eligible_at,expires_at,issued_by,approved_by,approved_at,voided_by,void_reason,voided_at,created_at,updated_at,source_system,source_key,legacy_issuer_name)
           values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$6::date+$10::integer,$11,$12,
             case when $4='da' and $5='active' then $12::uuid else null end,
             case when $4='da' and $5='active' then $6::timestamptz else null end,
             case when $5='overturned' then $12::uuid else null end,
             case when $5='overturned' then 'Legacy record marked as appealed in the source register.' else null end,
             case when $5='overturned' then $6::timestamptz else null end,
             $6::timestamptz,$6::timestamptz,$13,$14,$15)
           on conflict (source_system,source_key) where source_system is not null and source_key is not null do nothing
           returning id`,
          [item.reference, item.personnelId, legacySubjectId, item.kind, item.status, item.incident.toISOString().slice(0, 10), item.summary, item.reason, item.witnesses, item.appealWaitDays, item.expiresAt, actorId, sourceSystem, item.sourceKey, item.legacyIssuer],
        );
        if (!inserted.rowCount) continue;
        const caseId = inserted.rows[0].id;
        if (item.evidenceUrl) await client.query('insert into public.disciplinary_evidence_links(case_id,label,url,added_by,added_at) values($1,$2,$3,$4,$5)', [caseId, 'Legacy disciplinary document', item.evidenceUrl, actorId, item.incident]);
        await client.query('insert into public.disciplinary_case_events(case_id,event_type,details,actor_id,created_at) values($1,$2,$3,$4,$5)', [caseId, 'LEGACY_IMPORT', `Imported from the legacy Google Sheet. Original recorded NCO: ${item.legacyIssuer}.`, actorId, item.incident]);
      }
      for (const item of preparedBans) {
        let legacySubjectId = null;
        if (item.legacySubject) {
          const subjectKey = item.legacySubject.birthNumber
            ? `number:${normalizeBirth(item.legacySubject.birthNumber)}`
            : `name:${normalize(item.legacySubject.name)}`;
          const subject = await client.query(
            `insert into public.disciplinary_legacy_subjects(source_system,subject_key,display_name,birth_number)
             values($1,$2,$3,$4)
             on conflict(source_system,subject_key) do update set display_name=excluded.display_name,birth_number=coalesce(excluded.birth_number,public.disciplinary_legacy_subjects.birth_number)
             returning id`,
            [sourceSystem, subjectKey, item.legacySubject.name, item.legacySubject.birthNumber || null],
          );
          legacySubjectId = subject.rows[0].id;
        }
        await client.query(
          `insert into public.disciplinary_bans(personnel_id,legacy_subject_id,display_name,birth_number,banned_on,reason,notes,status,created_by,created_at,source_system,source_key)
           values($1,$2,$3,$4,$5::date,'Legacy banned members register entry.','Imported from the legacy Google Sheet.','active',$6,$5::date::timestamptz,$7,$8)
           on conflict (source_system,source_key) where source_system is not null and source_key is not null do nothing`,
          [item.personnelId, legacySubjectId, item.displayName, item.birthNumber, item.bannedOn.toISOString().slice(0, 10), actorId, sourceSystem, item.sourceKey],
        );
      }
      const verified = await client.query(
        `select
          (select count(*)::integer from public.disciplinary_cases where source_system=$1) cases,
          (select count(*)::integer from public.disciplinary_bans where source_system=$1) bans,
          (select count(*)::integer from public.disciplinary_legacy_subjects where source_system=$1) legacy_subjects`,
        [sourceSystem],
      );
      await client.query('commit');
      console.log(JSON.stringify({ ...summary, verified: verified.rows[0], result: 'Legacy disciplinary import committed' }, null, 2));
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
  }
} finally {
  await client.end();
}
