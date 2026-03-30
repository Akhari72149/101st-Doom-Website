import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";

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

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const { data: roles, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (roleError) {
    return { ok: false, status: 500, error: "Failed to check roles" };
  }

  const roleList = roles?.map((r: any) => r.role) || [];
  const allowed = roleList.includes("admin") || roleList.includes("logistics");

  if (!allowed) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  return { ok: true, user };
}