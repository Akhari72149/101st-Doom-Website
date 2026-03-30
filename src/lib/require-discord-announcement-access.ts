import { createClient, User } from "@supabase/supabase-js";
import { cookies } from "next/headers";

type AccessDenied = {
  ok: false;
  status: number;
  error: string;
};

type AccessGranted = {
  ok: true;
  user: User;
};

export async function requireDiscordAnnouncementAccess(): Promise<AccessDenied | AccessGranted> {
  const cookieStore = await cookies();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          cookie: cookieStore.toString(),
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (error) {
    return { ok: false, status: 500, error: "Failed to check roles" };
  }

  const roleList = roles?.map((r: any) => r.role) || [];
  const allowed = roleList.includes("admin") || roleList.includes("logistics");

  if (!allowed) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  return { ok: true, user };
}