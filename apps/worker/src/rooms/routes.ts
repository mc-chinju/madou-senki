import { parseClientEnvelope } from '@madou/protocol';
import { ruleset } from '@madou/catalog';
import { hashToken, requireSession } from '../auth.js';
import { HttpError, json, readJson } from '../http.js';
import { listRooms } from './directory.js';
import { newInvitation } from './invites.js';
import type { RoomMutationResult, RoomSettings } from './types.js';

function requireSuccess(result: RoomMutationResult): asserts result is Extract<RoomMutationResult, { ok: true }> {
  if (!result.ok) throw new HttpError(result.code === 'FORBIDDEN' ? 403 : result.code === 'INTERNAL_ERROR' ? 500 : 409, result.code);
}

export async function roomRoute(request: Request, env: Env): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  const match = /^\/api\/rooms\/([A-Za-z0-9_-]{1,128})\/(join|invites|seat|snapshot)$/.exec(path);
  if (path !== '/api/rooms' && !match) return null;
  const session = await requireSession(request, env.DB);
  if (path === '/api/rooms' && request.method === 'GET') return json({ rooms: await listRooms(env.DB) });
  if (match?.[2] === 'snapshot') {
    if (request.method !== 'GET') return null;
    const snapshot = await env.ROOMS.getByName(match[1]!).gameSnapshot(session.id);
    if (!snapshot) throw new HttpError(403, 'FORBIDDEN');
    return json(snapshot);
  }
  if (match?.[2] === 'seat') return request.method === 'GET' ? json(await env.ROOMS.getByName(match[1]!).seat(session.id)) : null;
  if (request.method !== 'POST') return null;
  const body = await readJson(request);
  if (path === '/api/rooms') {
    if (Object.keys(body).length !== 4 || body.rulesetId !== ruleset.id) throw new HttpError(400, 'INVALID_REQUEST');
    const parsed = parseClientEnvelope({ protocolVersion: 1, commandId: 'settings', expectedRevision: 0,
      command: { type: 'UPDATE_SETTINGS', title: body.title, capacity: body.capacity, visibility: body.visibility } });
    if (!parsed.ok || parsed.value.command.type !== 'UPDATE_SETTINGS') throw new HttpError(400, 'INVALID_REQUEST');
    const { title, capacity, visibility } = parsed.value.command;
    const settings: RoomSettings = { title, capacity, visibility, rulesetId: ruleset.id };
    const roomId = crypto.randomUUID();
    const result = await env.ROOMS.getByName(roomId).create(roomId, session, settings);
    requireSuccess(result);
    return json({ roomId, revision: result.revision }, 201);
  }
  const room = env.ROOMS.getByName(match![1]!);
  if (match![2] === 'join') {
    if (Object.keys(body).some(key => key !== 'inviteToken') || (body.inviteToken !== undefined &&
      (typeof body.inviteToken !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(body.inviteToken)))) throw new HttpError(400, 'INVALID_REQUEST');
    const result = await room.join(session, typeof body.inviteToken === 'string' ? await hashToken(body.inviteToken) : null);
    requireSuccess(result);
    return json({ roomId: result.roomId, revision: result.revision });
  }
  if (Object.keys(body).length !== 1 || typeof body.expectedRevision !== 'number' || !Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0) {
    throw new HttpError(400, 'INVALID_REQUEST');
  }
  const invitation = await newInvitation();
  const result = await room.updateInvitation(session.id, body.expectedRevision, invitation.hash);
  requireSuccess(result);
  return json({ token: invitation.token, revision: result.revision });
}
