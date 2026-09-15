import { APIError, betterAuth, type BetterAuthPlugin } from 'better-auth';
import { emailOTP } from 'better-auth/plugins/email-otp';
import { passkey } from '@better-auth/passkey';
import { displayText } from '../http.js';
import { sendOtpEmail } from './email-sender.js';

export const SESSION_EXPIRES_IN = 60 * 60 * 24 * 30;
export const SESSION_UPDATE_AGE = 60 * 60 * 24 * 10;

export interface AuthHooks { onEmailSent?: (sent: boolean) => void }

/** Production trusts only its configured origin; local and staging also accept the requesting origin. */
export function authOrigins(env: { ENVIRONMENT: string; BASE_URL: string }, request: Request): { baseURL: string; trustedOrigins: string[] } {
  if (env.ENVIRONMENT === 'production') return { baseURL: env.BASE_URL, trustedOrigins: [env.BASE_URL] };
  const origin = new URL(request.url).origin;
  return { baseURL: origin, trustedOrigins: [...new Set([origin, env.BASE_URL])] };
}

async function registrationName(db: D1Database, value: unknown): Promise<string> {
  const name = displayText(value, 24);
  if (!name) throw new APIError('BAD_REQUEST', { code: 'INVALID_DISPLAY_NAME', message: 'INVALID_DISPLAY_NAME' });
  if (await db.prepare('SELECT 1 FROM "user" WHERE name = ?').bind(name).first()) {
    throw new APIError('BAD_REQUEST', { code: 'DISPLAY_NAME_TAKEN', message: 'DISPLAY_NAME_TAKEN' });
  }
  return name;
}

/** Built per request: D1 and the passkey relying party both come from the current request. */
export function createAuth(env: Env, request: Request, hooks: AuthHooks = {}, extraPlugins: BetterAuthPlugin[] = []) {
  if (!env.AUTH_SECRET) throw new Error('AUTH_SECRET_MISSING');
  const requestUrl = new URL(request.url);
  const { baseURL, trustedOrigins } = authOrigins(env, request);
  return betterAuth({
    appName: '魔導戦記',
    baseURL,
    basePath: '/api/auth',
    secret: env.AUTH_SECRET,
    trustedOrigins,
    database: env.DB,
    telemetry: { enabled: false },
    emailAndPassword: { enabled: false },
    session: { expiresIn: SESSION_EXPIRES_IN, updateAge: SESSION_UPDATE_AGE },
    // Workers has no NODE_ENV=production, so the limiter must be enabled and stored explicitly.
    rateLimit: { enabled: true, storage: 'database', modelName: 'rate_limit', fields: { lastRequest: 'last_request' } },
    advanced: {
      cookiePrefix: 'madou',
      // x-forwarded-for can be spoofed from its first hop. Without Cloudflare's header every
      // client would share one bucket, so the email guard is the only limit there.
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'], disableIpTracking: !request.headers.has('cf-connecting-ip') },
    },
    databaseHooks: {
      user: { create: { before: async user => ({ data: { ...user, name: await registrationName(env.DB, user.name) } }) } },
    },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 300,
        allowedAttempts: 3,
        storeOTP: 'hashed',
        rateLimit: { window: 60, max: 10 },
        async sendVerificationOTP({ email, otp, type }) {
          if (type !== 'sign-in') return;
          hooks.onEmailSent?.(await sendOtpEmail(env, email, otp));
        },
      }),
      passkey({ rpID: requestUrl.hostname, rpName: '魔導戦記', origin: requestUrl.origin }),
      ...extraPlugins,
    ],
  });
}
