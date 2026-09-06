import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

function getSupabaseAdmin() {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Hosted Supabase database access is not configured");
  }
  client = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  return client;
}

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, property) {
    const value = Reflect.get(getSupabaseAdmin(), property);
    return typeof value === "function" ? value.bind(getSupabaseAdmin()) : value;
  },
});
