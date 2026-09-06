import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

console.log("🚀 Discord Role Sync Function Started");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DISCORD_BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN")!;
const GUILD_ID = Deno.env.get("DISCORD_GUILD_ID")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

/* =====================================================
   ROLE CONFIG
===================================================== */

const ROLES_TO_ADD = [
  "446025365496922142",
  "848579852712804383",
  "848594325695758407",
  "848607945825845309",
  "833549617105993820",
  "446542700951633923",
  "848580245799436298",
  "848580118849781790",
  "763191706249986078",
  "933083212735987722",
];

const ROLE_TO_REMOVE = "492653693091577856";

/* =====================================================
   MAIN FUNCTION
===================================================== */

serve(async (req) => {
  try {
    const { discord_id } = await req.json();

    if (!discord_id) {
      return new Response(
        JSON.stringify({ error: "Missing discord_id" }),
        { status: 400 }
      );
    }

    console.log("🔎 Processing role sync for:", discord_id);

    /* =====================================================
       GET MEMBER FROM DISCORD
    ====================================================== */

    const memberRes = await fetch(
      `https://discord.com/api/guilds/${GUILD_ID}/members/${discord_id}`,
      {
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        },
      }
    );

    if (!memberRes.ok) {
      console.log("⚠ Member not found in guild");
      return new Response(
        JSON.stringify({ error: "Member not found" }),
        { status: 200 }
      );
    }

    const member = await memberRes.json();
    const currentRoles: string[] = member.roles || [];

    /* =====================================================
       REMOVE SPECIFIC ROLE
    ====================================================== */

    if (currentRoles.includes(ROLE_TO_REMOVE)) {
      console.log("🗑 Removing restricted role...");

      await fetch(
        `https://discord.com/api/guilds/${GUILD_ID}/members/${discord_id}/roles/${ROLE_TO_REMOVE}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          },
        }
      );
    }

    /* =====================================================
       ADD REQUIRED ROLES
    ====================================================== */

    for (const roleId of ROLES_TO_ADD) {
      if (!currentRoles.includes(roleId)) {
        console.log("➕ Adding role:", roleId);

        await fetch(
          `https://discord.com/api/guilds/${GUILD_ID}/members/${discord_id}/roles/${roleId}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
            },
          }
        );
      }
    }

    console.log("✅ Role sync complete");

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200 }
    );

  } catch (err: any) {
    console.error("🔥 Function Error:", err);

    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500 }
    );
  }
});
