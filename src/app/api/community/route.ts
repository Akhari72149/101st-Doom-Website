import { NextResponse } from "next/server";
import { getCertificationFamilyName } from "@/lib/certification-families";
import { getPostgresPool } from "@/lib/postgres/pool";
import { getSlotDirectory } from "@/lib/structure-directory";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type PersonRow = {
  id: string;
  name: string;
  rank_id: string | null;
  slotted_position: string | null;
  mos: string | null;
  status: string | null;
};

type RankRow = { id: string; name: string; rank_level: number | null };
type CertificationRow = { id: string; name: string; lead_personnel_id: string | null };
type PersonnelCertificationRow = { id: string; personnel_id: string; certification_id: string; awarded_at: string | Date };
type RankHistoryRow = { id: string; personnel_id: string; old_rank_id: string | null; new_rank_id: string | null; changed_at: string | Date };
type AwardRow = { id: string; name: string; description: string | null; category: string | null; icon_key: string | null; ribbon_color: string | null };
type PersonnelAwardRow = { id: string; personnel_id: string; award_id: string; awarded_at: string | Date };
type RoleTagRow = { user_id: string; tag: string; display_name: string };

const inactiveStatuses = new Set(["removed", "retired", "transferred"]);

function databaseBackend() {
  const backend = process.env.PERSONNEL_DATABASE_BACKEND || "supabase";
  if (backend !== "postgres" && backend !== "supabase") throw new Error("Unknown PERSONNEL_DATABASE_BACKEND");
  return backend;
}

async function postgresData() {
  const pool = getPostgresPool();
  const [personnel, ranks, certifications, personnelCertifications, rankHistory, awards, personnelAwards, roleTags] = await Promise.all([
    pool.query<PersonRow>("select id,name,rank_id,slotted_position,mos,status from public.personnel"),
    pool.query<RankRow>("select id,name,rank_level from public.ranks"),
    pool.query<CertificationRow>("select id,name,lead_personnel_id from public.certifications"),
    pool.query<PersonnelCertificationRow>("select id,personnel_id,certification_id,awarded_at from public.personnel_certifications order by awarded_at desc nulls last limit 500"),
    pool.query<RankHistoryRow>(`select id,personnel_id,old_rank_id,new_rank_id,changed_at from public.rank_history
      where old_rank_id is distinct from new_rank_id order by changed_at desc nulls last limit 300`),
    pool.query<AwardRow>("select id,name,description,category,icon_key,ribbon_color from public.awards"),
    pool.query<PersonnelAwardRow>("select id,personnel_id,award_id,awarded_at from public.personnel_awards order by awarded_at desc nulls last limit 300"),
    pool.query<RoleTagRow>(`select tags.user_id,tags.tag,
        coalesce(nullif(users."displayUsername",''),nullif(users.name,''),nullif(users.username,''),'Unknown') display_name
      from public.account_role_tags tags join public.app_auth_users users on users.id=tags.user_id
      where users.disabled=false order by tags.assigned_at,tags.tag`),
  ]);
  return {
    personnel: personnel.rows,
    ranks: ranks.rows,
    certifications: certifications.rows,
    personnelCertifications: personnelCertifications.rows,
    rankHistory: rankHistory.rows,
    awards: awards.rows,
    personnelAwards: personnelAwards.rows,
    roleTags: roleTags.rows,
  };
}

async function supabaseData() {
  const [personnel, ranks, certifications, personnelCertifications, rankHistory, awards, personnelAwards] = await Promise.all([
    supabaseAdmin.from("personnel").select("id,name,rank_id,slotted_position,mos,status"),
    supabaseAdmin.from("ranks").select("id,name,rank_level"),
    supabaseAdmin.from("certifications").select("id,name,lead_personnel_id"),
    supabaseAdmin.from("personnel_certifications").select("id,personnel_id,certification_id,awarded_at").order("awarded_at", { ascending: false }).limit(500),
    supabaseAdmin.from("rank_history").select("id,personnel_id,old_rank_id,new_rank_id,changed_at").order("changed_at", { ascending: false }).limit(300),
    supabaseAdmin.from("awards").select("id,name,description,category,icon_key,ribbon_color"),
    supabaseAdmin.from("personnel_awards").select("id,personnel_id,award_id,awarded_at").order("awarded_at", { ascending: false }).limit(300),
  ]);
  const error = personnel.error || ranks.error || certifications.error || personnelCertifications.error || rankHistory.error || awards.error || personnelAwards.error;
  if (error) throw error;
  return {
    personnel: (personnel.data || []) as PersonRow[],
    ranks: (ranks.data || []) as RankRow[],
    certifications: (certifications.data || []) as CertificationRow[],
    personnelCertifications: (personnelCertifications.data || []) as PersonnelCertificationRow[],
    rankHistory: ((rankHistory.data || []) as RankHistoryRow[]).filter((row) => row.old_rank_id !== row.new_rank_id),
    awards: (awards.data || []) as AwardRow[],
    personnelAwards: (personnelAwards.data || []) as PersonnelAwardRow[],
    roleTags: [] as RoleTagRow[],
  };
}

function buildResponse(data: Awaited<ReturnType<typeof postgresData>>) {
  const slotDirectory = getSlotDirectory();
  const activePersonnel = data.personnel.filter((person) => !inactiveStatuses.has(String(person.status || "").toLowerCase()));
  const people = new Map(activePersonnel.map((person) => [person.id, person]));
  const ranks = new Map(data.ranks.map((rank) => [rank.id, rank]));
  const certifications = new Map(data.certifications.map((certification) => [certification.id, certification]));
  const awards = new Map(data.awards.map((award) => [award.id, award]));

  const personSummary = (person: PersonRow) => {
    const rank = person.rank_id ? ranks.get(person.rank_id) : null;
    const slot = person.slotted_position ? slotDirectory.get(person.slotted_position) : null;
    return {
      id: person.id,
      name: person.name,
      rank: rank?.name || "Unranked",
      rankLevel: rank?.rank_level || 0,
      slotId: person.slotted_position,
      slotLabel: slot?.label || person.slotted_position || "Unassigned",
      section: slot?.section || "Other Appointments",
      subsection: slot?.subsection || "Unit Personnel",
      mos: person.mos,
    };
  };

  const leadershipPattern = /(commander|executive officer|ncoic|sergeant major|warrant officer|platoon sergeant|squad lead|team lead|troop leader|overseer)/i;
  const sectionOrder = new Map([
    ["Battalion Command", 0],
    ["Company Command", 1],
    ["Tomahawk 1", 2],
    ["Claymore 2", 3],
    ["Broadsword 3", 4],
    ["Dagger", 5],
  ]);
  const leadership = activePersonnel
    .filter((person) => person.slotted_position && leadershipPattern.test(slotDirectory.get(person.slotted_position)?.label || person.slotted_position))
    .map(personSummary)
    .sort((a, b) =>
      (sectionOrder.get(a.section) ?? 99) - (sectionOrder.get(b.section) ?? 99)
      || b.rankLevel - a.rankLevel
      || a.slotLabel.localeCompare(b.slotLabel)
    );

  const leadFamilies = new Map<string, { family: string; person: ReturnType<typeof personSummary>; certifications: string[] }>();
  for (const certification of data.certifications) {
    if (!certification.lead_personnel_id) continue;
    const person = people.get(certification.lead_personnel_id);
    if (!person) continue;
    const family = getCertificationFamilyName(certification.name);
    const key = `${person.id}:${family}`;
    const current = leadFamilies.get(key);
    if (current) current.certifications.push(certification.name);
    else leadFamilies.set(key, { family, person: personSummary(person), certifications: [certification.name] });
  }

  const roleContacts = new Map<string, { userId: string; name: string; tags: string[]; person: ReturnType<typeof personSummary> | null }>();
  for (const roleTag of data.roleTags) {
    const existing = roleContacts.get(roleTag.user_id);
    if (existing) {
      existing.tags.push(roleTag.tag);
      continue;
    }
    const person = activePersonnel.find((entry) => entry.name.toLowerCase() === roleTag.display_name.toLowerCase());
    roleContacts.set(roleTag.user_id, {
      userId: roleTag.user_id,
      name: roleTag.display_name,
      tags: [roleTag.tag],
      person: person ? personSummary(person) : null,
    });
  }

  const promotions = data.rankHistory.flatMap((history) => {
    const person = people.get(history.personnel_id);
    const nextRank = history.new_rank_id ? ranks.get(history.new_rank_id) : null;
    if (!person || !nextRank || !history.changed_at) return [];
    return [{
      id: `promotion-${history.id}`,
      type: "promotion" as const,
      occurredAt: history.changed_at,
      person: personSummary(person),
      title: `Promoted to ${nextRank.name}`,
      detail: history.old_rank_id ? `From ${ranks.get(history.old_rank_id)?.name || "previous rank"}` : "Initial rank recorded",
    }];
  });

  const certificationAwards = data.personnelCertifications.flatMap((entry) => {
    const person = people.get(entry.personnel_id);
    const certification = certifications.get(entry.certification_id);
    if (!person || !certification || !entry.awarded_at) return [];
    return [{
      id: `certification-${entry.id}`,
      type: "certification" as const,
      occurredAt: entry.awarded_at,
      person: personSummary(person),
      title: certification.name,
      detail: `${getCertificationFamilyName(certification.name)} qualification awarded`,
    }];
  });

  const medalAwards = data.personnelAwards.flatMap((entry) => {
    const person = people.get(entry.personnel_id);
    const award = awards.get(entry.award_id);
    if (!person || !award || !entry.awarded_at) return [];
    return [{
      id: `medal-${entry.id}`,
      type: "medal" as const,
      occurredAt: entry.awarded_at,
      person: personSummary(person),
      title: award.name,
      detail: award.description || award.category || "Battalion recognition awarded",
      award: { category: award.category, iconKey: award.icon_key, color: award.ribbon_color || "#facc15" },
    }];
  });

  return {
    leadership,
    certificationLeads: [...leadFamilies.values()].sort((a, b) => a.family.localeCompare(b.family)),
    roleContacts: [...roleContacts.values()].sort((a, b) => a.name.localeCompare(b.name)),
    recognition: [...promotions, ...certificationAwards, ...medalAwards]
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
      .slice(0, 500),
  };
}

export async function GET() {
  try {
    const data = databaseBackend() === "postgres" ? await postgresData() : await supabaseData();
    return NextResponse.json(buildResponse(data), { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
  } catch (error) {
    console.error("[community] Failed to load public community data", error);
    return NextResponse.json({ error: "COMMUNITY_DATA_LOAD_FAILED" }, { status: 500 });
  }
}
