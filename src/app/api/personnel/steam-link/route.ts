import { NextResponse } from "next/server";
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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const personnelId = url.searchParams.get("personnelId") || "";

  if (!isUuid(personnelId)) {
    return NextResponse.json(
      { steamLink: null },
      { status: 400, headers: noStoreHeaders },
    );
  }

  const { data } = await supabaseAdmin
    .from("personnel_steam_links")
    .select(
      "steam_id,steam_display_name,steam_profile_url,steam_avatar_url,linked_at",
    )
    .eq("personnel_id", personnelId)
    .is("revoked_at", null)
    .order("linked_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      steam_id: string;
      steam_display_name: string | null;
      steam_profile_url: string | null;
      steam_avatar_url: string | null;
      linked_at: string | null;
    }>();

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
