import { NextRequest, NextResponse } from "next/server";
import {
  authorizeDiscordOutbox,
  claimDiscordOutbox,
  completeDiscordOutbox,
  failDiscordOutbox,
  type DiscordOutboxAction,
} from "@/lib/discord-outbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const responseOptions = { headers: { "Cache-Control": "no-store" } };

type RequestBody = {
  action?: DiscordOutboxAction;
  worker?: unknown;
  eventId?: unknown;
  error?: unknown;
  limit?: unknown;
};

export async function POST(request: NextRequest) {
  if (!authorizeDiscordOutbox(request.headers.get("authorization"))) {
    return NextResponse.json(
      { error: "UNAUTHORIZED" },
      { status: 401, ...responseOptions },
    );
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "INVALID_JSON" },
      { status: 400, ...responseOptions },
    );
  }

  try {
    if (body.action === "claim") {
      const events = await claimDiscordOutbox(body.worker, body.limit);
      return NextResponse.json({ events }, responseOptions);
    }
    if (body.action === "complete") {
      const completed = await completeDiscordOutbox(body.worker, body.eventId);
      return NextResponse.json(
        { completed },
        { status: completed ? 200 : 409, ...responseOptions },
      );
    }
    if (body.action === "fail") {
      const event = await failDiscordOutbox(body.worker, body.eventId, body.error);
      return NextResponse.json(
        { event },
        { status: event ? 200 : 409, ...responseOptions },
      );
    }
    return NextResponse.json(
      { error: "INVALID_ACTION" },
      { status: 400, ...responseOptions },
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "OUTBOX_REQUEST_FAILED";
    if (code === "INVALID_WORKER" || code === "INVALID_EVENT_ID") {
      return NextResponse.json(
        { error: code },
        { status: 400, ...responseOptions },
      );
    }
    console.error("[discord-outbox] Request failed", {
      code: error && typeof error === "object" && "code" in error ? error.code : undefined,
    });
    return NextResponse.json(
      { error: "OUTBOX_REQUEST_FAILED" },
      { status: 500, ...responseOptions },
    );
  }
}
