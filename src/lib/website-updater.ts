import "server-only";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { SITE_VERSION } from "@/lib/site-version";

const run = promisify(execFile);
const OWNER = "Akhari72149";
const REPOSITORY = "101st-Doom-Website";
const SHA = /^[0-9a-f]{40}$/;
let availableCache: { expiresAt: number; release: CommitDetails } | null = null;

type CommitDetails = {
  sha: string;
  shortSha: string;
  message: string;
  committedAt: string | null;
  version: string;
};

function githubHeaders(): HeadersInit {
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "101st-Doom-Website-Updater",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return headers;
}

export async function getInstalledRelease(): Promise<CommitDetails & { branch: string; clean: boolean }> {
  const [{ stdout: details }, { stdout: branch }, { stdout: status }] = await Promise.all([
    run("git", ["show", "-s", "--format=%H%x00%s%x00%cI", "HEAD"], {
      cwd: process.cwd(), windowsHide: true, timeout: 10_000,
    }),
    run("git", ["branch", "--show-current"], {
      cwd: process.cwd(), windowsHide: true, timeout: 10_000,
    }),
    run("git", ["status", "--porcelain", "--untracked-files=no"], {
      cwd: process.cwd(), windowsHide: true, timeout: 10_000,
    }),
  ]);
  const [sha, message, committedAt] = details.trim().split("\0");
  if (!SHA.test(sha)) throw new Error("Installed Git commit could not be determined");
  return {
    sha,
    shortSha: sha.slice(0, 7),
    message: message || "No commit message",
    committedAt: committedAt || null,
    version: SITE_VERSION,
    branch: branch.trim() || "detached",
    clean: status.trim().length === 0,
  };
}

async function getRemoteVersion(sha: string) {
  const response = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPOSITORY}/contents/src/lib/site-version.ts?ref=${sha}`,
    { headers: githubHeaders(), cache: "no-store", signal: AbortSignal.timeout(10_000) },
  );
  if (!response.ok) return "Unknown";
  const body = await response.json() as { content?: string; encoding?: string };
  if (body.encoding !== "base64" || !body.content) return "Unknown";
  const source = Buffer.from(body.content.replace(/\s/g, ""), "base64").toString("utf8");
  return source.match(/SITE_VERSION\s*=\s*["']([^"']+)["']/)?.[1] || "Unknown";
}

export async function getAvailableRelease(force = false): Promise<CommitDetails> {
  if (!force && availableCache && availableCache.expiresAt > Date.now()) {
    return availableCache.release;
  }
  const response = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPOSITORY}/commits/main`,
    { headers: githubHeaders(), cache: "no-store", signal: AbortSignal.timeout(10_000) },
  );
  if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}`);
  const body = await response.json() as {
    sha?: string;
    commit?: { message?: string; committer?: { date?: string } };
  };
  const sha = String(body.sha || "").toLowerCase();
  if (!SHA.test(sha)) throw new Error("Available Git commit could not be determined");
  const release = {
    sha,
    shortSha: sha.slice(0, 7),
    message: body.commit?.message?.split("\n")[0] || "No commit message",
    committedAt: body.commit?.committer?.date || null,
    version: await getRemoteVersion(sha),
  };
  availableCache = { expiresAt: Date.now() + 60_000, release };
  return release;
}
