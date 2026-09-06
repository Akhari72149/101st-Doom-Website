import { NextResponse } from "next/server";
import { getPostgresPool } from "@/lib/postgres/pool";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStoreHeaders = {
  "Cache-Control": "no-store, max-age=0",
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

type SteamLinkRecord = {
  steam_id: string;
  steam_display_name: string | null;
  steam_profile_url: string | null;
  steam_avatar_url: string | null;
  linked_at: string | Date | null;
};

async function readSteamLink(personnelId: string) {
  const backend = process.env.PERSONNEL_DATABASE_BACKEND || "supabase";
  if (backend === "postgres") {
    const result = await getPostgresPool().query<SteamLinkRecord>(
      `select steam_id, steam_display_name, steam_profile_url, steam_avatar_url, linked_at
       from public.personnel_steam_links
       where personnel_id = $1 and revoked_at is null
       order by linked_at desc nulls last limit 1`,
      [personnelId],
    );
    return result.rows[0] || null;
  }
  if (backend !== "supabase") throw new Error("Unknown PERSONNEL_DATABASE_BACKEND");
  const { data, error } = await supabaseAdmin
    .from("personnel_steam_links")
    .select("steam_id,steam_display_name,steam_profile_url,steam_avatar_url,linked_at")
    .eq("personnel_id", personnelId)
    .is("revoked_at", null)
    .order("linked_at", { ascending: false })
    .limit(1)
    .maybeSingle<SteamLinkRecord>();
  if (error) throw error;
  return data;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const personnelId = url.searchParams.get("personnelId") || "";

  if (!isUuid(personnelId)) {
    return NextResponse.json(
      { steamLink: null },
      { status: 400, headers: noStoreHeaders },
    );
  }

  let data: SteamLinkRecord | null;
  try {
    data = await readSteamLink(personnelId);
  } catch (error) {
    console.error("[personnel-profile] Failed to load Steam link:", error);
    return NextResponse.json(
      { steamLink: null, error: "STEAM_LINK_LOAD_FAILED" },
      { status: 500, headers: noStoreHeaders },
    );
  }

  return NextResponse.json(
    {
      steamLink: data
        ? {
            steamId: data.steam_id,
            displayName: data.steam_display_name,
            profileUrl:
              data.steam_profile_url ||
              `https://steamcommunity.com/profiles/${data.steam_id}`,
            avatarUrl: data.steam_avatar_url,
            linkedAt: data.linked_at,
          }
        : null,
    },
    { headers: noStoreHeaders },
  );
}
