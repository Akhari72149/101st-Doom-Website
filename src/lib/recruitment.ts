export type RecruitmentBlock = {
  id: string;
  block_type: "information" | "question";
  field_key: string | null;
  title: string;
  description: string;
  input_type: "text" | "textarea" | "yes_no" | "single_choice" | "multi_choice" | null;
  options: string[];
  required: boolean;
  active: boolean;
  sort_order: number;
};

export const RECRUITMENT_STATUSES = ["new", "contacted", "accepted", "archived"] as const;
export type RecruitmentStatus = (typeof RECRUITMENT_STATUSES)[number];

export function cleanText(value: unknown, maxLength = 1000) {
  return String(value ?? "").replace(/\r/g, "").trim().slice(0, maxLength);
}

export function cleanOptions(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((entry) => cleanText(entry, 160)).filter(Boolean))].slice(0, 30);
}

export function normalizeBlock(row: RecruitmentBlock) {
  return { ...row, options: cleanOptions(row.options) };
}

export function serviceNumberError(value: string) {
  if (!/^\d{5}$/.test(value)) return "Enter exactly five digits";
  if (value.startsWith("0")) return "Service numbers cannot begin with 0";
  if (value === "12345" || value === "42069") return `${value} cannot be requested`;
  return "";
}

export function validateAnswers(blocks: RecruitmentBlock[], raw: unknown) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const answers: Record<string, string | string[]> = {};

  for (const block of blocks) {
    if (block.block_type !== "question" || !block.active || !block.field_key || !block.input_type) continue;
    const value = source[block.field_key];
    if (block.input_type === "multi_choice") {
      const selected = cleanOptions(value).filter((entry) => block.options.includes(entry));
      if (block.required && selected.length === 0) throw new Error(`Complete: ${block.title}`);
      answers[block.field_key] = selected;
      continue;
    }

    const text = cleanText(value, block.input_type === "textarea" ? 4000 : 500);
    if (block.required && !text) throw new Error(`Complete: ${block.title}`);
    if (["yes_no", "single_choice"].includes(block.input_type) && text && !block.options.includes(text)) {
      throw new Error(`Choose a valid answer for: ${block.title}`);
    }
    answers[block.field_key] = text;
  }

  const serviceNumber = cleanText(answers.service_number, 5);
  const numberError = serviceNumberError(serviceNumber);
  if (numberError) throw new Error(numberError);
  const nickname = cleanText(answers.nickname, 80);
  const discordName = cleanText(answers.discord_name, 120);
  const selectedPlatoons = Array.isArray(answers.platoons) ? answers.platoons : [];
  if (!nickname || !discordName || selectedPlatoons.length === 0) throw new Error("Complete the applicant identity and platoon questions");

  return { answers, serviceNumber, nickname, discordName, selectedPlatoons };
}
