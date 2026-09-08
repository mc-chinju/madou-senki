import { displayText, HttpError, json, readJson } from './http.js';

const COOKIE = '__Host-madou_session';
const LIFETIME_SECONDS = 30 * 24 * 60 * 60;
export interface Session { id: string; name: string }

export function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
export async function hashToken(token: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
function credential(request: Request): string | null {
  const matches = (request.headers.get('Cookie') ?? '').split(';').map(part => part.trim()).filter(part => part.startsWith(COOKIE + '='));
  if (matches.length !== 1) return null;
  const token = matches[0]!.slice(COOKIE.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}

export async function findSession(request: Request, db: D1Database): Promise<Session | null> {
  const token = credential(request);
  if (!token) return null;
  const row = await db.prepare('SELECT actor_id, name FROM sessions WHERE token_hash = ? AND expires_at > ?')
    .bind(await hashToken(token), Date.now()).first<{ actor_id: string; name: string }>();
  return row ? { id: row.actor_id, name: row.name } : null;
}

export async function requireSession(request: Request, db: D1Database): Promise<Session> {
  const session = await findSession(request, db);
  if (!session) throw new HttpError(401, 'UNAUTHENTICATED');
  return session;
}

export async function createSession(request: Request, db: D1Database): Promise<Response> {
  const body = await readJson(request);
  const name = displayText(body.name, 24);
  if (Object.keys(body).length !== 1 || !name) throw new HttpError(400, 'INVALID_REQUEST');
  const existing = await findSession(request, db);
  if (existing) return json(existing);
  const token = randomToken();
  const session: Session = { id: crypto.randomUUID(), name };
  await db.prepare('INSERT INTO sessions (token_hash, actor_id, name, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await hashToken(token), session.id, name, Date.now() + LIFETIME_SECONDS * 1000).run();
  return json(session, 201, { 'Set-Cookie': `${COOKIE}=${token}; Path=/; Max-Age=${LIFETIME_SECONDS}; HttpOnly; Secure; SameSite=Lax` });
}
