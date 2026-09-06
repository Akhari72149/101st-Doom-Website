"use client";

import { useEffect, useState } from "react";
import { getAppSession } from "@/lib/client-auth";
import { useRouter } from "next/navigation";

export function useAdminGuard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      const session = await getAppSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      if (!session.roles.some((role) => role.toLowerCase() === "admin")) {
        router.replace("/");
        return;
      }

      setLoading(false);
    };

    check();
  }, [router]);

  return loading;
}
