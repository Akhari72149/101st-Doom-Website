export type UniformGuideItem = {
  text: string;
  url?: string;
};

export type UniformGuideCategory = {
  label: string;
  items: UniformGuideItem[];
};

export type UniformGuideLink = {
  text: string;
  url: string;
};

export type UniformGuideEntry = {
  id: string;
  entryKey: string;
  sectionKey: string;
  title: string;
  subtitle: string;
  summary: string;
  categories: UniformGuideCategory[];
  notes: string[];
  links: UniformGuideLink[];
  imagePath: string | null;
  sortOrder: number;
  published: boolean;
  updatedAt: string;
  updatedBy: string | null;
};

export type UniformGuideSection = {
  key: string;
  label: string;
  description: string;
  sortOrder: number;
  published: boolean;
  entries: UniformGuideEntry[];
};

export type UniformGuideRevision = {
  id: string;
  entryKey: string;
  action: string;
  changedAt: string;
  changedBy: string | null;
  title: string;
};

export const uniformGuideCategorySuggestions = [
  "Uniform",
  "Primary",
  "Secondary",
  "Medical",
  "Grenades",
  "Ammo",
  "Equipment",
  "Notes",
] as const;
