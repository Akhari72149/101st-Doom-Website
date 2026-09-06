export type DiscordDatabaseBackend = "postgres" | "supabase";

export function getDiscordDatabaseBackend(): DiscordDatabaseBackend {
  const value = process.env.DISCORD_DATABASE_BACKEND || "supabase";
  if (value !== "postgres" && value !== "supabase") {
    throw new Error("Unknown DISCORD_DATABASE_BACKEND");
  }
  return value;
}

