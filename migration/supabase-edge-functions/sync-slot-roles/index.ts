import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { structure } from "./structure.ts";

/* =====================================================
   SECRETS
===================================================== */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const DISCORD_BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN");
const GUILD_ID =
  Deno.env.get("DISCORD_GUILD_ID") || Deno.env.get("GUILD_ID");

const DEFAULT_ROLE = "497834542900445195";

/* 🔥 DEBUG */
console.log("🟢 Function Starting...");
console.log("Guild ID:", GUILD_ID);
console.log("Bot Token Present:", !!DISCORD_BOT_TOKEN);

const supabase = createClient(
  SUPABASE_URL!,
  SUPABASE_SERVICE_ROLE_KEY!
);

/* =====================================================
   CORS
===================================================== */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/* =====================================================
   EDGE FUNCTION
===================================================== */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { personnelId, slotId, oldSlotId, forceDefaultRole } =
      await req.json();

    console.log("🔵 Request Body:", {
      personnelId,
      slotId,
      oldSlotId,
      forceDefaultRole,
    });

    if (!personnelId) {
      return new Response("Missing personnelId", {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (!GUILD_ID || !DISCORD_BOT_TOKEN) {
      return new Response("Missing Discord secrets", {
        status: 500,
        headers: corsHeaders,
      });
    }

    /* =====================================================
       GET PERSON
    ===================================================== */

    const { data: person, error } = await supabase
      .from("personnel")
      .select("*")
      .eq("id", personnelId)
      .single();

    if (error || !person) {
      console.error("❌ Person Fetch Error:", error);
      return new Response("Person not found", {
        status: 404,
        headers: corsHeaders,
      });
    }

    if (!person.discord_id) {
      return new Response("No Discord ID", {
        status: 400,
        headers: corsHeaders,
      });
    }

    /* =====================================================
       REMOVE OLD SLOT ROLES
    ===================================================== */

    const slotToRemove = oldSlotId || person.slotted_position;

    if (slotToRemove) {
      const oldSlot = findSlot(slotToRemove);

      if (oldSlot?.discordRoleIds?.length) {
        console.log("🟡 Removing old roles:", oldSlot.discordRoleIds);

        await updateDiscordRoles(
          person.discord_id,
          oldSlot.discordRoleIds,
          false
        );
      }
    }

    /* =====================================================
       ADD NEW SLOT ROLES
    ===================================================== */

    if (slotId) {
      const newSlot = findSlot(slotId);

      if (newSlot?.discordRoleIds?.length) {
        console.log("🟢 Adding new roles:", newSlot.discordRoleIds);

        await updateDiscordRoles(
          person.discord_id,
          newSlot.discordRoleIds,
          true
        );
      }
    }

    /* =====================================================
       DEFAULT ROLE HANDLING (UPDATED)
    ===================================================== */

    // ✅ REMOVE default role when assigning a slot
    if (slotId) {
      console.log("🔴 Removing Default Role (Slot Assigned)");

      await updateDiscordRoles(
        person.discord_id,
        [DEFAULT_ROLE],
        false
      );
    }

    // ✅ ADD default role when unassigning or forced
    if (!slotId || forceDefaultRole) {
      console.log("🔵 Adding Default Role (Unassigned)");

      await addRole(person.discord_id, DEFAULT_ROLE);
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );

  } catch (err: any) {
    console.error("❌ Function Error:", err);

    return new Response(err.message, {
      status: 500,
      headers: corsHeaders,
    });
  }
});

/* =====================================================
   SLOT LOOKUP
===================================================== */

function findSlot(slotId: string) {
  for (const section of structure) {
    for (const sub of section.children || []) {
      for (const role of sub.roles || []) {
        if (role.slotId === slotId) {
          return role;
        }
      }
    }
  }
  return null;
}

/* =====================================================
   DISCORD ROLE HANDLING
===================================================== */

async function updateDiscordRoles(
  discordId: string,
  roleIds: string[],
  add: boolean
) {
  for (const roleId of roleIds) {
    const url = `https://discord.com/api/guilds/${GUILD_ID}/members/${discordId}/roles/${roleId}`;

    console.log("🔵 Discord Request:", {
      url,
      method: add ? "PUT" : "DELETE",
    });

    const res = await fetch(url, {
      method: add ? "PUT" : "DELETE",
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    const text = await res.text();

    console.log("🟡 Discord Response:", {
      status: res.status,
      body: text,
    });

    if (!res.ok) {
      console.error("❌ Discord Role Update Failed", {
        roleId,
        status: res.status,
        body: text,
      });
    }
  }
}

async function addRole(discordId: string, roleId: string) {
  const url = `https://discord.com/api/guilds/${GUILD_ID}/members/${discordId}/roles/${roleId}`;

  console.log("🟢 Adding Default Role:", url);

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
  });

  const text = await res.text();

  console.log("🟡 Default Role Response:", {
    status: res.status,
    body: text,
  });

  if (!res.ok) {
    console.error("❌ Default Role Failed", text);
  }
}
