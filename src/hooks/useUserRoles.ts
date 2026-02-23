import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export const useUserRoles = () => {
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRoles = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      setRoles(data?.map((r) => r.role) || []);
      setLoading(false);
    };

    fetchRoles();
  }, []);

  return { roles, loading };
};