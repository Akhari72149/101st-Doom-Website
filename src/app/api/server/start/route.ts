import { NextResponse } from "next/server";
import { exec } from "child_process";
import path from "path";
import fs from "fs";

export async function POST(req: Request) {
  console.log("🚀 START ROUTE HIT");

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
  process.cwd(),                // /app
  "src",
  "app",
  "Auto Server",
  "Main Start",
  `Server ${serverId} Start.bat`
);

    console.log("Script Path:", scriptPath);

    // ✅ Check if file exists inside container
    const exists = fs.existsSync(scriptPath);
    console.log("File Exists?", exists);

    if (!exists) {
      return NextResponse.json(
        { error: "Script not found in container" },
        { status: 500 }
      );
    }

    // ✅ Execute the bat file
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