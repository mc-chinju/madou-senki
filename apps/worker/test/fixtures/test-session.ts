import type { BetterAuthPlugin } from 'better-auth';
import { testUtils, type TestHelpers } from 'better-auth/plugins';
import { createAuth } from '../../src/auth/better-auth.js';

export interface TestSession { id: string; name: string; cookie: string; setCookie: string }

/**
 * Test-only sign-in without the OTP screen. Like the former guest fixture, every call is a new
 * account. It writes through the raw adapter, skipping the registration hook's name check;
 * callers validate the name. Never imported by src/index.ts.
 */
export async function createTestSession(env: Env, request: Request, name: string): Promise<TestSession> {
  // The plugin's optional `options` does not satisfy exactOptionalPropertyTypes; its runtime shape is a plugin.
  const auth = createAuth(env, request, {}, [testUtils() as unknown as BetterAuthPlugin]);
  const context = await auth.$context as Awaited<typeof auth.$context> & { test: TestHelpers };
  const now = new Date();
  const user = await context.adapter.create<{ id: string; name: string; email: string; emailVerified: boolean; createdAt: Date; updatedAt: Date }>({ model: 'user',
    data: { email: `${crypto.randomUUID()}@test.invalid`, name, emailVerified: true, createdAt: now, updatedAt: now } });
  const [cookie] = (await context.test.login({ userId: user.id })).cookies;
  if (!cookie) throw Error('TEST_SESSION_COOKIE');
  const pair = `${cookie.name}=${cookie.value}`;
  const attributes = [`Path=${cookie.path}`, 'HttpOnly', `SameSite=${cookie.sameSite ?? 'Lax'}`, `Max-Age=${60 * 60 * 24 * 30}`, ...(cookie.secure ? ['Secure'] : [])];
  return { id: user.id, name: user.name, cookie: pair, setCookie: [pair, ...attributes].join('; ') };
}
