import { NextResponse } from "next/server";
import { exec } from "child_process";
import path from "path";
import fs from "fs";

export async function POST(req: Request) {
  console.log("🛑 STOP ROUTE HIT");

  try {
    const { serverId } = await req.json();
    console.log("Server ID:", serverId);

    if (!serverId || serverId < 1 || serverId > 6) {
      return NextResponse.json(
        { error: "Invalid server id" },
        { status: 400 }
      );
    }



    const scriptPath = path.join(
  process.cwd(),               
  "src",
  "app",
  "Auto Server",
  "Main Stop Exe",
  `Server ${serverId}.bat`
);

    console.log("Script Path:", scriptPath);

    // ✅ Verify script exists
    const exists = fs.existsSync(scriptPath);
    console.log("File Exists?", exists);

    if (!exists) {
      return NextResponse.json(
        { error: "Stop script not found in container" },
        { status: 500 }
      );
    }

    // ✅ Execute stop script
    exec(`cmd /c ""${scriptPath}""`, (err, stdout, stderr) => {
      console.log("EXEC OUTPUT:", stdout);
      console.log("EXEC ERROR:", stderr);

      if (err) {
        console.error("EXEC FAILED:", err);
      }
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Route Error:", err);

    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
