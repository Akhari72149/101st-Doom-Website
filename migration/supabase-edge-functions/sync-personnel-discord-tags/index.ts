import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

console.log("🚀 PERSONNEL TAG SYNC STARTED");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DISCORD_BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN")!;
const GUILD_ID = Deno.env.get("DISCORD_GUILD_ID")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const NO_ROLES_TAG_ID = "492653693091577856";
const RETIRED_TAG_ID = "586776577707081739";

serve(async (req) => {
  try {
    const body = await req.json();

    console.log("🔥 Incoming Payload:", body);

    const { personnel_id, status } = body;

    if (!personnel_id || !status) {
      console.log("❌ Missing fields");
      return new Response(
        JSON.stringify({ error: "Missing personnel_id or status" }),
        { status: 400 }
      );
    }

    if (!GUILD_ID) {
      console.log("❌ Missing GUILD_ID env");
      return new Response("Missing guild id", { status: 500 });
    }

    const normalisedStatus = String(status).trim().toLowerCase();

    if (normalisedStatus !== "removed" && normalisedStatus !== "retired") {
      console.log("ℹ️ Status not relevant, skipping");
      return new Response(
        JSON.stringify({ success: true, skipped: true }),
        { status: 200 }
      );
    }

    const { data: person, error } = await supabase
      .from("personnel")
      .select("discord_id")
      .eq("id", personnel_id)
      .maybeSingle();

    if (error) {
      console.log("❌ Supabase lookup failed:", error.message);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500 }
      );
    }

    if (!person?.discord_id) {
      console.log("❌ No discord_id found");
      return new Response(
        JSON.stringify({ error: "No discord_id found for personnel" }),
        { status: 200 }
      );
    }

    const discordId = String(person.discord_id);
    const targetRoleId =
      normalisedStatus === "retired" ? RETIRED_TAG_ID : NO_ROLES_TAG_ID;

    console.log("👤 Discord user:", discordId);
    console.log("🎯 Target role:", targetRoleId);

    const url = `https://discord.com/api/guilds/${GUILD_ID}/members/${discordId}`;

    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        roles: [targetRoleId],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.log("❌ Discord API error:", response.status, text);

      return new Response(
        JSON.stringify({
          error: "Discord API error",
          status: response.status,
          details: text,
        }),
        { status: 500 }
      );
    }

    console.log("✅ DONE");

    return new Response(
      JSON.stringify({
        success: true,
        discord_id: discordId,
        role_id: targetRoleId,
        status: normalisedStatus,
      }),
      { status: 200 }
    );
  } catch (err) {
    console.error("🔥 FUNCTION ERROR:", err);

    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500 }
    );
  }
});
