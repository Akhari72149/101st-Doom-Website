import type { DocumentAlignment, DocumentBlock, DocumentBlockType, DocumentColour, DocumentFont, DocumentRun } from "@/data/siteDocuments";

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function runHtml(run: DocumentRun) {
  const styles = [run.font && `font-family:'${run.font}'`, run.size && `font-size:${run.size}px`, run.colour && run.colour !== "default" && `color:${{ green: "#00ff66", cyan: "#67e8f9", amber: "#facc15", red: "#fca5a5" }[run.colour]}`].filter(Boolean).join(";");
  let value = escapeHtml(run.text).replace(/\n/g, "<br>");
  if (styles) value = `<span style="${styles}">${value}</span>`;
  if (run.bold) value = `<strong>${value}</strong>`;
  if (run.italic) value = `<em>${value}</em>`;
  if (run.underline) value = `<u>${value}</u>`;
  if (run.href) value = `<a href="${escapeHtml(run.href)}">${value}</a>`;
  return value;
}

export function documentToEditorHtml(content: DocumentBlock[]) {
  return content.map((block) => {
    const value = block.runs.map(runHtml).join("") || "<br>";
    const style = `text-align:${block.align};${block.level ? `margin-left:${block.level * 24}px` : ""}`;
    if (block.type === "divider") return "<hr>";
    if (block.type === "heading1") return `<h2 style="${style}">${value}</h2>`;
    if (block.type === "heading2") return `<h3 style="${style}">${value}</h3>`;
    if (block.type === "heading3") return `<h4 style="${style}">${value}</h4>`;
    if (block.type === "numbered") return `<ol start="${block.start || 1}" style="${style}"><li>${value}</li></ol>`;
    if (block.type === "bullet") return `<ul style="${style}"><li>${value}</li></ul>`;
    return `<p style="${style}">${value}</p>`;
  }).join("");
}

type RunState = Omit<DocumentRun, "text">;

function cleanUrl(value: string) {
  try { const parsed = new URL(value); return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : undefined; } catch { return undefined; }
}

function runsFrom(node: Node, inherited: RunState = {}): DocumentRun[] {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ? [{ text: node.textContent, ...inherited }] : [];
  if (!(node instanceof HTMLElement)) return [];
  if (node.tagName === "BR") return [{ text: "\n", ...inherited }];
  const next = { ...inherited };
  const tag = node.tagName;
  if (tag === "STRONG" || tag === "B" || Number.parseInt(node.style.fontWeight || "0", 10) >= 600) next.bold = true;
  if (tag === "EM" || tag === "I" || node.style.fontStyle === "italic") next.italic = true;
  if (tag === "U" || node.style.textDecoration.includes("underline")) next.underline = true;
  if (tag === "A") next.href = cleanUrl(node.getAttribute("href") || "");
  const font = node.style.fontFamily.replace(/["']/g, "").split(",")[0].trim() as DocumentFont;
  const legacyFont = (node.getAttribute("face") || "") as DocumentFont;
  if (["Orbitron", "Alegreya", "Arial", "Times New Roman", "Courier New", "Oswald"].includes(font)) next.font = font;
  else if (["Orbitron", "Alegreya", "Arial", "Times New Roman", "Courier New", "Oswald"].includes(legacyFont)) next.font = legacyFont;
  const legacySizes = [8, 10, 12, 14, 18, 24, 36];
  const legacySize = Number.parseInt(node.getAttribute("size") || "0", 10);
  const size = Math.round(Number.parseFloat(node.style.fontSize)) || legacySizes[legacySize - 1] || 0;
  if (size >= 8 && size <= 36) next.size = size;
  const colourMap: Record<string, DocumentColour> = { "rgb(0, 255, 102)": "green", "rgb(103, 232, 249)": "cyan", "rgb(250, 204, 21)": "amber", "rgb(252, 165, 165)": "red" };
  if (colourMap[node.style.color]) next.colour = colourMap[node.style.color];
  const runs = Array.from(node.childNodes).flatMap((child) => runsFrom(child, next));
  return runs.reduce<DocumentRun[]>((merged, run) => {
    const previous = merged[merged.length - 1];
    const signature = (value: DocumentRun) => JSON.stringify(Object.entries(value).filter(([key]) => key !== "text"));
    if (previous && signature(previous) === signature(run)) previous.text += run.text;
    else merged.push(run);
    return merged;
  }, []);
}

export function editorHtmlToDocument(html: string): DocumentBlock[] {
  const root = new DOMParser().parseFromString(`<main>${html}</main>`, "text/html").querySelector("main");
  if (!root) return [];
  const blocks: DocumentBlock[] = [];
  for (const element of Array.from(root.children)) {
    const tag = element.tagName;
    if (tag === "HR") { blocks.push({ type: "divider", align: "left", runs: [] }); continue; }
    const align = (["left", "center", "right"].includes((element as HTMLElement).style.textAlign) ? (element as HTMLElement).style.textAlign : "left") as DocumentAlignment;
    const margin = Number.parseFloat((element as HTMLElement).style.marginLeft) || 0;
    const level = Math.max(0, Math.min(3, Math.round(margin / 24)));
    if (tag === "OL" || tag === "UL") {
      const start = tag === "OL" ? Number.parseInt(element.getAttribute("start") || "1", 10) : undefined;
      Array.from(element.children).filter((child) => child.tagName === "LI").forEach((child, offset) => {
        blocks.push({ type: tag === "OL" ? "numbered" : "bullet", align, level,
          ...(start ? { start: start + offset } : {}), runs: runsFrom(child) });
      });
      continue;
    }
    const type: DocumentBlockType = tag === "H2" || tag === "H1" ? "heading1" : tag === "H3" ? "heading2" : tag === "H4" ? "heading3" : "paragraph";
    const runs = runsFrom(element);
    if (runs.some((run) => run.text.trim())) blocks.push({ type, align, level, runs });
  }
  return blocks;
}
