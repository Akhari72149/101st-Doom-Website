import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

console.log("🚀 Discord Rank Sync Function Loaded");

/* =====================================================
   CORS
=====================================================*/

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/* =====================================================
   ENV VARIABLES
=====================================================*/

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DISCORD_BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN")!;
const GUILD_ID = Deno.env.get("DISCORD_GUILD_ID")!;

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

/* =====================================================
   EDGE FUNCTION
=====================================================*/

serve(async (req) => {

  // ✅ HANDLE OPTIONS PREFLIGHT (FIXES 500 ERROR)
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const body = await req.json();

    const { personnelId, oldRankId, newRankId } = body;

    if (!personnelId) {
      return new Response(
        JSON.stringify({ error: "Missing personnelId" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    console.log("🔄 Rank Change Detected");
    console.log(body);

    /* =====================================================
       GET PERSON + DISCORD ID
    ======================================================*/

    const { data: person, error: personError } = await supabase
      .from("personnel")
      .select("discord_id")
      .eq("id", personnelId)
      .single();

    if (personError || !person?.discord_id) {
      return new Response(
        JSON.stringify({ error: "Person not found or missing discord_id" }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    const discordId = person.discord_id;

    /* =====================================================
       REMOVE OLD RANK ROLE
    ======================================================*/

    if (oldRankId) {
      const { data: oldRank } = await supabase
        .from("ranks")
        .select("discord_role_id")
        .eq("id", oldRankId)
        .single();

      if (oldRank?.discord_role_id) {
        console.log("🗑 Removing old rank role");

        await fetch(
          `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${discordId}/roles/${oldRank.discord_role_id}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
            },
          }
        );
      }
    }

    /* =====================================================
       ADD NEW RANK ROLE
    ======================================================*/

    if (newRankId) {
      const { data: newRank } = await supabase
        .from("ranks")
        .select("discord_role_id")
        .eq("id", newRankId)
        .single();

      if (!newRank?.discord_role_id) {
        return new Response(
          JSON.stringify({ error: "New rank role not found" }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }

      console.log("➕ Adding new rank role");

      const res = await fetch(
        `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${discordId}/roles/${newRank.discord_role_id}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          },
        }
      );

      const text = await res.text();

      if (!res.ok) {
        console.error("Discord API Error:", text);

        return new Response(
          JSON.stringify({
            error: "Discord API failed",
            details: text,
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }
    }

    console.log("✅ Rank Sync Completed");

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );

  } catch (err: any) {
    console.error("🔥 Function Error:", err);

    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }
});
