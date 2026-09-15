import { env } from 'cloudflare:workers';
import { createExecutionContext, reset, runInDurableObject } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import worker from '../src/index.js';
import { ruleset } from '@madou/catalog';
import { sendOtpEmail } from '../src/auth/email-sender.js';
import { otpEmail } from '../src/auth/otp-email.js';
import { RoomStorage } from '../src/rooms/storage.js';
import type { RoomData } from '../src/rooms/types.js';
import { applyMigrations } from './fixtures/schema.js';
import { createTestSession } from './fixtures/test-session.js';

const origin = 'https://game.example';
const DAY = 24 * 60 * 60 * 1000;
beforeEach(async () => { await applyMigrations(env.DB); });
afterEach(async () => { await reset(); });

interface Sent { from: string; to: string; subject: string; text: string; html: string }
/** Replaces Cloudflare Email Sending. `fail` makes the provider reject. */
function mailbox(behaviour: 'deliver' | 'fail' = 'deliver') {
  const sent: Sent[] = [];
  const EMAIL = { send: async (message: Sent) => {
    if (behaviour === 'fail') throw Error('provider rejected noreply@madou-senki.local');
    sent.push(message); return { messageId: crypto.randomUUID() };
  } } as unknown as SendEmail;
  return { sent, env: { ...env, EMAIL } as Env, otp: () => /\b(\d{6})\b/.exec(sent.at(-1)!.text)![1]! };
}
type Mailbox = ReturnType<typeof mailbox>;

function call(path: string, options: { method?: string; body?: unknown; cookie?: string; origin?: string | null; headers?: Record<string, string>; env?: Env } = {}) {
  const headers = new Headers(options.headers);
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  if (options.cookie) headers.set('Cookie', options.cookie);
  if (options.origin !== null) headers.set('Origin', options.origin ?? origin);
  return worker.fetch(new Request(origin + path, { method: options.method ?? 'GET', headers,
    ...(options.body !== undefined ? { body: typeof options.body === 'string' ? options.body : JSON.stringify(options.body) } : {}) }), options.env ?? env, createExecutionContext());
}
const sendCode = (mail: Mailbox, email: string, extra: Record<string, unknown> = {}, headers?: Record<string, string>) =>
  call('/api/auth/email-otp/send-verification-otp', { method: 'POST', body: { email, type: 'sign-in', ...extra }, env: mail.env, ...(headers ? { headers } : {}) });
const signIn = (mail: Mailbox, body: Record<string, unknown>) => call('/api/auth/sign-in/email-otp', { method: 'POST', body, env: mail.env });
function sessionCookie(response: Response) {
  const header = response.headers.getSetCookie().find(value => value.startsWith('__Secure-madou.session_token='));
  return header ? { header, pair: header.split(';')[0]! } : null;
}
async function register(mail: Mailbox, email: string, name?: string) {
  expect((await sendCode(mail, email)).status).toBe(200);
  const response = await signIn(mail, { email, otp: mail.otp(), ...(name === undefined ? {} : { name }) });
  expect(response.status).toBe(200);
  return sessionCookie(response)!.pair;
}
const current = async (cookie: string) => (await call('/api/sessions/current', { cookie })).json();
const moveWindow = (key: string, ms: number) => env.DB.prepare('UPDATE auth_attempt SET window_start = window_start - ? WHERE key = ?').bind(ms, key).run();

describe('email OTP registration and session', () => {
  it('registers with a code, stores only a hash and returns the Better Auth user as the room identity', async () => {
    const mail = mailbox();
    const send = await sendCode(mail, 'Akari@Example.com');
    expect(send.status).toBe(200);
    expect(send.headers.get('Cache-Control')).toBe('no-store');
    expect(mail.sent).toHaveLength(1);
    const otp = mail.otp();
    expect(mail.sent[0]).toMatchObject({ from: 'noreply@madou-senki.local', to: 'akari@example.com', subject: '魔導戦記 ログイン確認コード' });
    expect(mail.sent[0]!.html).toContain(otp);
    expect(await send.text()).not.toContain(otp);
    const stored = await env.DB.prepare('SELECT value FROM verification').first<{ value: string }>();
    expect(stored!.value).not.toContain(otp);

    const response = await signIn(mail, { email: 'akari@example.com', otp, name: '  あかり  ' });
    expect(response.status).toBe(200);
    const cookie = sessionCookie(response)!;
    for (const flag of ['Path=/', 'HttpOnly', 'Secure', 'SameSite=Lax', `Max-Age=${30 * 24 * 60 * 60}`]) expect(cookie.header).toContain(flag);
    expect(cookie.header).not.toMatch(/domain=/i);
    const user = await env.DB.prepare('SELECT id, name FROM "user"').first<{ id: string; name: string }>();
    expect(await current(cookie.pair)).toEqual({ id: user!.id, name: 'あかり' });
  });

  it('keeps the saved display name on later sign-in and rejects duplicate or invalid names for new users', async () => {
    const mail = mailbox();
    await register(mail, 'aoi@example.com', '葵');
    await moveWindow('send:aoi@example.com', 60_000);
    const again = await register(mail, 'aoi@example.com', '別の名前');
    expect(await current(again)).toMatchObject({ name: '葵' });

    for (const [email, name, code] of [['kaede@example.com', '葵', 'DISPLAY_NAME_TAKEN'], ['rin@example.com', '', 'INVALID_DISPLAY_NAME'], ['ren@example.com', 'あ'.repeat(25), 'INVALID_DISPLAY_NAME'], ['mio@example.com', 'A\nB', 'INVALID_DISPLAY_NAME']] as const) {
      expect((await sendCode(mail, email)).status).toBe(200);
      const rejected = await signIn(mail, { email, otp: mail.otp(), name });
      expect(rejected.status).toBe(400);
      expect(await rejected.json()).toMatchObject({ code });
      expect(sessionCookie(rejected)).toBeNull();
    }
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM "user"').first<{ n: number }>())!.n).toBe(1);
  });

  it('returns 401 UNAUTHENTICATED for missing, forged and expired sessions', async () => {
    expect((await call('/api/sessions/current')).status).toBe(401);
    const forged = await call('/api/sessions/current', { cookie: '__Secure-madou.session_token=forged.signature' });
    expect(forged.status).toBe(401);
    expect(await forged.json()).toEqual({ error: 'UNAUTHENTICATED' });
    const cookie = await register(mailbox(), 'expired@example.com', '期限切れ');
    await env.DB.prepare('UPDATE session SET expiresAt = ?').bind(new Date(Date.now() - 1000).toISOString()).run();
    expect((await call('/api/sessions/current', { cookie })).status).toBe(401);
    expect((await call('/api/rooms', { cookie })).status).toBe(401);
  });

  it('extends the cookie only after updateAge has passed', async () => {
    const cookie = await register(mailbox(), 'slide@example.com', '延長');
    const setExpiry = (ms: number) => env.DB.prepare('UPDATE session SET expiresAt = ?').bind(new Date(Date.now() + ms).toISOString()).run();
    // Issued 9 days ago: 21 days remain, so no refresh.
    await setExpiry(21 * DAY);
    const fresh = await call('/api/sessions/current', { cookie });
    expect(fresh.status).toBe(200);
    expect(sessionCookie(fresh)).toBeNull();
    // Issued 11 days ago: 19 days remain, so the cookie and row move to now + 30 days.
    await setExpiry(19 * DAY);
    const refreshed = await call('/api/sessions/current', { cookie });
    expect(refreshed.status).toBe(200);
    expect(sessionCookie(refreshed)!.header).toContain(`Max-Age=${30 * 24 * 60 * 60}`);
    const row = await env.DB.prepare('SELECT expiresAt FROM session').first<{ expiresAt: string }>();
    expect(Date.parse(row!.expiresAt)).toBeGreaterThan(Date.now() + 29 * DAY);
  });

  it('issues test sessions that the room API accepts', async () => {
    const request = new Request(origin + '/__test/session');
    const session = await createTestSession(env, request, '試験');
    expect(await current(session.cookie)).toEqual({ id: session.id, name: '試験' });
    expect((await call('/api/rooms', { cookie: session.cookie })).status).toBe(200);
  });
});

describe('OTP rate limits in front of Better Auth', () => {
  it('allows one of twenty parallel sends for the same email', async () => {
    const mail = mailbox();
    const responses = await Promise.all(Array.from({ length: 20 }, () => sendCode(mail, 'burst@example.com')));
    expect(responses.map(response => response.status).sort()).toEqual([200, ...Array(19).fill(429)]);
    expect(mail.sent).toHaveLength(1);
  });

  it('lets only three of twenty parallel verifications reach the handler and never forwards a missing code', async () => {
    const mail = mailbox();
    expect((await sendCode(mail, 'guess@example.com')).status).toBe(200);
    const otp = mail.otp();
    const missing = await signIn(mail, { email: 'guess@example.com' });
    expect(missing.status).toBe(400);
    expect(await missing.json()).toEqual({ error: 'INVALID_OTP' });
    expect(await env.DB.prepare("SELECT value FROM verification").first<{ value: string }>()).toMatchObject({ value: expect.stringMatching(/:0$/) });
    expect(await env.DB.prepare("SELECT 1 FROM auth_attempt WHERE key = 'verify:guess@example.com'").first()).toBeNull();

    const wrong = otp === '000000' ? '111111' : '000000';
    const responses = await Promise.all(Array.from({ length: 20 }, () => signIn(mail, { email: 'guess@example.com', otp: wrong })));
    const statuses = responses.map(response => response.status);
    expect(statuses.filter(status => status === 429)).toHaveLength(17);
    expect(statuses.filter(status => status !== 429).every(status => status === 400 || status === 403)).toBe(true);
    expect((await signIn(mail, { email: 'guess@example.com', otp })).status).toBe(429);
  });

  it('invalidates the previous code on resend', async () => {
    const mail = mailbox();
    expect((await sendCode(mail, 'resend@example.com')).status).toBe(200);
    const first = mail.otp();
    expect((await sendCode(mail, 'resend@example.com')).status).toBe(429);
    await moveWindow('send:resend@example.com', 60_000);
    expect((await sendCode(mail, 'resend@example.com')).status).toBe(200);
    const second = mail.otp();
    if (first !== second) expect((await signIn(mail, { email: 'resend@example.com', otp: first, name: '再送' })).status).toBe(400);
    expect((await signIn(mail, { email: 'resend@example.com', otp: second, name: '再送' })).status).toBe(200);
  });

  it('limits each client IP per endpoint', async () => {
    const mail = mailbox();
    const headers = { 'cf-connecting-ip': '203.0.113.9' };
    for (let i = 0; i < 10; i++) expect((await sendCode(mail, `ip${i}@example.com`, {}, headers)).status).toBe(200);
    expect((await sendCode(mail, 'ip10@example.com', {}, headers)).status).toBe(429);
    expect((await sendCode(mail, 'ip10@example.com', {}, { 'cf-connecting-ip': '203.0.113.10' })).status).toBe(200);
  });

  it('refunds a failed delivery even when parallel sends were rejected', async () => {
    const { consumeAttempt, refundAttempt, LIMITS } = await import('../src/auth/rate-limit.js');
    const key = 'send:parallel-failure@example.com';
    const allowed = await Promise.all(Array.from({ length: 20 }, () => consumeAttempt(env.DB, key, LIMITS.send)));
    expect(allowed.filter(Boolean)).toHaveLength(1);
    await refundAttempt(env.DB, key);
    expect(await consumeAttempt(env.DB, key, LIMITS.send)).toBe(true);
  });

  it('refunds the send when email delivery fails and fails closed when the counter is unavailable', async () => {
    const failing = mailbox('fail');
    const failed = await sendCode(failing, 'fail@example.com');
    expect(failed.status).toBe(502);
    expect(await failed.json()).toEqual({ error: 'EMAIL_SEND_FAILED' });
    expect((await sendCode(mailbox(), 'fail@example.com')).status).toBe(200);

    await env.DB.exec('DROP TABLE auth_attempt');
    const mail = mailbox();
    const unavailable = await sendCode(mail, 'down@example.com');
    expect(unavailable.status).toBe(503);
    expect(await unavailable.json()).toEqual({ error: 'AUTH_UNAVAILABLE' });
    expect(mail.sent).toHaveLength(0);
  });
});

describe('auth endpoint surface', () => {
  it('returns 404 for non sign-in OTP types and unused Better Auth routes', async () => {
    const mail = mailbox();
    for (const type of ['forget-password', 'email-verification', 'change-email']) {
      expect((await sendCode(mail, 'surface@example.com', { type })).status).toBe(404);
    }
    for (const path of ['/api/auth/forget-password/email-otp', '/api/auth/email-otp/request-password-reset', '/api/auth/email-otp/reset-password',
      '/api/auth/email-otp/check-verification-otp', '/api/auth/email-otp/verify-email', '/api/auth/sign-up/email', '/api/auth/sign-in/email', '/api/auth/update-user', '/api/auth/delete-user']) {
      expect((await call(path, { method: 'POST', body: { email: 'surface@example.com', otp: '123456' }, env: mail.env })).status).toBe(404);
    }
    expect(mail.sent).toHaveLength(0);
    expect((await call('/api/sessions', { method: 'POST', body: { name: 'ゲスト' } })).status).toBe(404);
  });

  it('requires the exact origin for auth posts', async () => {
    const mail = mailbox();
    for (const supplied of [null, 'null', 'https://evil.example', 'http://game.example']) {
      expect((await call('/api/auth/email-otp/send-verification-otp', { method: 'POST', body: { email: 'o@example.com', type: 'sign-in' }, origin: supplied, env: mail.env })).status).toBe(403);
    }
    expect(mail.sent).toHaveLength(0);
  });

  it('builds a mail without URLs and times out a stalled provider', async () => {
    const message = otpEmail('012345');
    expect(message.text).toContain('012345');
    expect(message.html).toContain('012345');
    expect(message.text + message.html).not.toMatch(/https?:/);
    const stalled = { send: () => new Promise(() => {}) } as unknown as SendEmail;
    expect(await sendOtpEmail({ EMAIL: stalled, EMAIL_FROM_ADDRESS: 'noreply@madou-senki.local' }, 'a@example.com', '012345', 20)).toBe(false);
  });

  it('authenticates WebSocket identity from the cookie and ignores attacker-supplied internal headers', async () => {
    const request = new Request(origin + '/__test/session');
    const a = await createTestSession(env, request, 'A');
    const b = await createTestSession(env, request, 'B');
    const identity = { id: a.id, name: a.name };
    const roomId = crypto.randomUUID();
    await runInDurableObject(env.ROOMS.getByName(roomId), (_instance, state) => {
      const room: RoomData = { schemaVersion: 1, roomId, title: 'Private', ownerId: identity.id, rulesetId: ruleset.id,
        capacity: 4, visibility: 'private', status: 'lobby', createdAt: 0,
        members: { [identity.id]: { ...identity, ready: false, joinedAt: 0 } }, inviteHash: 'secret', game: null };
      new RoomStorage(state.storage).initialize(room);
    });
    const path = `/api/rooms/${roomId}/ws`;
    const headers = { Upgrade: 'websocket', 'X-Room-Actor': identity.id };
    expect((await call(path, { headers })).status).toBe(401);
    expect((await call(path, { headers, cookie: b.cookie })).status).toBe(403);
    expect((await call(path, { origin: 'https://evil.example', headers, cookie: a.cookie })).status).toBe(403);
    expect((await call(path, { origin: null, headers, cookie: a.cookie })).status).toBe(403);
    expect((await call(path, { cookie: a.cookie })).status).toBe(426);
    const accepted = await call(path, { cookie: a.cookie, headers: { Upgrade: 'websocket', 'X-Room-Actor': 'someone-else' } });
    expect(accepted.status).toBe(101);
    expect(accepted.webSocket).toBeDefined();
    accepted.webSocket!.accept();
    accepted.webSocket!.close();
  });
});
