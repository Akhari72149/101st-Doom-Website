import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/* ================= SERVER AUTH CHECK ================= */

export async function verifyServerControlRole() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // 🔥 MUST BE SERVICE ROLE KEY
  );

  const cookieStore = cookies();
  const token = cookieStore.get("sb-access-token")?.value;

  if (!token) {
    throw new Error("Unauthorized");
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new Error("Unauthorized");
  }

  // Fetch roles
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  const roles = data?.map((r) => r.role) || [];

  if (!roles.includes("server-control")) {
    throw new Error("Forbidden");
  }

  return user;
}