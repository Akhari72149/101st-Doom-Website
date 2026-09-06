import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

function getSupabaseClient() {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Hosted Supabase authentication is not configured");
  }
  client = createClient(url, key);
  return client;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, property) {
    const value = Reflect.get(getSupabaseClient(), property);
    return typeof value === "function" ? value.bind(getSupabaseClient()) : value;
  },
});
