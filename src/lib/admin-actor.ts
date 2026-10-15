import "server-only";
import type { AdminRouteAuthResult } from "@/lib/admin-route-auth";
import { getPostgresPool } from "@/lib/postgres/pool";
import { supabaseAdmin } from "@/lib/supabase-admin";

export type AdminActor = {
  userId: string;
  displayName: string;
  personnelId: string | null;
};

export async function resolveAdminActor(auth: AdminRouteAuthResult): Promise<AdminActor> {
  if (!auth.userId) throw new Error("AUTH_REQUIRED");

  if (process.env.NATIVE_AUTH_ENABLED === "true") {
    const result = await getPostgresPool().query<{ display_name: string; personnel_id: string | null }>(
      `select coalesce(nullif(btrim(users."displayUsername"),''),nullif(btrim(users.name),''),
                       nullif(btrim(users.username),''),$2,'Website administrator') display_name,
              matched.id personnel_id
         from public.app_auth_users users
         left join lateral (
           select personnel.id
             from public.personnel personnel
            where personnel.auth_user_id=users.id
               or (personnel.auth_user_id is null and lower(btrim(personnel.name))=lower(btrim(
                    coalesce(nullif(users."displayUsername",''),nullif(users.name,''),users.username))))
            order by (personnel.auth_user_id=users.id) desc, personnel.created_at, personnel.id
            limit 1
         ) matched on true
        where users.id=$1`,
      [auth.userId, auth.email],
    );
    return {
      userId: auth.userId,
      displayName: result.rows[0]?.display_name || auth.email || "Website administrator",
      personnelId: result.rows[0]?.personnel_id || null,
    };
  }

  const profile = await supabaseAdmin.from("profiles").select("display_name")
    .eq("id", auth.userId).maybeSingle<{ display_name: string | null }>();
  const displayName = profile.data?.display_name?.trim() || auth.email || "Website administrator";
  let personnel = await supabaseAdmin.from("personnel").select("id")
    .eq("auth_user_id", auth.userId).limit(1).maybeSingle<{ id: string }>();
  if (!personnel.data && displayName) {
    personnel = await supabaseAdmin.from("personnel").select("id")
      .ilike("name", displayName).limit(1).maybeSingle<{ id: string }>();
  }
  return { userId: auth.userId, displayName, personnelId: personnel.data?.id || null };
}
