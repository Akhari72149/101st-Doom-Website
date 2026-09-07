import { PALETTE, type CustomiserProject, type EditorAction } from "./types";

export function buildProject(modelId: string, rank: string, actions: EditorAction[], createdAt?: string): CustomiserProject {
  const now = new Date().toISOString();
  return { schemaVersion: 1, modelId, rank, actions, createdAt: createdAt ?? now, updatedAt: now };
}

export function parseProject(value: string): CustomiserProject {
  const project = JSON.parse(value) as Partial<CustomiserProject>;
  if (project.schemaVersion !== 1 || typeof project.modelId !== "string" || typeof project.rank !== "string" || !Array.isArray(project.actions)) {
    throw new Error("This is not a supported customiser project file.");
  }
  for (const action of project.actions) {
    if (!action || (action.type !== "stroke" && action.type !== "logo") || typeof action.zoneId !== "string") {
      throw new Error("The project contains an invalid editor action.");
    }
    if (action.type === "stroke" && !PALETTE.includes(action.colour)) {
      throw new Error("The project contains a colour outside the approved palette.");
    }
  }
  return project as CustomiserProject;
}

export function downloadFile(name: string, contents: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}
