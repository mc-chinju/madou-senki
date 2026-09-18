import { DurableObject } from 'cloudflare:workers';
import { activeWindowRef, commandBaseRef, createGame, transition, viewFor, type Entropy } from '@madou/engine';
import { assertPlayableCatalog, entries, ruleset } from '@madou/catalog';
import { isRoomCommand, MAX_COMMAND_MESSAGE_BYTES, parseClientEnvelope, type ClientErrorCode, type ClientServerMessage, type RoomCommand } from '@madou/protocol';
import { RoomStorage, type Snapshot } from './storage.js';
import { projectDirectory, type RoomData, type RoomEvent, type RoomProjection, type RoomView, type RoomSettings, type RoomMutationResult } from './types.js';
import { deliverProjection } from './outbox.js';
import type { Session } from '../auth.js';
import { matchesInvitation } from './invites.js';

type WireMessage = ClientServerMessage<RoomView>;
interface Attachment { actorId: string; generation: number }

export class Room extends DurableObject<Env> {
  protected readonly store: RoomStorage<RoomData, RoomEvent, RoomProjection>;
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.store = new RoomStorage(ctx.storage);
    ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS room_connections (
      actor_id TEXT PRIMARY KEY, generation INTEGER NOT NULL)`);
  }

  /** All HTTP entry mutations are internal RPCs with a server-authenticated session. */
  seat(actorId: string): { seated: boolean } {
    const current = this.current();
    return { seated: !!current && Object.hasOwn(current.state.members, actorId) };
  }

  protected commandEntropy(): Entropy { return entropy(); }

  /** Internal RPC: routes supply the authenticated session, never a client actor header. */
  gameSnapshot(actorId: string): { revision: number; game: RoomView['game'] } | null {
    const current = this.current();
    if (!current || !Object.hasOwn(current.state.members, actorId)) return null;
    return { revision: current.revision, game: current.state.game ? viewFor(current.state.game, actorId) : null };
  }

  async create(roomId: string, actor: Session, settings: RoomSettings): Promise<RoomMutationResult> {
    return this.mutateLobby(async () => {
      if (this.store.snapshot() || settings.rulesetId !== ruleset.id) return { ok: false, code: 'FORBIDDEN' };
      const room: RoomData = { schemaVersion: 1, roomId, ...settings, ownerId: actor.id, status: 'lobby', createdAt: Date.now(),
        members: { [actor.id]: { ...actor, ready: false, joinedAt: Date.now() } }, inviteHash: null, game: null, closeVotes: [] };
      this.store.initialize(room);
      return this.persistLobby({ revision: 0, state: room }, room, actor.id, 'CREATED');
    });
  }

  async join(actor: Session, inviteHash: string | null): Promise<RoomMutationResult> {
    return this.mutateLobby(async () => {
      const current = this.current();
      if (!current) return { ok: false, code: 'FORBIDDEN' };
      const room = current.state;
      if (Object.hasOwn(room.members, actor.id)) return { ok: true, roomId: room.roomId, revision: current.revision };
      if (room.visibility === 'private' && !matchesInvitation(room.inviteHash, inviteHash)) return { ok: false, code: 'FORBIDDEN' };
      if (room.status !== 'lobby') return { ok: false, code: 'ROOM_NOT_OPEN' };
      if (Object.keys(room.members).length >= room.capacity) return { ok: false, code: 'ROOM_FULL' };
      room.members[actor.id] = { ...actor, ready: false, joinedAt: Date.now() };
      for (const member of Object.values(room.members)) member.ready = false;
      room.closeVotes = [];
      return this.persistLobby(current, room, actor.id, 'JOINED');
    });
  }

  async updateInvitation(actorId: string, expectedRevision: number, hash: string): Promise<RoomMutationResult> {
    return this.mutateLobby(async () => {
      const current = this.current();
      if (!current || current.state.ownerId !== actorId) return { ok: false, code: 'FORBIDDEN' };
      if (current.state.status !== 'lobby') return { ok: false, code: 'ROOM_NOT_OPEN' };
      if (current.revision !== expectedRevision) return { ok: false, code: 'STALE_REVISION' };
      const room = { ...current.state, inviteHash: hash };
      return this.persistLobby(current, room, actorId, 'INVITE_CHANGED');
    });
  }

  private async mutateLobby(operation: () => Promise<RoomMutationResult>): Promise<RoomMutationResult> {
    try {
      const result = await this.ctx.storage.transaction(operation);
      await this.ctx.storage.sync();
      if (result.ok) this.broadcast();
      return result;
    } catch { return { ok: false, code: 'INTERNAL_ERROR' }; }
  }

  private async persistLobby(current: Snapshot<RoomData>, room: RoomData, actorId: string,
    type: Extract<RoomEvent, { kind: 'lobby' }>['type']): Promise<RoomMutationResult> {
    const committed = this.store.commit({ actorId, commandId: `http-${crypto.randomUUID()}`, expectedRevision: current.revision,
      request: JSON.stringify({ type }), state: room, events: [{ kind: 'lobby', type, actorId, at: Date.now() }], projection: projectDirectory(room) });
    if (!committed.ok) throw new Error('INTERNAL_COMMIT_FAILED');
    await this.scheduleProjection();
    return { ok: true, roomId: room.roomId, revision: committed.revision };
  }

  private async scheduleProjection(): Promise<void> {
    const alarm = await this.ctx.storage.getAlarm();
    await this.ctx.storage.setAlarm(Math.min(alarm ?? Infinity, Date.now() + 1000));
  }

  /** Internal binding only: the authenticated Worker replaces this header itself. */
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'GET' || request.headers.get('Upgrade')?.toLowerCase() !== 'websocket' ||
      new URL(request.url).pathname !== '/connect') return new Response(null, { status: 400 });
    const actorId = request.headers.get('X-Room-Actor');
    if (!actorId) return new Response(null, { status: 403 });
    return this.openConnection(actorId);
  }

  private async openConnection(actorId: string): Promise<Response> {
    const current = this.current();
    if (!current || !Object.hasOwn(current.state.members, actorId)) return new Response(null, { status: 403 });
    const row = this.ctx.storage.sql.exec<{ generation: number }>(
      `INSERT INTO room_connections VALUES (?, 1)
       ON CONFLICT(actor_id) DO UPDATE SET generation = generation + 1 RETURNING generation`, actorId,
    ).one();
    await this.ctx.storage.sync();
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    server.serializeAttachment({ actorId, generation: row.generation } satisfies Attachment);
    this.ctx.acceptWebSocket(server);
    this.broadcast();
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const attached = attachment(socket);
    if (!attached) { socket.close(1008, 'Invalid connection'); return; }
    if (typeof message !== 'string' || message.length > MAX_COMMAND_MESSAGE_BYTES || new TextEncoder().encode(message).length > MAX_COMMAND_MESSAGE_BYTES) {
      this.send(socket, error('MESSAGE_TOO_LARGE')); return;
    }
    let value: unknown;
    try { value = JSON.parse(message); }
    catch { this.send(socket, error('INVALID_ENVELOPE')); return; }
    const response = await this.command(attached.actorId, attached.generation, value);
    this.send(socket, response);
    // A fresh projection also repairs a stale client and a lost prior broadcast.
    this.broadcast();
  }

  /** Internal RPC boundary; identity and generation are supplied by the server connection. */
  async command(actorId: string, generation: number, value: unknown): Promise<WireMessage> {
    const parsed = parseClientEnvelope(value);
    if (!parsed.ok) return error(parsed.code);
    const envelope = parsed.value;
    try {
      const result = await this.ctx.storage.transaction(async (): Promise<WireMessage> => {
        const current = this.current();
        if (!current) return error('ROOM_UNAVAILABLE', envelope.commandId);
        if (this.generation(actorId) !== generation) return error('READ_ONLY_CONNECTION', envelope.commandId);
        const identity = { actorId, commandId: envelope.commandId, expectedRevision: envelope.expectedRevision, request: JSON.stringify(envelope) };
        const prior = this.store.receipt(identity);
        if (prior) return prior.ok
          ? { type: 'ack', commandId: envelope.commandId, revision: prior.revision }
          : error(prior.code === 'NOT_INITIALIZED' ? 'ROOM_UNAVAILABLE' : prior.code, envelope.commandId);
        if (!Object.hasOwn(current.state.members, actorId)) return error('NOT_SEATED', envelope.commandId);
        // A command naming the current window generation or setup round is concurrent with the seats it raced, not stale (design §6).
        const playing = !isRoomCommand(envelope.command) && current.state.status === 'playing' ? current.state.game : undefined;
        const base = playing ? commandBaseRef(playing) : null;
        const onBase = !!base && envelope.windowId === base.windowId && envelope.windowRevision === base.windowRevision;
        if (current.revision !== envelope.expectedRevision && !(onBase && envelope.expectedRevision < current.revision)) return error('STALE_REVISION', envelope.commandId);
        let next: RoomData;
        let events: RoomEvent[];
        if (isRoomCommand(envelope.command)) {
          const outcome = this.applyLobbyCommand(current.state, actorId, envelope.command);
          if (!outcome.ok) return error(outcome.code, envelope.commandId);
          next = outcome.state;
          events = [{ kind: 'lobby', type: outcome.event, actorId, at: Date.now() }];
        } else {
          const game = playing;
          if (!game) return error('INVALID_ACTION', envelope.commandId);
          // A named base must be the current one; an open reaction window must always be named.
          if (envelope.windowId !== undefined ? !onBase : !!activeWindowRef(game)) return error('STALE_WINDOW', envelope.commandId);
          const outcome = transition(game, { actorId, command: envelope.command }, this.commandEntropy());
          if (!outcome.ok) return error('INVALID_ACTION', envelope.commandId);
          next = { ...current.state, game: outcome.state, status: outcome.state.outcome ? 'finished' : 'playing' };
          events = outcome.events.map(event => ({ kind: 'game', event }));
        }
        const committed = this.store.commit({ ...identity, baseRevision: current.revision, state: next, events, projection: projectDirectory(next) });
        if (!committed.ok) return error(committed.code === 'NOT_INITIALIZED' ? 'ROOM_UNAVAILABLE' : committed.code, envelope.commandId);
        // SQLite async transactions include these SQL writes and the alarm together.
        await this.scheduleProjection();
        return { type: 'ack', commandId: envelope.commandId, revision: committed.revision };
      });
      await this.ctx.storage.sync();
      return result;
    } catch { return error('INTERNAL_ERROR', envelope.commandId); }
  }

  private applyLobbyCommand(room: RoomData, actorId: string, command: RoomCommand):
    { ok: true; state: RoomData; event: Extract<RoomEvent, { kind: 'lobby' }>['type'] } | { ok: false; code: ClientErrorCode } {
    if (room.status === 'closed') return { ok: false, code: 'ROOM_NOT_OPEN' };
    const next = structuredClone(room);
    let event: Extract<RoomEvent, { kind: 'lobby' }>['type'];
    if (command.type === 'CLOSE_BY_AGREEMENT') {
      next.closeVotes = (next.closeVotes ?? []).filter(id => id !== actorId);
      if (command.agree) next.closeVotes.push(actorId);
      const unanimous = Object.keys(next.members).every(id => next.closeVotes!.includes(id));
      if (unanimous) next.status = 'closed';
      event = unanimous ? 'CLOSED' : 'CLOSURE_VOTED';
    } else {
      if (room.status !== 'lobby') return { ok: false, code: 'ROOM_NOT_OPEN' };
      switch (command.type) {
        case 'READY': next.members[actorId]!.ready = command.ready; event = 'READY_CHANGED'; break;
        case 'START':
          if (room.ownerId !== actorId) return { ok: false, code: 'FORBIDDEN' };
          if (Object.keys(room.members).length !== room.capacity || Object.values(room.members).some(m => !m.ready)) return { ok: false, code: 'NOT_READY' };
          try { assertPlayableCatalog(entries); } catch { return { ok: false, code: 'RULESET_NOT_READY' }; }
          next.game = createGame(Object.values(room.members).map(({ id, name }) => ({ id, name })), this.commandEntropy());
          next.status = 'playing'; next.closeVotes = []; event = 'STARTED'; break;
        case 'UPDATE_SETTINGS':
          if (room.ownerId !== actorId) return { ok: false, code: 'FORBIDDEN' };
          if (command.capacity < Object.keys(room.members).length) return { ok: false, code: 'ROOM_FULL' };
          next.title = command.title; next.capacity = command.capacity; next.visibility = command.visibility;
          for (const member of Object.values(next.members)) member.ready = false;
          next.closeVotes = []; event = 'SETTINGS_CHANGED'; break;
        case 'LEAVE': {
          delete next.members[actorId];
          const remaining = Object.values(next.members);
          if (!remaining.length) next.status = 'closed';
          else if (next.ownerId === actorId) next.ownerId = remaining.sort((a, b) => a.joinedAt - b.joinedAt)[0]!.id;
          for (const member of remaining) member.ready = false;
          next.closeVotes = []; event = next.status === 'closed' ? 'CLOSED' : 'LEFT'; break;
        }
      }
    }
    return { ok: true, state: next, event };
  }

  async alarm(): Promise<void> {
    for (const item of this.store.pendingOutbox(Date.now())) {
      try {
        await deliverProjection(this.env.DB, item);
        this.store.acknowledgeOutbox(item.revision);
      } catch {
        this.store.retryOutbox(item.revision, Date.now() + Math.min(60_000, 1000 * 2 ** Math.min(item.attempts, 6)));
      }
    }
    await this.ctx.storage.transaction(async () => {
      const next = this.store.nextOutboxAt();
      if (next === null) await this.ctx.storage.deleteAlarm();
      else await this.ctx.storage.setAlarm(Math.max(Date.now() + 1000, next));
    });
  }

  webSocketClose(socket: WebSocket): void {
    try { socket.close(1000, 'Connection closed'); } catch { /* Already closed. */ }
    this.broadcast();
  }
  webSocketError(socket: WebSocket): void {
    try { socket.close(1011, 'Connection failed'); } catch { /* Already closed. */ }
    this.broadcast();
  }

  protected current(): Snapshot<RoomData> | null {
    const snapshot = this.store.snapshot();
    if (!snapshot || snapshot.state.schemaVersion !== 1 || snapshot.state.rulesetId !== ruleset.id ||
      (snapshot.state.game && snapshot.state.game.rulesetVersion !== ruleset.id)) return null;
    return snapshot;
  }

  protected generation(actorId: string): number | null {
    return this.ctx.storage.sql.exec<{ generation: number }>(
      'SELECT generation FROM room_connections WHERE actor_id = ?', actorId,
    ).toArray()[0]?.generation ?? null;
  }

  protected broadcast(): void {
    const current = this.current();
    if (!current) return;
    const sockets = this.ctx.getWebSockets();
    const connected = new Set(sockets.flatMap(socket => {
      const a = attachment(socket);
      return a && socket.readyState === WebSocket.OPEN && this.generation(a.actorId) === a.generation ? [a.actorId] : [];
    }));
    const room = current.state;
    for (const socket of sockets) {
      if (socket.readyState !== WebSocket.OPEN) continue;
      const a = attachment(socket);
      if (!a || !Object.hasOwn(room.members, a.actorId)) continue;
      const view: RoomView = {
        roomId: room.roomId, title: room.title, ownerId: room.ownerId, rulesetId: room.rulesetId,
        capacity: room.capacity, visibility: room.visibility, status: room.status, revision: current.revision,
        members: Object.values(room.members).map(m => ({ id: m.id, name: m.name, ready: m.ready, connected: connected.has(m.id) })),
        readOnly: this.generation(a.actorId) !== a.generation,
        closeVotes: [...(room.closeVotes ?? [])],
        game: room.game ? viewFor(room.game, a.actorId) : null,
      };
      this.send(socket, { type: 'snapshot', revision: current.revision, view });
    }
  }

  protected send(socket: WebSocket, message: WireMessage): void {
    try { socket.send(JSON.stringify(message)); }
    catch { /* State is already durable; this client repairs from a snapshot on reconnect. */ }
  }
}

function error(code: ClientErrorCode, commandId?: string): WireMessage {
  return commandId === undefined ? { type: 'error', code } : { type: 'error', code, commandId };
}
function attachment(socket: WebSocket): Attachment | null {
  const value: unknown = socket.deserializeAttachment();
  if (!value || typeof value !== 'object' || !('actorId' in value) || typeof value.actorId !== 'string' ||
    !('generation' in value) || typeof value.generation !== 'number' || !Number.isSafeInteger(value.generation)) return null;
  return { actorId: value.actorId, generation: value.generation };
}
function entropy(): Entropy {
  const words = crypto.getRandomValues(new Uint32Array(4096));
  const dice: number[] = [];
  for (const word of crypto.getRandomValues(new Uint32Array(4096))) if (word < 4_294_967_292) dice.push(word % 6 + 1);
  return { now: Date.now(), dice, random: [...words].map(word => word / 4_294_967_296) };
}
