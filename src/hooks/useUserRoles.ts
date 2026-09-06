import { useEffect, useState } from "react";
import { getAppSession } from "@/lib/client-auth";

export const useUserRoles = () => {
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRoles = async () => {
      const session = await getAppSession();
      if (!session) {
        setLoading(false);
        return;
      }
      setRoles(session.roles);
      setLoading(false);
    };

    fetchRoles();
  }, []);

  return { roles, loading };
};
