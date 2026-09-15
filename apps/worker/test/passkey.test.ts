import { env } from 'cloudflare:workers';
import { createExecutionContext, reset } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import worker from '../src/index.js';
import { applyMigrations } from './fixtures/schema.js';
import { createTestSession } from './fixtures/test-session.js';
import { SoftwareAuthenticator } from './fixtures/webauthn.js';

const origin = 'https://game.example';
beforeEach(async () => { await applyMigrations(env.DB); });
afterEach(async () => { await reset(); });

function call(path: string, cookie?: string, body?: unknown) {
  const headers = new Headers({ Origin: origin });
  if (cookie) headers.set('Cookie', cookie);
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  return worker.fetch(new Request(origin + path, { method: body === undefined ? 'GET' : 'POST', headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }), env, createExecutionContext());
}
const cookiePairs = (response: Response) => response.headers.getSetCookie().map(cookie => cookie.split(';')[0]!).filter(pair => !pair.endsWith('='));
const join = (...pairs: (string | undefined)[]) => pairs.filter(Boolean).join('; ');

async function authenticate(authenticator: SoftwareAuthenticator) {
  const options = await call('/api/auth/passkey/generate-authenticate-options');
  expect(options.status).toBe(200);
  const { challenge } = await options.json<{ challenge: string }>();
  return call('/api/auth/passkey/verify-authentication', join(...cookiePairs(options)), { response: await authenticator.authenticate(challenge) });
}

describe('passkeys', () => {
  it('lets only signed-in users register, signs in without email and refuses a deleted credential', async () => {
    expect((await call('/api/auth/passkey/generate-register-options')).status).toBe(401);
    const session = await createTestSession(env, new Request(origin + '/__test/session'), '鍵の持ち主');
    const registration = await call('/api/auth/passkey/generate-register-options', session.cookie);
    expect(registration.status).toBe(200);
    const options = await registration.json<{ challenge: string; rp: { id: string; name: string } }>();
    expect(options.rp).toEqual({ id: 'game.example', name: '魔導戦記' });

    const authenticator = await SoftwareAuthenticator.create(origin);
    const verified = await call('/api/auth/passkey/verify-registration', join(session.cookie, ...cookiePairs(registration)),
      { response: await authenticator.register(options.challenge), name: 'この端末' });
    expect(verified.status).toBe(200);
    const listed = await (await call('/api/auth/passkey/list-user-passkeys', session.cookie)).json<{ id: string; name: string }[]>();
    expect(listed).toEqual([expect.objectContaining({ name: 'この端末' })]);

    const signedIn = await authenticate(authenticator);
    expect(signedIn.status).toBe(200);
    const passkeyCookie = cookiePairs(signedIn).find(pair => pair.startsWith('__Secure-madou.session_token='));
    expect(passkeyCookie).toBeDefined();
    expect(await (await call('/api/sessions/current', passkeyCookie)).json()).toEqual({ id: session.id, name: '鍵の持ち主' });

    expect((await call('/api/auth/passkey/delete-passkey', session.cookie, { id: listed[0]!.id })).status).toBe(200);
    const refused = await authenticate(authenticator);
    expect(refused.status).toBeGreaterThanOrEqual(400);
    expect(cookiePairs(refused).some(pair => pair.startsWith('__Secure-madou.session_token='))).toBe(false);
  });

  it('does not register a passkey for another origin', async () => {
    const session = await createTestSession(env, new Request(origin + '/__test/session'), '別オリジン');
    const registration = await call('/api/auth/passkey/generate-register-options', session.cookie);
    const { challenge } = await registration.json<{ challenge: string }>();
    const foreign = await SoftwareAuthenticator.create('https://evil.example');
    const verified = await call('/api/auth/passkey/verify-registration', join(session.cookie, ...cookiePairs(registration)), { response: await foreign.register(challenge) });
    expect(verified.status).toBeGreaterThanOrEqual(400);
    expect(await (await call('/api/auth/passkey/list-user-passkeys', session.cookie)).json()).toEqual([]);
  });
});
