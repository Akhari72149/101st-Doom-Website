import "server-only";
import { Pool, type PoolClient } from "pg";
import { postgresConfig } from "./config.mjs";

const state = globalThis as typeof globalThis & { rosterPostgresPool?: Pool };

export function getPostgresPool() {
  if (!state.rosterPostgresPool) {
    const pool = new Pool(postgresConfig());
    pool.on("error", () => console.error("[postgres] Idle database connection failed"));
    state.rosterPostgresPool = pool;
  }
  return state.rosterPostgresPool;
}

export async function withPostgresTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPostgresPool().connect();
  let broken = false;
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { broken = true; }
    throw error;
  } finally {
    client.release(broken);
  }
}
