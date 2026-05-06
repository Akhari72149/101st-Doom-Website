import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    console.log("[website-action] API route hit");

    const body = await req.json();

    console.log("[website-action] Payload:", body);

    const botUrl = process.env.WEBSITE_BOT_ACTION_URL;
    const secret = process.env.WEBSITE_BOT_SECRET;

    console.log("[website-action] Bot URL:", botUrl ? botUrl : "MISSING");
    console.log("[website-action] Secret exists:", secret ? "YES" : "NO");

    if (!botUrl || !secret) {
      return NextResponse.json(
        {
          error: "Missing WEBSITE_BOT_ACTION_URL or WEBSITE_BOT_SECRET",
        },
        { status: 500 }
      );
    }

    const response = await fetch(botUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();

    console.log("[website-action] Bot response status:", response.status);
    console.log("[website-action] Bot response body:", text);

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (error: any) {
    console.error("[website-action] API error:", error);

    return NextResponse.json(
      {
        error: error.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}