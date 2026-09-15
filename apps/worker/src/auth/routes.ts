import { HttpError, json, readJson } from '../http.js';
import { createAuth } from './better-auth.js';
import { acquireLease, clearAttempts, consumeAttempt, LIMITS, refundAttempt, releaseLease } from './rate-limit.js';

const SEND = 'POST /email-otp/send-verification-otp';
const VERIFY = 'POST /sign-in/email-otp';
const IP_LIMITED = new Set(['GET /passkey/generate-authenticate-options', 'POST /passkey/verify-authentication']);
const OPEN = new Set(['GET /get-session', 'POST /sign-out', 'GET /passkey/generate-register-options',
  'POST /passkey/verify-registration', 'GET /passkey/list-user-passkeys', 'POST /passkey/delete-passkey']);

function noStore(response: Response): Response {
  const copy = new Response(response.body, response);
  copy.headers.set('Cache-Control', 'no-store');
  copy.headers.set('X-Content-Type-Options', 'nosniff');
  return copy;
}

async function limitIp(db: D1Database, request: Request, route: string): Promise<void> {
  const ip = request.headers.get('cf-connecting-ip');
  if (ip && !await consumeAttempt(db, `ip:${route}:${ip}`, LIMITS.ip)) throw new HttpError(429, 'RATE_LIMITED');
}

async function otpRoute(request: Request, env: Env, route: typeof SEND | typeof VERIFY): Promise<Response> {
  const body = await readJson(request);
  if (route === SEND && body.type !== 'sign-in') throw new HttpError(404, 'NOT_FOUND');
  const email = typeof body.email === 'string' && body.email.length <= 254 ? body.email.toLowerCase() : null;
  if (!email) throw new HttpError(400, 'INVALID_REQUEST');
  if (route === VERIFY && (typeof body.otp !== 'string' || !/^\d{6}$/.test(body.otp))) throw new HttpError(400, 'INVALID_OTP');
  await limitIp(env.DB, request, route);
  const key = route === SEND ? `send:${email}` : `verify:${email}`;
  if (!await consumeAttempt(env.DB, key, route === SEND ? LIMITS.send : LIMITS.verify)) throw new HttpError(429, 'RATE_LIMITED');

  let emailSent = true;
  const auth = createAuth(env, request, { onEmailSent: sent => { emailSent = sent; } });
  const headers = new Headers(request.headers);
  headers.delete('Content-Length');
  const forwarded = new Request(request.url, { method: 'POST', headers, body: JSON.stringify(body) });
  const lease = await acquireLease(env.DB, email);
  let response: Response;
  try { response = await auth.handler(forwarded); }
  finally { if (!await releaseLease(env.DB, email, lease)) throw new HttpError(503, 'AUTH_UNAVAILABLE'); }

  if (route === SEND) {
    if (!emailSent) {
      await refundAttempt(env.DB, key);
      return json({ error: 'EMAIL_SEND_FAILED' }, 502);
    }
    if (!response.ok) await refundAttempt(env.DB, key);
    // A new code starts a new verification generation.
    else await clearAttempts(env.DB, `verify:${email}`);
  }
  return response;
}

/** Only the endpoints the login UI uses are reachable; password reset, email change and the rest are 404. */
export async function authRoute(request: Request, env: Env): Promise<Response> {
  const route = `${request.method} ${new URL(request.url).pathname.slice('/api/auth'.length)}`;
  if (route === SEND || route === VERIFY) return noStore(await otpRoute(request, env, route));
  if (!OPEN.has(route) && !IP_LIMITED.has(route)) throw new HttpError(404, 'NOT_FOUND');
  if (IP_LIMITED.has(route)) await limitIp(env.DB, request, route);
  return noStore(await createAuth(env, request).handler(request));
}
