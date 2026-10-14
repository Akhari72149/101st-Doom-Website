import { structure } from "@/data/structure";

type StructureRole = {
  role: string;
  slotId: string;
};

type StructureSubsection = {
  type: string;
  title: string;
  roles?: StructureRole[];
};

type StructureSection = {
  type: string;
  title: string;
  children?: StructureSubsection[];
};

export type SlotDirectoryEntry = {
  label: string;
  section: string;
  subsection: string;
};

export function getSlotDirectory() {
  const directory = new Map<string, SlotDirectoryEntry>();

  for (const section of structure as StructureSection[]) {
    for (const subsection of section.children || []) {
      for (const role of subsection.roles || []) {
        directory.set(role.slotId, {
          label: role.role,
          section: section.title,
          subsection: subsection.title,
        });
      }
    }
  }

  return directory;
}
