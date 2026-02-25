import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const artPath = path.join(process.cwd(), "public/art");

    // ✅ Only allow these folders
    const allowedFolders = ["Advisor", "Sheperd", "Sigma"];

    const folders = fs.readdirSync(artPath, {
      withFileTypes: true,
    });

    const commanders = folders
      .filter(
        (dir) =>
          dir.isDirectory() &&
          allowedFolders.includes(dir.name)
      )
      .map((dir) => {
        const folderPath = path.join(artPath, dir.name);

        const images = fs
          .readdirSync(folderPath)
          .filter((file) =>
            [".jpg", ".jpeg", ".png", ".webp"].includes(
              path.extname(file).toLowerCase()
            )
          )
          .map((file) => `/art/${dir.name}/${file}`);

        return {
          name: dir.name,
          folder: dir.name,
          images,
        };
      });

    return NextResponse.json(commanders);
  } catch (err) {
    console.error(err);
    return NextResponse.json([], { status: 500 });
  }
}