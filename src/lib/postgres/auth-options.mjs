import { username } from 'better-auth/plugins';
import { hashPassword, verifyPassword } from 'better-auth/crypto';
import { compare } from 'bcryptjs';
import { nativeAuthConfig } from './config.mjs';

// Supabase credential hashes remain usable during migration. New passwords use scrypt.
export async function verifyMigratedPassword({ hash, password }) {
  if (/^\$2[aby]\$\d{2}\$/.test(hash)) return compare(password, hash);
  return verifyPassword({ hash, password });
}

export function makeAuthOptions(database, env = process.env) {
  const config = nativeAuthConfig(env);
  return {
    appName: '101st Doom Battalion',
    database,
    secret: config.secret,
    baseURL: config.origin,
    basePath: '/api/native-auth',
    trustedOrigins: [config.origin],
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      password: { hash: hashPassword, verify: verifyMigratedPassword },
    },
    user: {
      modelName: 'app_auth_users',
      additionalFields: {
        disabled: { type: /** @type {const} */ ('boolean'), defaultValue: false, input: false },
        mustChangePassword: { type: /** @type {const} */ ('boolean'), defaultValue: false, input: false },
      },
    },
    account: { modelName: 'app_auth_accounts', identityStrategy: /** @type {const} */ ('provider-id') },
    session: {
      modelName: 'app_auth_sessions',
      expiresIn: 60 * 60 * 8,
      updateAge: 60 * 30,
      cookieCache: { enabled: false },
    },
    verification: { modelName: 'app_auth_verifications' },
    rateLimit: {
      enabled: true,
      storage: /** @type {const} */ ('database'),
      modelName: 'app_auth_rate_limits',
      window: 60,
      max: 60,
      customRules: { '/sign-in/username': { window: 60, max: 5 } },
    },
    advanced: {
      database: { generateId: /** @type {const} */ ('uuid') },
      cookiePrefix: 'doom_native',
      useSecureCookies: config.origin.startsWith('https:'),
    },
    plugins: [username({ minUsernameLength: 3, maxUsernameLength: 40 })],
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            const result = await database.query('select disabled from app_auth_users where id = $1', [session.userId]);
            if (!result.rows[0] || result.rows[0].disabled) return false;
            return { data: session };
          },
        },
      },
    },
  };
}
