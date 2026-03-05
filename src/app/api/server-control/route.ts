import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { command } = await req.json();

  const response = await fetch("http://199.33.118.13:3001/server", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ command }),
  });

  const text = await response.text();

  return NextResponse.json({ result: text });
}