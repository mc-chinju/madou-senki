import { isRoomCommand, MAX_COMMAND_MESSAGE_BYTES, MAX_LOG_PAGE, parseClientEnvelope, type ClientEnvelope, type ClientErrorCode, type LogPageRequest } from '@madou/protocol';
import type { LogView } from '@madou/engine';
import type { RoomView } from '../../../worker/src/rooms/types.js';

export interface SocketTransport {
  send(data: string): void;
  close(): void;
  onMessage(listener: (data: string) => void): void;
  onClose(listener: () => void): void;
}
interface Options {
  roomId: string; actorId: string; url: string;
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  socketFactory?: (url: string) => SocketTransport;
  commandId?: () => string;
}
/** Call only after the authenticated read-only seat lookup returns seated:false. */
export function clearPendingDeparture(storage: Options['storage'], actorId: string, roomId: string): void {
  const key = pendingKey(actorId, roomId);
  try {
    const value = storage.getItem(key);
    if (!value) return;
    const parsed = parseClientEnvelope(JSON.parse(value));
    if (parsed.ok && parsed.value.command.type === 'LEAVE') storage.removeItem(key);
  } catch { /* Preserve unknown state; no replacement operation is sent. */ }
}
function pendingKey(actorId: string, roomId: string): string { return `madou:pending:v1:${actorId}:${roomId}`; }
/** Mirrors the engine's `commandBaseRef`: what this command is based on, so concurrent seats are not rejected. */
function commandBase(game: RoomView['game']): { windowId: string; windowRevision: number } | null {
  if (!game) return null;
  if (game.activeWindow) return { windowId: game.activeWindow.windowId, windowRevision: game.activeWindow.windowRevision };
  return game.phase === 'setup' && game.pending ? { windowId: `setup-${game.pending.round}`, windowRevision: 0 } : null;
}
/** The record read back past what a snapshot carries. Events never change, so pages gathered once keep
 *  their meaning across a reconnect and the reader goes on from where they had got to. */
export interface LogHistory { logs: LogView[]; privateLogs: LogView[]; loading: boolean }
export interface ConnectionSnapshot {
  status: 'stopped' | 'connecting' | 'reconnecting' | 'syncing' | 'ready' | 'read-only';
  view: RoomView | null;
  error: ClientErrorCode | 'CLIENT_STORAGE_ERROR' | null;
  pending: boolean;
  lastAck: { commandId: string; commandType: ClientEnvelope['command']['type']; revision: number } | null;
  logHistory: LogHistory;
}

export class RoomConnection {
  private state: ConnectionSnapshot = { status: 'stopped', view: null, error: null, pending: false, lastAck: null,
    logHistory: { logs: [], privateLogs: [], loading: false } };
  /** The page being waited for. Only one is ever in flight, so a slow answer cannot pile pages up. */
  private logRequest: LogPageRequest | null = null;
  private listeners = new Set<() => void>();
  private socket: SocketTransport | null = null;
  private running = false;
  private generation = 0;
  private attempts = 0;
  private synced = false;
  private sent = false;
  private acknowledgedRevision = 0;
  private pending: ClientEnvelope | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private responseTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly key: string;

  constructor(private readonly options: Options) {
    this.key = pendingKey(options.actorId, options.roomId);
    try {
      const stored = options.storage.getItem(this.key);
      if (stored) {
        const parsed = parseClientEnvelope(JSON.parse(stored));
        if (parsed.ok && new TextEncoder().encode(JSON.stringify(parsed.value)).length <= MAX_COMMAND_MESSAGE_BYTES) this.pending = parsed.value;
        else options.storage.removeItem(this.key);
      }
    } catch { this.state = { ...this.state, error: 'CLIENT_STORAGE_ERROR' }; }
    this.state = { ...this.state, pending: this.pending !== null };
  }

  getSnapshot = (): ConnectionSnapshot => this.state;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };

  start(): void {
    if (this.running) return;
    this.running = true;
    this.open();
  }
  stop(): void {
    this.running = false; this.generation++;
    this.clearTimers(); this.socket?.close(); this.socket = null;
    this.publish({ status: 'stopped' });
  }

  send(command: ClientEnvelope['command']): boolean {
    if (this.state.status !== 'ready' || !this.state.view || this.pending) return false;
    const envelope: ClientEnvelope = { protocolVersion: 1, commandId: this.options.commandId?.() ?? crypto.randomUUID(),
      expectedRevision: this.state.view.revision, command };
    const base = commandBase(this.state.view.game);
    if (!isRoomCommand(command) && base) { envelope.windowId = base.windowId; envelope.windowRevision = base.windowRevision; }
    const parsed = parseClientEnvelope(envelope);
    if (!parsed.ok) return false;
    const serialized = JSON.stringify(parsed.value);
    if (new TextEncoder().encode(serialized).length > MAX_COMMAND_MESSAGE_BYTES) { this.publish({ error: 'MESSAGE_TOO_LARGE' }); return false; }
    try { this.options.storage.setItem(this.key, serialized); }
    catch { this.publish({ error: 'CLIENT_STORAGE_ERROR' }); return false; }
    this.pending = parsed.value; this.sent = false;
    this.publish({ status: 'syncing', pending: true, error: null });
    this.transmit();
    return true;
  }

  /** Asks for the page of the record that ends just before `beforeId`. One at a time, and never while the
   *  socket is unusable; the reader is free to ask again once the answer or a reconnection has arrived. */
  requestLogPage(beforeId: number, limit = MAX_LOG_PAGE): boolean {
    if (this.logRequest || !this.socket || !this.synced || !Number.isSafeInteger(beforeId) || beforeId <= 0) return false;
    const request: LogPageRequest = { type: 'LOG_PAGE', requestId: this.options.commandId?.() ?? crypto.randomUUID(),
      beforeId, limit: Math.min(Math.max(Math.trunc(limit), 1), MAX_LOG_PAGE) };
    try { this.socket.send(JSON.stringify(request)); }
    catch { this.reconnect(); return false; }
    this.logRequest = request;
    this.publish({ logHistory: { ...this.state.logHistory, loading: true } });
    return true;
  }

  private open(): void {
    if (!this.running) return;
    const generation = ++this.generation;
    this.synced = false; this.sent = false;
    this.publish({ status: this.state.view ? 'reconnecting' : 'connecting' });
    try {
      const socket = (this.options.socketFactory ?? browserSocket)(this.options.url);
      this.socket = socket;
      socket.onMessage(data => { if (this.running && generation === this.generation) this.receive(data); });
      socket.onClose(() => { if (this.running && generation === this.generation) this.reconnect(); });
      this.armResponseTimeout();
    } catch { this.reconnect(); }
  }

  private reconnect(): void {
    if (!this.running) return;
    const readOnly = this.state.status === 'read-only';
    this.generation++; this.synced = false; this.sent = false;
    // Pages already gathered still hold; only the one this dead socket owed is given up on.
    if (this.logRequest) { this.logRequest = null; this.publish({ logHistory: { ...this.state.logHistory, loading: false } }); }
    this.clearTimers(); this.socket?.close(); this.socket = null;
    // Passive old tabs must not fight the active tab by acquiring new generations.
    if (readOnly) return;
    this.publish({ status: 'reconnecting' });
    const delay = Math.min(10000, 1000 * 2 ** Math.min(this.attempts++, 4));
    this.reconnectTimer = setTimeout(() => { this.reconnectTimer = null; this.open(); }, delay);
  }

  private receive(data: string): void {
    let message: unknown;
    try { message = JSON.parse(data); } catch { return; }
    if (!message || typeof message !== 'object' || !('type' in message)) return;
    // The same-origin server owns the projected view schema. Validate transport identity/revision here.
    if (message.type === 'snapshot' && 'view' in message && 'revision' in message) {
      const view = message.view as RoomView | null;
      if (!view || view.roomId !== this.options.roomId || !Number.isSafeInteger(view.revision) || view.revision < 0 ||
        view.revision !== message.revision || typeof view.readOnly !== 'boolean' ||
        (this.state.view && view.revision < this.state.view.revision)) return;
      this.synced = true; this.attempts = 0;
      if (!this.pending || !this.sent || view.readOnly) {
        if (this.responseTimer) clearTimeout(this.responseTimer);
        this.responseTimer = null;
      }
      this.publish({ view, status: view.readOnly ? 'read-only' : this.pending || view.revision < this.acknowledgedRevision ? 'syncing' : 'ready' });
      if (!view.readOnly && this.pending) {
        if (!this.sent) this.transmit();
        else if (!this.responseTimer) this.armResponseTimeout();
      }
      return;
    }
    if (message.type === 'log-page') {
      if (!this.logRequest || !('requestId' in message) || message.requestId !== this.logRequest.requestId) return;
      const page = message as unknown as { logs?: unknown; privateLogs?: unknown };
      const logs = Array.isArray(page.logs) ? page.logs as LogView[] : [];
      const privateLogs = Array.isArray(page.privateLogs) ? page.privateLogs as LogView[] : [];
      this.logRequest = null;
      this.publish({ logHistory: { logs: mergeLogs(this.state.logHistory.logs, logs),
        privateLogs: mergeLogs(this.state.logHistory.privateLogs, privateLogs), loading: false } });
      return;
    }
    if (!this.pending || !('commandId' in message) || message.commandId !== this.pending.commandId) return;
    if (message.type === 'ack' && 'revision' in message && typeof message.revision === 'number' && Number.isSafeInteger(message.revision) && message.revision > this.pending.expectedRevision) {
      const ack = { commandId: this.pending.commandId, commandType: this.pending.command.type, revision: message.revision };
      this.acknowledgedRevision = Math.max(this.acknowledgedRevision, message.revision);
      this.clearPending();
      this.publish({ lastAck: ack, status: this.state.view?.readOnly ? 'read-only' : this.synced && (this.state.view?.revision ?? -1) >= this.acknowledgedRevision ? 'ready' : 'syncing' });
      if (this.state.status === 'syncing') this.armResponseTimeout();
    } else if (message.type === 'error' && 'code' in message && typeof message.code === 'string') {
      const code = message.code as ClientErrorCode;
      if (code === 'READ_ONLY_CONNECTION') {
        if (this.responseTimer) clearTimeout(this.responseTimer);
        this.responseTimer = null;
        this.publish({ status: 'read-only', error: code });
      } else if (code === 'INTERNAL_ERROR') {
        // Commit status may be unknown: preserve identity for a receipt lookup on reconnect.
        this.publish({ error: code }); this.reconnect();
      } else {
        this.clearPending(); this.synced = false;
        this.publish({ status: 'syncing', error: code }); this.armResponseTimeout();
      }
    }
  }

  private transmit(): void {
    if (!this.pending || !this.socket || !this.synced || this.sent || this.state.status === 'read-only') return;
    try { this.socket.send(JSON.stringify(this.pending)); this.sent = true; this.armResponseTimeout(); }
    catch { this.reconnect(); }
  }
  private clearPending(): void {
    this.pending = null; this.sent = false;
    if (this.responseTimer) clearTimeout(this.responseTimer);
    this.responseTimer = null;
    try { this.options.storage.removeItem(this.key); } catch { /* A leftover receipt retry is harmless. */ }
    this.publish({ pending: false });
  }
  private armResponseTimeout(): void {
    if (this.responseTimer) clearTimeout(this.responseTimer);
    this.responseTimer = setTimeout(() => { this.responseTimer = null; this.reconnect(); }, 10000);
  }
  private clearTimers(): void {
    if (this.responseTimer) clearTimeout(this.responseTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.responseTimer = null; this.reconnectTimer = null;
  }
  private publish(patch: Partial<ConnectionSnapshot>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
}

/** One record in event order. An event is written once and never rewritten, so an id already held wins. */
function mergeLogs(held: LogView[], arriving: LogView[]): LogView[] {
  const ids = new Set(held.map(log => log.id));
  const added = arriving.filter(log => log && Number.isSafeInteger(log.id) && !ids.has(log.id));
  return added.length ? [...held, ...added].sort((a, b) => a.id - b.id) : held;
}

function browserSocket(url: string): SocketTransport {
  const socket = new WebSocket(url);
  return { send: data => { socket.send(data); }, close: () => { socket.close(); },
    onMessage: listener => { socket.addEventListener('message', event => { if (typeof event.data === 'string') listener(event.data); }); },
    onClose: listener => { socket.addEventListener('close', listener); } };
}
