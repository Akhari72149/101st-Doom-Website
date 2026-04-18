// app/api/site-version/route.ts
import { NextResponse } from "next/server";
import { SITE_VERSION } from "@/lib/site-version";

export const revalidate = 600;

const OWNER = "Akhari72149";
const REPO = "101st-Doom-Website";

export async function GET() {
  try {
    const headers: HeadersInit = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };

    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    const response = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/commits?per_page=1`,
      {
        headers,
        next: { revalidate: 600 },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to load commit data." },
        { status: 500 }
      );
    }

    const commits = await response.json();
    const latest = commits?.[0];

    return NextResponse.json({
      version: SITE_VERSION,
      commitMessage: latest?.commit?.message || "No commit message",
      shortSha: latest?.sha?.slice(0, 7) || "unknown",
      committedAt: latest?.commit?.author?.date || null,
      author: latest?.commit?.author?.name || "Unknown",
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to load website version data." },
      { status: 500 }
    );
  }
}