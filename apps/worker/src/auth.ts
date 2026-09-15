import { createAuth } from './auth/better-auth.js';
import { HttpError, json } from './http.js';

/** Identity seen by rooms. `id` is the Better Auth user ID and never depends on the game. */
export interface Session { id: string; name: string }

export function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
export async function hashToken(token: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function findSession(request: Request, env: Env): Promise<Session | null> {
  if (!request.headers.get('Cookie')) return null;
  // Refresh only where the new cookie can be returned (currentSession); otherwise the database would
  // be extended while the browser keeps the old expiry.
  const result = await createAuth(env, request).api.getSession({ headers: request.headers, query: { disableRefresh: true } });
  return result ? { id: result.user.id, name: result.user.name } : null;
}

export async function requireSession(request: Request, env: Env): Promise<Session> {
  const session = await findSession(request, env);
  if (!session) throw new HttpError(401, 'UNAUTHENTICATED');
  return session;
}

/** Current identity. A session older than `updateAge` gets a new 30-day cookie here. */
export async function currentSession(request: Request, env: Env): Promise<Response> {
  if (!request.headers.get('Cookie')) throw new HttpError(401, 'UNAUTHENTICATED');
  const response = await createAuth(env, request).handler(new Request(new URL('/api/auth/get-session', request.url), { headers: request.headers }));
  const body = response.ok ? await response.json<{ user?: { id: string; name: string } } | null>() : null;
  if (!body?.user) throw new HttpError(401, 'UNAUTHENTICATED');
  const headers = new Headers();
  for (const cookie of response.headers.getSetCookie()) headers.append('Set-Cookie', cookie);
  return json({ id: body.user.id, name: body.user.name }, 200, headers);
}
