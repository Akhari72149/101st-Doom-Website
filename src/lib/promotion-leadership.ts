import { structure } from "@/data/structure";

type Occupant = {
  slotted_position: string | null;
  discord_id: string | null;
};

type StructureRole = {
  role: string;
  slotId: string;
  discordRoleIds?: string[];
};

type SlotRecord = StructureRole & {
  header: string;
  subHeader: string;
};

const slots: SlotRecord[] = structure.flatMap((section) =>
  (section.children || []).flatMap((child) =>
    (child.roles || []).map((role) => ({
      ...role,
      header: section.title,
      subHeader: child.title,
    })),
  ),
);

function uniqueRoleMatch(
  memberSlot: SlotRecord,
  candidates: SlotRecord[],
) {
  const memberRoleIds = new Set(memberSlot.discordRoleIds || []);
  const roleFrequency = new Map<string, number>();

  for (const candidate of candidates) {
    for (const roleId of new Set(candidate.discordRoleIds || [])) {
      roleFrequency.set(roleId, (roleFrequency.get(roleId) || 0) + 1);
    }
  }

  const matches = candidates.filter((candidate) =>
    (candidate.discordRoleIds || []).some((roleId) =>
      roleFrequency.get(roleId) === 1 && memberRoleIds.has(roleId),
    ),
  );

  return matches.length === 1 ? matches[0] : undefined;
}

export function resolvePromotionLeadership(
  slottedPosition: string | null,
  occupants: Occupant[],
) {
  const memberSlot = slots.find((slot) => slot.slotId === slottedPosition);
  if (!memberSlot) return [];

  const occupantBySlot = new Map(
    occupants
      .filter((occupant) => occupant.slotted_position && occupant.discord_id)
      .map((occupant) => [occupant.slotted_position as string, occupant.discord_id as string]),
  );

  const platoonCandidates = slots.filter((slot) => slot.role === "Platoon Commander");
  const platoonLead = memberSlot.header === "Hammer"
    ? uniqueRoleMatch(memberSlot, platoonCandidates)
    : platoonCandidates.find((slot) => slot.header === memberSlot.header);

  const squadCandidates = slots.filter((slot) =>
    slot.header === memberSlot.header && slot.role === "Squad Lead",
  );
  const squadLead = memberSlot.header === "Hammer"
    ? slots.find((slot) => slot.subHeader === memberSlot.subHeader && /A$/.test(slot.role))
    : uniqueRoleMatch(memberSlot, squadCandidates);

  return [...new Set([squadLead, platoonLead]
    .map((slot) => slot ? occupantBySlot.get(slot.slotId) : null)
    .filter((discordId): discordId is string => Boolean(discordId)))];
}
