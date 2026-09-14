import { choose, legalCommands } from '../packages/engine/src/bot/index.js';
import { BotClient } from '../tests/e2e/bot-client.js';

const origin = process.env.PLAYWRIGHT_BASE_URL;
if (!origin) throw new Error('PLAYWRIGHT_BASE_URL must be configured');
const base = origin;
const tables = 10;
const seats = 10;
const stepsPerSeat = 200;

async function session(name: string) {
  const response = await fetch(new URL('/api/sessions', base), {
    method: 'POST',
    headers: { Origin: base, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) throw new Error(`SESSION_${response.status}`);
  const cookie = response.headers.getSetCookie().find(value => value.startsWith('__Host-madou_session='));
  if (!cookie) throw new Error('SESSION_COOKIE');
  return cookie.split(';', 1)[0]!;
}

async function json<T>(cookie: string, path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Origin', base);
  headers.set('Cookie', cookie);
  if (init.body) headers.set('Content-Type', 'application/json');
  const response = await fetch(new URL(path, base), { ...init, headers });
  if (!response.ok) throw new Error(`${path}:${response.status}`);
  return response.json() as Promise<T>;
}

async function sendRetry(bot: BotClient, command: Parameters<BotClient['send']>[0]) {
  let result = await bot.send(command);
  for (let attempt = 0; !result.ok && result.code === 'STALE_REVISION' && attempt < 8; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 25));
    result = await bot.send(command);
  }
  return result;
}

async function waitRevision(bots: BotClient[], revision: number) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (bots.every(bot => (bot.revision() ?? 0) >= revision)) return;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}

const latencies: number[] = [];
let failures = 0;
let disconnects = 0;

const cookies = await Promise.all(Array.from({ length: tables * seats }, (_, index) => session(`負荷${index}`)));
const roomIds: string[] = [];
for (let table = 0; table < tables; table++) {
  const owner = cookies[table * seats]!;
  const created = await json<{ roomId: string; revision: number }>(owner, '/api/rooms', {
    method: 'POST',
    body: JSON.stringify({ title: `負荷${table}`, capacity: seats, visibility: 'private', rulesetId: 'second-online-v0.1-provisional' }),
  });
  roomIds.push(created.roomId);
  const invited = await json<{ token: string }>(owner, `/api/rooms/${created.roomId}/invites`, {
    method: 'POST',
    body: JSON.stringify({ expectedRevision: created.revision }),
  });
  for (let seat = 1; seat < seats; seat++) {
    await json(cookies[table * seats + seat]!, `/api/rooms/${created.roomId}/join`, {
      method: 'POST',
      body: JSON.stringify({ inviteToken: invited.token }),
    });
  }
}

const bots = await Promise.all(cookies.map(async (cookie, index) => {
  const bot = new BotClient(base, cookie, roomIds[Math.floor(index / seats)]!);
  try { await bot.connect(); }
  catch { disconnects += 1; throw new Error('CONNECT'); }
  return bot;
}));

for (let table = 0; table < tables; table++) {
  const slice = bots.slice(table * seats, table * seats + seats);
  for (const bot of slice) {
    const started = Date.now();
    const result = await sendRetry(bot, { type: 'READY', ready: true });
    latencies.push(Date.now() - started);
    if (!result.ok) failures += 1;
    if (result.ok && result.revision !== undefined) await waitRevision(slice, result.revision);
  }
  const started = Date.now();
  const result = await sendRetry(slice[0]!, { type: 'START' });
  latencies.push(Date.now() - started);
  if (!result.ok) failures += 1;
  if (result.ok && result.revision !== undefined) await waitRevision(slice, result.revision);
}

for (let table = 0; table < tables; table++) {
  const slice = bots.slice(table * seats, table * seats + seats);
  for (let step = 0; step < stepsPerSeat; step++) {
    if (slice[0]?.view()?.outcome) break;
    let acted = false;
    for (const bot of slice) {
      const view = bot.view();
      if (!view || legalCommands(view).length === 0) continue;
      const started = Date.now();
      const result = await sendRetry(bot, choose(view, table));
      latencies.push(Date.now() - started);
      if (!result.ok) failures += 1;
      if (result.ok && result.revision !== undefined) await waitRevision(slice, result.revision);
      acted = true;
      break;
    }
    if (!acted) await new Promise(resolve => setTimeout(resolve, 50));
  }
}

bots.forEach(bot => bot.close());
latencies.sort((a, b) => a - b);
const percentile = (p: number) => latencies[Math.min(latencies.length - 1, Math.floor((latencies.length - 1) * p))] ?? null;
process.stdout.write(`${JSON.stringify({
  tables, seats, stepsPerSeat, samples: latencies.length, failures, disconnects,
  p50: percentile(0.5), p95: percentile(0.95), p99: percentile(0.99),
  failureRate: latencies.length ? failures / latencies.length : 1,
})}\n`);
