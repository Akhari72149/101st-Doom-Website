import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

console.log("🚀 CERT SYNC STARTED");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DISCORD_BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN")!;
const GUILD_ID = Deno.env.get("DISCORD_GUILD_ID")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  try {
    const body = await req.json();

    console.log("🔥 Incoming Payload:", body);

    const { discord_id, role_id, action } = body;

    if (!discord_id || !role_id) {
      console.log("❌ Missing fields");
      return new Response(
        JSON.stringify({ error: "Missing discord_id or role_id" }),
        { status: 400 }
      );
    }

    if (!GUILD_ID) {
      console.log("❌ Missing GUILD_ID env");
      return new Response("Missing guild id", { status: 500 });
    }

    // Ensure we always have an array
    const discordIds = Array.isArray(discord_id)
      ? discord_id
      : [discord_id];

    console.log("👥 Users to process:", discordIds);

    const results = [];

    for (const id of discordIds) {
      console.log("➡ Processing user:", id);

      const url = `https://discord.com/api/guilds/${GUILD_ID}/members/${id}/roles/${role_id}`;

      const response = await fetch(url, {
        method: action === "revoke" ? "DELETE" : "PUT",
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        },
      });

      results.push({
        discord_id: id,
        status: response.status,
      });
    }

    console.log("✅ DONE");

    return new Response(
      JSON.stringify({
        success: true,
        processed: results,
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
