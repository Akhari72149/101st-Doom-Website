import "server-only";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServerKey =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL");
}

if (!supabaseServerKey) {
  throw new Error(
    "Missing required server Supabase key: set SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY",
  );
}

export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServerKey,
  {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  },
);
