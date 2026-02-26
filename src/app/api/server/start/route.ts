import { NextResponse } from "next/server";
import { exec } from "child_process";
import path from "path";

export async function POST(req: Request) {
  try {
    const { serverId } = await req.json();

    if (!serverId || serverId < 1 || serverId > 6) {
      return NextResponse.json(
        { error: "Invalid server id" },
        { status: 400 }
      );
    }

    const scriptPath = path.join(
      "C:",
      "Users",
      "Admin",
      "Desktop",
      "Auto Server",
      "Main Start",
      `Server ${serverId} Start.bat`
    );

    exec(`cmd /c "${scriptPath}"`);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}