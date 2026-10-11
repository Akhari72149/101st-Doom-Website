import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { JoinModlistKey } from "@/data/joinPageLinks";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export class JoinModlistValidationError extends Error {}

function storageRoot() {
  const configured = process.env.JOIN_MODLIST_DIRECTORY?.trim();
  if (configured) {
    if (!path.isAbsolute(configured)) throw new Error("JOIN_MODLIST_DIRECTORY must be an absolute path");
    return configured;
  }
  return process.env.NODE_ENV === "production"
    ? path.resolve(process.cwd(), "..", "101st-Doom-Website-Data", "join-modlists")
    : path.resolve(process.cwd(), ".runtime-data", "join-modlists");
}

function currentPath(key: JoinModlistKey) {
  return path.join(storageRoot(), `${key}.html`);
}

function safeOriginalName(value: string) {
  const base = path.basename(value || "modlist.html").replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 180);
  return base || "modlist.html";
}

export async function saveJoinModlist(key: JoinModlistKey, file: File) {
  const originalName = safeOriginalName(file.name);
  if (!/\.html?$/i.test(originalName)) throw new JoinModlistValidationError("Only exported HTML modlists can be uploaded");
  if (file.size < 64 || file.size > MAX_FILE_SIZE) throw new JoinModlistValidationError("Modlist files must be between 64 bytes and 10 MB");

  const contents = Buffer.from(await file.arrayBuffer());
  const opening = contents.subarray(0, Math.min(contents.length, 4096)).toString("utf8").toLowerCase();
  if (!opening.includes("<html") && !opening.includes("<!doctype html")) {
    throw new JoinModlistValidationError("The selected file does not appear to be an HTML modlist");
  }

  const root = storageRoot();
  const destination = currentPath(key);
  const history = path.join(root, "history", key);
  await mkdir(history, { recursive: true });

  let previous: Buffer | null = null;
  try {
    previous = await readFile(destination);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await copyFile(destination, path.join(history, `${stamp}.html`));
  } catch (caught) {
    if ((caught as NodeJS.ErrnoException).code !== "ENOENT") throw caught;
  }

  await writeFile(destination, contents, { mode: 0o600 });
  return {
    originalName,
    size: contents.length,
    sha256: createHash("sha256").update(contents).digest("hex"),
    previous,
  };
}

export async function restoreJoinModlist(key: JoinModlistKey, previous: Buffer | null) {
  if (previous) await writeFile(currentPath(key), previous, { mode: 0o600 });
  else await unlink(currentPath(key)).catch((caught: NodeJS.ErrnoException) => {
    if (caught.code !== "ENOENT") throw caught;
  });
}

export function readJoinModlist(key: JoinModlistKey) {
  return readFile(currentPath(key));
}
