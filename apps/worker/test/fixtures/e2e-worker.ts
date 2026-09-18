import { conditionalScenarioNames } from '../../../../packages/engine/test/fixtures/conditional-ability-scenarios.js';
import type { Entropy } from '@madou/engine';
import application from '../../src/index.js';
import { Room } from '../../src/rooms/room.js';
import { displayText, HttpError, json, readJson } from '../../src/http.js';
import { projectDirectory } from '../../src/rooms/types.js';
import { makeScenario, type ScenarioName } from '../../../../packages/engine/test/fixtures/game-scenarios.js';
import { createTestSession } from './test-session.js';

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];
/** Exactly the scenarios the remaining browser specs seat. Nothing else can be injected into a room. */
const BROWSER_SCENARIOS = new Set<string>(['ability-hidden-cancel', 'beast-capture', 'combination-ready',
  'dedicated-defense', 'fury-royal-reflection', 'info-cham-followers', 'lifecycle-finish',
  'lifecycle-transform-hidden', 'lifetime-soul', 'magic-gate-cancel', 'reclaim-all-army', 'reclaim-tragedy',
  'ritual-transfer', 'roll-check', 'sad-love-aura', 'setup', 'suppression-blessing-confusion',
  'suppression-blessing-exempt', 'suppression-blessing-paired', 'third-party-interrupt', 'virtual-blade-ice',
  ...conditionalScenarioNames]);

const OUTBOX = 'CREATE TABLE IF NOT EXISTS browser_fixture_outbox (email TEXT NOT NULL, text TEXT NOT NULL, sent_at INTEGER NOT NULL)';

/** Keeps login mail in the test D1 instead of sending it, so login.spec can type the code from the screen flow. */
function capturedEmail(db: D1Database): SendEmail {
  return { async send(message: { to: string; text?: string }) {
    await db.prepare(OUTBOX).run();
    await db.prepare('INSERT INTO browser_fixture_outbox (email, text, sent_at) VALUES (?, ?, ?)').bind(message.to, message.text ?? '', Date.now()).run();
    return { messageId: crypto.randomUUID() };
  } } as unknown as SendEmail;
}

/** Local-only sign-in and mail inspection. The production entrypoint has neither route. */
async function accountFixture(request: Request, env: Env, path: string): Promise<Response> {
  if (path === '/__test/session') {
    if (request.method !== 'POST') throw new HttpError(405, 'METHOD_NOT_ALLOWED');
    const name = displayText((await readJson(request)).name, 24);
    if (!name) throw new HttpError(400, 'INVALID_FIXTURE');
    // Scenario specs seat several tables with the same fixed names; each seat needs its own account.
    // Only this local test database drops the index. Real registration still refuses duplicates in the hook.
    await env.DB.prepare('DROP INDEX IF EXISTS user_name').run();
    const session = await createTestSession(env, request, name);
    return json({ id: session.id, name: session.name }, 201, { 'Set-Cookie': session.setCookie });
  }
  await env.DB.prepare(OUTBOX).run();
  const email = new URL(request.url).searchParams.get('email')?.toLowerCase() ?? '';
  if (request.method === 'DELETE') {
    // Lets one browser test sign in twice without waiting out the 60-second send limit.
    await env.DB.batch([env.DB.prepare('DELETE FROM auth_attempt WHERE key IN (?, ?)').bind(`send:${email}`, `verify:${email}`),
      env.DB.prepare('DELETE FROM browser_fixture_outbox WHERE email = ?').bind(email)]);
    return new Response(null, { status: 204 });
  }
  if (request.method !== 'GET') throw new HttpError(405, 'METHOD_NOT_ALLOWED');
  const row = await env.DB.prepare('SELECT text FROM browser_fixture_outbox WHERE email = ? ORDER BY sent_at DESC LIMIT 1').bind(email).first<{ text: string }>();
  const otp = row ? /\b(\d{6})\b/.exec(row.text)?.[1] : undefined;
  if (!otp) throw new HttpError(404, 'NO_MAIL');
  return json({ otp });
}

function mulberryTape(seed: number, calls: number): Entropy {
  let t = (Math.imul(seed, 0x9E3779B9) + calls) >>> 0;
  const next = () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
  const random: number[] = [];
  const dice: number[] = [];
  for (let i = 0; i < 8192; i++) {
    random.push(next());
    dice.push(1 + Math.floor(next() * 6));
  }
  return { now: 1000, dice, random };
}

/** Local browser-test entrypoint only. Never exported by src/index.ts or production wrangler.jsonc. */
export class BrowserFixtureRoom extends Room {
  async setEntropySeed(seed: number) {
    this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS browser_fixture_seed (singleton INTEGER PRIMARY KEY CHECK(singleton = 1), seed INTEGER NOT NULL, calls INTEGER NOT NULL)');
    this.ctx.storage.sql.exec('INSERT OR REPLACE INTO browser_fixture_seed (singleton, seed, calls) VALUES (1, ?, 0)', seed);
    await this.ctx.storage.sync();
  }

  protected commandEntropy() {
    const seeded = this.ctx.storage.sql.exec<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'browser_fixture_seed'").toArray().length > 0
      ? this.ctx.storage.sql.exec<{ seed: number; calls: number }>('SELECT seed, calls FROM browser_fixture_seed WHERE singleton = 1').toArray()[0]
      : undefined;
    if (seeded) {
      this.ctx.storage.sql.exec('UPDATE browser_fixture_seed SET calls = ? WHERE singleton = 1', seeded.calls + 1);
      return mulberryTape(seeded.seed, seeded.calls);
    }
    const entropy = super.commandEntropy();
    const exists = this.ctx.storage.sql.exec<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'browser_fixture_entropy'").toArray().length > 0;
    if (!exists) return entropy;
    const fixture = this.ctx.storage.sql.exec<{ scenario: string }>('SELECT scenario FROM browser_fixture_entropy WHERE singleton = 1').toArray()[0];
    // The Blessing specs read a fixed check; the reflection spec needs the low roll its assertions quote.
    if(fixture?.scenario==='suppression-blessing-paired'||fixture?.scenario==='suppression-blessing-exempt')return {...entropy,now:1000,dice:Array(100).fill(1) as number[]};
    return (fixture?.scenario === 'suppression-blessing-confusion' || fixture?.scenario === 'fury-royal-reflection') ? { ...entropy, dice: Array(100).fill(1) as number[] } : entropy;
  }
  async seedScenario(name: ScenarioName) {
    const result = await this.ctx.storage.transaction(async () => {
      const current = this.current();
      if (!current || current.state.status !== 'lobby' || Object.keys(current.state.members).length !== current.state.capacity) throw Error('FIXTURE_NOT_FULL_LOBBY');
      const game = makeScenario(name, Object.values(current.state.members).map(({ id, name: displayName }) => ({ id, name: displayName })));
      const next = { ...current.state, status: 'playing' as const, game };
      const result = this.store.commit({ actorId: next.ownerId, commandId: `fixture-${crypto.randomUUID()}`, expectedRevision: current.revision,
        request: JSON.stringify({ fixture: name }), state: next, events: [{ kind: 'lobby', type: 'STARTED', actorId: next.ownerId, at: Date.now() }], projection: projectDirectory(next) });
      if (!result.ok) throw Error('FIXTURE_COMMIT_FAILED');
      this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS browser_fixture_entropy (singleton INTEGER PRIMARY KEY CHECK(singleton = 1), scenario TEXT NOT NULL)');
      this.ctx.storage.sql.exec('INSERT OR REPLACE INTO browser_fixture_entropy (singleton, scenario) VALUES (1, ?)', name);
      await this.ctx.storage.setAlarm(Date.now() + 1000);
      return { roomId: next.roomId, revision: result.revision };
    });
    await this.ctx.storage.sync(); this.broadcast(); return result;
  }

  inspectGame() {
    return structuredClone(this.current()?.state.game ?? null);
  }
}

const IP_KEYED = /^\/api\/(?:auth\/|sessions\/current$)/;
/**
 * Every browser context in a fixture table reaches `wrangler dev` from the same loopback address,
 * so Better Auth buckets all four seats together: its per-IP window on `/get-session` is 100
 * requests per 10 seconds, and a busy spec with four pages reloading spends it, gets 429 and shows
 * the login screen mid-game. Real players each have their own address. Dropping the header on the
 * routes that read it makes Better Auth skip the limiter (`disableIpTracking`) for this local
 * entrypoint only; the per-email send and verify limits, which the login spec relies on, still
 * apply, and `auth.test.ts` still exercises the per-IP limit with the header set.
 */
function oneClientPerSeat(request: Request, url: URL): Request {
  if (!IP_KEYED.test(url.pathname) || !request.headers.has('cf-connecting-ip')) return request;
  const headers = new Headers(request.headers);
  headers.delete('cf-connecting-ip');
  return new Request(request, { headers });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/__test/session' || url.pathname === '/__test/otp') {
      if (!LOCAL_HOSTS.includes(url.hostname)) return json({ error: 'LOCAL_TEST_ONLY' }, 403);
      try { return await accountFixture(request, env, url.pathname); }
      catch (cause) { return json({ error: cause instanceof HttpError ? cause.code : 'FIXTURE_FAILED' }, cause instanceof HttpError ? cause.status : 500); }
    }
    const match = /^\/__test\/rooms\/([A-Za-z0-9_-]+)\/(scenario|game|entropy)$/.exec(url.pathname);
    if (!match) return application.fetch(oneClientPerSeat(request, url), { ...env, EMAIL: capturedEmail(env.DB) }, ctx);
    if (!LOCAL_HOSTS.includes(url.hostname)) return json({ error: 'LOCAL_TEST_ONLY' }, 403);
    try {
      const stub = env.ROOMS.getByName(match[1]!) as unknown as DurableObjectStub<BrowserFixtureRoom>;
      if (match[2] === 'game') {
        if (request.method !== 'GET') throw new HttpError(405, 'METHOD_NOT_ALLOWED');
        return json(await stub.inspectGame());
      }
      if (match[2] === 'entropy') {
        if (request.method !== 'POST') throw new HttpError(405, 'METHOD_NOT_ALLOWED');
        const body = await readJson(request);
        if (typeof body.seed !== 'number' || !Number.isSafeInteger(body.seed)) throw new HttpError(400, 'INVALID_FIXTURE');
        await stub.setEntropySeed(body.seed);
        return new Response(null, { status: 204 });
      }
      if (request.method !== 'POST') throw new HttpError(405, 'METHOD_NOT_ALLOWED');
      const body = await readJson(request);
      if (typeof body.name !== 'string' || !BROWSER_SCENARIOS.has(body.name)) throw new HttpError(400, 'INVALID_FIXTURE');
      return json(await stub.seedScenario(body.name as ScenarioName));
    } catch (cause) { return json({ error: cause instanceof HttpError ? cause.code : 'FIXTURE_FAILED' }, cause instanceof HttpError ? cause.status : 500); }
  },
} satisfies ExportedHandler<Env>;
