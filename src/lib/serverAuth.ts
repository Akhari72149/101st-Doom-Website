// src/lib/serverAuth.ts

import { createClient } from "@supabase/supabase-js";

/**
 * Simple auth check.
 * Only verifies the user is logged in.
 */
export async function verifyLoggedIn() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  return user;
}