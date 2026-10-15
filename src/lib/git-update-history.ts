import "server-only";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const CACHE_MS = 60_000;

export type GitUpdateEntry = {
  hash: string;
  shortHash: string;
  authoredAt: string;
  author: string;
  subject: string;
  notes: string;
  refs: string[];
};

export type GitUpdateHistory = {
  available: boolean;
  branch: string | null;
  currentCommit: string | null;
  entries: GitUpdateEntry[];
  message: string | null;
};

let cached: { expiresAt: number; value: GitUpdateHistory } | null = null;

async function runGit(args: string[]) {
  const { stdout } = await execFileAsync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 5 * 1024 * 1024,
    windowsHide: true,
  });
  return stdout.trim();
}

export async function getGitUpdateHistory(): Promise<GitUpdateHistory> {
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  try {
    const [branch, currentCommit, rawLog] = await Promise.all([
      runGit(["branch", "--show-current"]),
      runGit(["rev-parse", "--short=12", "HEAD"]),
      runGit([
        "log",
        "--first-parent",
        "--date=iso-strict",
        "--pretty=format:%H%x00%h%x00%aI%x00%an%x00%s%x00%b%x00%D%x1e",
      ]),
    ]);

    const entries = rawLog
      .split("\x1e")
      .map((record) => record.replace(/^\s+|\s+$/g, ""))
      .filter(Boolean)
      .map((record) => {
        const [hash = "", shortHash = "", authoredAt = "", author = "", subject = "", notes = "", refs = ""] = record.split("\x00");
        return {
          hash,
          shortHash,
          authoredAt,
          author,
          subject,
          notes: notes.trim(),
          refs: refs.split(",").map((ref) => ref.trim()).filter(Boolean),
        } satisfies GitUpdateEntry;
      });

    const value: GitUpdateHistory = {
      available: true,
      branch: branch || null,
      currentCommit: currentCommit || null,
      entries,
      message: null,
    };
    cached = { expiresAt: Date.now() + CACHE_MS, value };
    return value;
  } catch (error) {
    console.error("[system-health] Git update history unavailable", error);
    const value: GitUpdateHistory = {
      available: false,
      branch: null,
      currentCommit: null,
      entries: [],
      message: "Git history is not available in this deployment.",
    };
    cached = { expiresAt: Date.now() + CACHE_MS, value };
    return value;
  }
}
