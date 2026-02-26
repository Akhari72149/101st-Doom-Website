import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/* ================= SERVER AUTH CHECK ================= */

export async function verifyServerControlRole() {
  // ✅ Create Supabase client with service role (server-side only)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // 🔥 Must be service role
  );

  /* =======================================================
     FIX: Explicitly await cookies() to avoid TS Promise type
     ======================================================= */

  const cookieStore = await cookies();

  const token = cookieStore.get("sb-access-token")?.value;

  console.log("Cookies Received:", cookieStore.getAll());
  console.log("Token:", token);

  if (!token) {
    console.log("No token found!");
    // throw new Error("Unauthorized");
  }

  /* =======================================================
     Validate User From Token
     ======================================================= */

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new Error("Unauthorized");
  }

  /* =======================================================
     Fetch User Roles
     ======================================================= */

  const { data: roleData, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (roleError) {
    throw new Error("Role Fetch Failed");
  }

  const roles = roleData?.map((r) => r.role) || [];

  /* =======================================================
     Permission Check
     ======================================================= */

  if (!roles.includes("server-control")) {
    throw new Error("Forbidden");
  }

  return user;
}