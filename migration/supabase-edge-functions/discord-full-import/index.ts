import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* =====================================================
   CORS CONFIG
=====================================================*/

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/* =====================================================
   ENV + CLIENT
=====================================================*/

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN")!;
const GUILD_ID = Deno.env.get("DISCORD_GUILD_ID")!;

/* =====================================================
   SERVER
=====================================================*/

serve(async (req) => {
  // ✅ Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { discord_id, personnel_id } = await req.json();
    console.log("Incoming payload:", { discord_id, personnel_id });

    if (!discord_id || !personnel_id) {
      return new Response(
        JSON.stringify({ error: "Missing parameters" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    /* =====================================================
       1️⃣ Get Discord Member
    ======================================================*/

    const memberRes = await fetch(
      `https://discord.com/api/guilds/${GUILD_ID}/members/${discord_id}`,
      {
        headers: {
          Authorization: `Bot ${BOT_TOKEN}`,
        },
      }
    );

    if (!memberRes.ok) {
      return new Response(
        JSON.stringify({ error: "Discord member not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const member = await memberRes.json();
    const discordRoles: string[] = member.roles || [];
    console.log("Discord roles from API:", discordRoles);

    /* =====================================================
       2️⃣ Match Rank
    ======================================================*/

    const { data: ranks, error: rankError } = await supabase
      .from("ranks")
      .select("*")
      .in("discord_role_id", discordRoles);

    if (rankError) throw rankError;
    console.log("Matched ranks from DB:", ranks);

    let bestRankId = null;

    if (ranks && ranks.length > 0) {
      const bestRank = ranks.sort(
        (a, b) => b.rank_level - a.rank_level
      )[0];

      bestRankId = bestRank.id;
    }

    /* =====================================================
       3️⃣ Match Certifications
    ======================================================*/

    const { data: certs, error: certError } = await supabase
      .from("certifications")
      .select("*")
      .in("cert_id", discordRoles);

    if (certError) throw certError;
    console.log("Matched certifications from DB:", certs);

    if (certs && certs.length > 0) {
  for (const cert of certs) {

    console.log("Upserting certification:", cert.id);

    const result = await supabase
      .from("personnel_certifications")
      .upsert(
        {
          personnel_id,
          certification_id: cert.id,
          awarded_at: new Date().toISOString(),
        },
        { onConflict: "personnel_id,certification_id" }
      );

    console.log("Upsert result:", result);
  }
}

    /* =====================================================
       4️⃣ Update Rank
    ======================================================*/

    if (bestRankId) {
      await supabase
        .from("personnel")
        .update({ rank_id: bestRankId })
        .eq("id", personnel_id);
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
