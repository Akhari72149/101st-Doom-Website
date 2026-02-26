import { NextResponse } from "next/server";
import { exec } from "child_process";
import { verifyServerControlRole } from "@/lib/serverAuth";

export async function POST(req: Request) {
  try {
    // 🔐 Verify user + role
    await verifyServerControlRole();

    const { serverId } = await req.json();

    const scriptPath = `C:/scripts/server${serverId}-start.bat`;

    exec(`cmd /c "${scriptPath}"`, (err) => {
      if (err) {
        console.error(err);
      }
    });

    return NextResponse.json({ success: true });

  } catch (err: any) {
    return new NextResponse(err.message || "Unauthorized", {
      status: 403,
    });
  }
}