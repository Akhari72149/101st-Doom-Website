import { NextResponse } from "next/server";
import { exec } from "child_process";
import path from "path";
import { verifyLoggedIn } from "@/lib/serverAuth";

export async function POST(req: Request) {
  try {
    await verifyLoggedIn();

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
      "Main Stop Exe",
      `Server ${serverId}.bat`
    );

    exec(`cmd /c "${scriptPath}"`);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return new NextResponse("Unauthorized", { status: 403 });
  }
}