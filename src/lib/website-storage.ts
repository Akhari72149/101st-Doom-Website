import "server-only";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

export type WebsiteStoragePage = {
  route: string;
  bytes: number;
  files: number;
  rendering: "static" | "dynamic";
};

export type WebsiteStorageSummary = {
  measuredAt: string;
  totalBytes: number;
  categories: Array<{ key: string; label: string; bytes: number; files: number }>;
  pages: WebsiteStoragePage[];
  unattributedBytes: number;
};

type Cache = { expiresAt: number; value: WebsiteStorageSummary };
const state = globalThis as typeof globalThis & { websiteStorageCache?: Cache };

async function directorySize(directory: string) {
  let bytes = 0;
  let files = 0;
  const pending = [directory];
  while (pending.length) {
    const current = pending.pop() as string;
    const entries = await readdir(current, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(target);
      else if (entry.isFile()) {
        const details = await stat(target).catch(() => null);
        if (details) { bytes += details.size; files += 1; }
      }
    }
  }
  return { bytes, files };
}

async function directOutputSize(serverApp: string, route: string) {
  const relative = route === "/" ? "" : route.replace(/^\//, "");
  const directory = path.join(serverApp, relative);
  const parent = route === "/" ? serverApp : path.dirname(directory);
  const base = route === "/" ? "index" : path.basename(directory);
  let bytes = 0;
  let files = 0;

  const siblings = await readdir(parent, { withFileTypes: true }).catch(() => []);
  for (const entry of siblings) {
    if (!entry.isFile() || !entry.name.startsWith(`${base}.`)) continue;
    const details = await stat(path.join(parent, entry.name)).catch(() => null);
    if (details) { bytes += details.size; files += 1; }
  }

  const direct = await readdir(directory, { withFileTypes: true }).catch(() => []);
  for (const entry of direct) {
    if (!entry.isFile() || !entry.name.startsWith("page.")) continue;
    const details = await stat(path.join(directory, entry.name)).catch(() => null);
    if (details) { bytes += details.size; files += 1; }
  }
  if (route === "/") {
    for (const entry of siblings) {
      if (!entry.isFile() || !entry.name.startsWith("page.")) continue;
      const details = await stat(path.join(serverApp, entry.name)).catch(() => null);
      if (details) { bytes += details.size; files += 1; }
    }
  }
  return { bytes, files };
}

export async function getWebsiteStorageSummary() {
  const now = Date.now();
  if (state.websiteStorageCache && state.websiteStorageCache.expiresAt > now) return state.websiteStorageCache.value;

  const root = process.cwd();
  const nextRoot = path.join(root, ".next");
  const serverApp = path.join(nextRoot, "server", "app");
  const [server, client, publicAssets, totalBuild] = await Promise.all([
    directorySize(path.join(nextRoot, "server")),
    directorySize(path.join(nextRoot, "static")),
    directorySize(path.join(root, "public")),
    directorySize(nextRoot),
  ]);
  const support = {
    bytes: Math.max(0, totalBuild.bytes - server.bytes - client.bytes),
    files: Math.max(0, totalBuild.files - server.files - client.files),
  };

  const manifest = JSON.parse(await readFile(path.join(nextRoot, "app-path-routes-manifest.json"), "utf8")) as Record<string, string>;
  const routes = [...new Set(Object.values(manifest))]
    .filter((route) => !route.startsWith("/api/") && !route.startsWith("/_"))
    .sort((left, right) => left.localeCompare(right));
  const pages = await Promise.all(routes.map(async (route) => {
    const output = await directOutputSize(serverApp, route);
    const htmlPath = route === "/" ? path.join(serverApp, "index.html") : path.join(serverApp, `${route.replace(/^\//, "")}.html`);
    const rendering = await stat(htmlPath).then(() => "static" as const).catch(() => "dynamic" as const);
    return { route, bytes: output.bytes, files: output.files, rendering };
  }));
  pages.sort((left, right) => right.bytes - left.bytes || left.route.localeCompare(right.route));
  const attributed = pages.reduce((sum, page) => sum + page.bytes, 0);
  const categories = [
    { key: "page-output", label: "Page output", bytes: attributed, files: pages.reduce((sum, page) => sum + page.files, 0) },
    { key: "shared-server", label: "Shared server files", bytes: Math.max(0, server.bytes - attributed), files: Math.max(0, server.files - pages.reduce((sum, page) => sum + page.files, 0)) },
    { key: "client", label: "Shared client files", bytes: client.bytes, files: client.files },
    { key: "public", label: "Public images and files", bytes: publicAssets.bytes, files: publicAssets.files },
    { key: "support", label: "Build cache and support", bytes: support.bytes, files: support.files },
  ];
  const value: WebsiteStorageSummary = {
    measuredAt: new Date().toISOString(),
    totalBytes: totalBuild.bytes + publicAssets.bytes,
    categories,
    pages,
    unattributedBytes: Math.max(0, totalBuild.bytes + publicAssets.bytes - attributed),
  };
  state.websiteStorageCache = { expiresAt: now + 5 * 60_000, value };
  return value;
}
