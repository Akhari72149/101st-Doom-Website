import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const botUrl = process.env.WEBSITE_BOT_ACTION_URL;
    const secret = process.env.WEBSITE_BOT_SECRET;

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

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (error: any) {
    console.error("Website action API error:", error);

    return NextResponse.json(
      {
        error: error.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}