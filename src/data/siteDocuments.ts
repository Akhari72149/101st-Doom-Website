export type DocumentBlockType =
  | "paragraph"
  | "heading1"
  | "heading2"
  | "heading3"
  | "numbered"
  | "bullet"
  | "divider";

export type DocumentAlignment = "left" | "center" | "right";
export type DocumentFont = "Alegreya" | "Arial" | "Courier New" | "Orbitron" | "Oswald" | "Times New Roman";
export type DocumentColour = "default" | "green" | "cyan" | "amber" | "red";
export type DocumentLibrarySection = "General" | "Certifications" | "MOS" | "C-Shop";
export type DocumentBackground = "black" | "charcoal" | "navy" | "paper";

export const documentLibrarySections: DocumentLibrarySection[] = [
  "General",
  "Certifications",
  "MOS",
  "C-Shop",
];

export const documentBackgrounds: Array<{ value: DocumentBackground; label: string; colour: string; text: string; border: string }> = [
  { value: "black", label: "Black", colour: "#000000", text: "#d5e1d8", border: "#16452d" },
  { value: "charcoal", label: "Charcoal", colour: "#151a18", text: "#e4ece7", border: "#355044" },
  { value: "navy", label: "Command blue", colour: "#07131d", text: "#e1edf4", border: "#24475b" },
  { value: "paper", label: "Light paper", colour: "#f1f3ed", text: "#17231c", border: "#aab5ac" },
];

export function documentBackgroundAppearance(value: DocumentBackground) {
  return documentBackgrounds.find((item) => item.value === value) || documentBackgrounds[0];
}

export type DocumentRun = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  font?: DocumentFont;
  size?: number;
  colour?: DocumentColour;
  href?: string;
};

export type DocumentBlock = {
  type: DocumentBlockType;
  align: DocumentAlignment;
  level?: number;
  start?: number;
  runs: DocumentRun[];
};

export type SiteDocument = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: DocumentLibrarySection;
  background: DocumentBackground;
  content: DocumentBlock[];
  sourceUrl: string | null;
  published: boolean;
  updatedAt: string;
  updatedBy: string | null;
};

export type SiteDocumentRevision = {
  id: string;
  documentSlug: string;
  title: string;
  action: string;
  changedAt: string;
  changedBy: string | null;
};

export const documentFonts: DocumentFont[] = [
  "Orbitron",
  "Alegreya",
  "Arial",
  "Times New Roman",
  "Courier New",
  "Oswald",
];

export const documentFontSizes = [8, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36];

export function blockText(block: DocumentBlock) {
  return block.runs.map((run) => run.text).join("").trim();
}

export function documentWordCount(content: DocumentBlock[]) {
  return content.reduce((count, block) => count + blockText(block).split(/\s+/).filter(Boolean).length, 0);
}
