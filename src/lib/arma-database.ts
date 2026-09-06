import "server-only";
import { getPostgresPool } from "@/lib/postgres/pool";
import { armaRpcQuery } from "@/lib/postgres/arma-rpc.mjs";

type ArmaFunction = "record_arma_xp_event" | "record_arma_medical_event" | "reset_arma_xp_weekly_data";
type DatabaseError = { code: string; message: string };

export async function callArmaDatabase<T>(name: ArmaFunction, parameters: Record<string, unknown> = {}): Promise<{
  data: T | null;
  error: DatabaseError | null;
}> {
  try {
    const backend = process.env.ARMA_DATABASE_BACKEND || "supabase";
    if (backend === "supabase") {
      const { supabaseAdmin } = await import("@/lib/supabase-admin");
      return await supabaseAdmin.rpc(name, parameters).maybeSingle<T>();
    }
    if (backend !== "postgres") throw new Error("Unknown ARMA_DATABASE_BACKEND");
    const result = await getPostgresPool().query<{ value: T }>(armaRpcQuery(name, parameters));
    if (result.rows.length > 1) throw new Error("Arma function returned more than one result");
    return { data: result.rows[0]?.value ?? null, error: null };
  } catch (error) {
    return { data: null, error: {
      code: error && typeof error === "object" && "code" in error ? String(error.code) : "DATABASE_ERROR",
      message: "Database operation failed",
    } };
  }
}
