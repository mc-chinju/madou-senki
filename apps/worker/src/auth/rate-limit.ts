import { HttpError } from '../http.js';

export interface Limit { max: number; windowMs: number }

/** Per email: one send a minute and three verifications per code. Per client IP: ten calls a minute per endpoint. */
export const LIMITS = {
  send: { max: 1, windowMs: 60_000 },
  verify: { max: 3, windowMs: 300_000 },
  ip: { max: 10, windowMs: 60_000 },
} as const satisfies Record<string, Limit>;

const LEASE_TTL_MS = 15_000;
// Longer than the email timeout, so a verify queued behind a slow send still runs.
const LEASE_WAIT_MS = 8_000;
const LEASE_POLL_MS = 25;

const unavailable = () => new HttpError(503, 'AUTH_UNAVAILABLE');

/** Counter failures must stop authentication instead of silently allowing it. */
async function failClosed<T>(work: () => Promise<T>): Promise<T> {
  try { return await work(); }
  catch (cause) { throw cause instanceof HttpError ? cause : unavailable(); }
}

/**
 * Counts one attempt in a single upsert. Better Auth's built-in limiter reads then writes,
 * so parallel requests can all pass it; this statement cannot be interleaved.
 */
export function consumeAttempt(db: D1Database, key: string, limit: Limit, now = Date.now()): Promise<boolean> {
  return failClosed(async () => {
    const row = await db.prepare(`INSERT INTO auth_attempt (key, count, window_start) VALUES (?1, 1, ?2)
      ON CONFLICT (key) DO UPDATE SET
        count = CASE WHEN auth_attempt.window_start <= ?2 - ?3 THEN 1 ELSE auth_attempt.count + 1 END,
        window_start = CASE WHEN auth_attempt.window_start <= ?2 - ?3 THEN ?2 ELSE auth_attempt.window_start END
      RETURNING count`).bind(key, now, limit.windowMs).first<{ count: number }>();
    if (!row) throw unavailable();
    return row.count <= limit.max;
  });
}

/** Returns an attempt that did not reach the user, such as a failed email send. */
export function refundAttempt(db: D1Database, key: string): Promise<void> {
  return failClosed(async () => { await db.prepare('UPDATE auth_attempt SET count = MAX(count - 1, 0) WHERE key = ?').bind(key).run(); });
}

export function clearAttempts(db: D1Database, key: string): Promise<void> {
  return failClosed(async () => { await db.prepare('DELETE FROM auth_attempt WHERE key = ?').bind(key).run(); });
}

/** Serializes send and verify for one email. Waits briefly for the holder, then fails closed. */
export async function acquireLease(db: D1Database, email: string): Promise<string> {
  const token = crypto.randomUUID();
  const deadline = Date.now() + LEASE_WAIT_MS;
  for (;;) {
    const now = Date.now();
    const row = await failClosed(() => db.prepare(`INSERT INTO auth_lease (email, token, expires_at) VALUES (?1, ?2, ?3)
      ON CONFLICT (email) DO UPDATE SET token = excluded.token, expires_at = excluded.expires_at WHERE auth_lease.expires_at <= ?4
      RETURNING token`).bind(email, token, now + LEASE_TTL_MS, now).first<{ token: string }>());
    if (row?.token === token) return token;
    if (Date.now() >= deadline) throw unavailable();
    await new Promise(resolve => setTimeout(resolve, LEASE_POLL_MS));
  }
}

/** False when another request took over an expired lease while this one was still running. */
export function releaseLease(db: D1Database, email: string, token: string): Promise<boolean> {
  return failClosed(async () => {
    const result = await db.prepare('DELETE FROM auth_lease WHERE email = ? AND token = ?').bind(email, token).run();
    return result.meta.changes === 1;
  });
}
