import "server-only";
import { betterAuth } from "better-auth";
import { getPostgresPool } from "./pool";
import { makeAuthOptions } from "./auth-options.mjs";

let auth: ReturnType<typeof createAuth> | undefined;
function createAuth() { return betterAuth(makeAuthOptions(getPostgresPool())); }

export function getNativeAuth() {
  if (process.env.NATIVE_AUTH_ENABLED !== "true") throw new Error("Native authentication is disabled");
  auth ??= createAuth();
  return auth;
}

export async function getNativeSession(
  headers: Headers,
  options: { allowPasswordChangeRequired?: boolean } = {},
) {
  const session = await getNativeAuth().api.getSession({ headers });
  if (!session || session.user.disabled) return null;
  if (session.user.mustChangePassword && !options.allowPasswordChangeRequired) return null;
  return session;
}
