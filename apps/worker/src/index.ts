import { currentSession, requireSession } from './auth.js';
import { authRoute } from './auth/routes.js';
import { HttpError, json, requireSameOrigin } from './http.js';
import { roomRoute } from './rooms/routes.js';
export { Room } from './rooms/room.js';

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    try {
      const path = new URL(request.url).pathname;
      if (request.method === 'POST') requireSameOrigin(request);
      if (path.startsWith('/api/auth/')) return await authRoute(request, env);
      if (path === '/api/sessions/current' && request.method === 'GET') return await currentSession(request, env);
      const roomResponse = await roomRoute(request, env);
      if (roomResponse) return roomResponse;
      const socketRoute = /^\/api\/rooms\/([A-Za-z0-9_-]{1,128})\/ws$/.exec(path);
      if (socketRoute && request.method === 'GET') {
        requireSameOrigin(request);
        const session = await requireSession(request, env);
        if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') throw new HttpError(426, 'UPGRADE_REQUIRED');
        // Construct internal headers afresh: client-supplied actor headers are never forwarded.
        return await env.ROOMS.getByName(socketRoute[1]!).fetch('https://room.internal/connect', {
          headers: { Upgrade: 'websocket', 'X-Room-Actor': session.id },
        });
      }
      return json({ error: 'NOT_FOUND' }, 404);
    } catch (cause) {
      return cause instanceof HttpError ? json({ error: cause.code }, cause.status) : json({ error: 'INTERNAL_ERROR' }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
