import type { PlayerView } from '../../packages/engine/src/index.js';
import type { Command } from '../../packages/engine/src/bot/index.js';
import { isRoomCommand, type ClientErrorCode, type ClientServerMessage, type RoomCommand } from '../../packages/protocol/src/index.js';
import type { RoomView } from '../../apps/worker/src/rooms/types.js';

type Wire = ClientServerMessage<RoomView>;

export class BotClient {
  private socket: WebSocket | null = null;
  private roomView: RoomView | null = null;
  private queue: Wire[] = [];
  private wake: (() => void) | null = null;
  private lastPayload: string | null = null;

  constructor(private readonly baseURL: string, private readonly cookie: string, private readonly roomId: string) {}

  view(): PlayerView | null {
    return this.roomView?.game ?? null;
  }

  revision(): number | null {
    return this.roomView?.revision ?? null;
  }

  async connect(): Promise<void> {
    const origin = new URL(this.baseURL);
    const url = new URL(`/api/rooms/${encodeURIComponent(this.roomId)}/ws`, origin);
    url.protocol = origin.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(url, { headers: { Cookie: this.cookie, Origin: origin.origin } } as unknown as string[]);
    this.socket = socket;
    socket.addEventListener('message', event => {
      const message = JSON.parse(String(event.data)) as Wire;
      if (message.type === 'snapshot') this.roomView = message.view;
      this.queue.push(message);
      this.wake?.();
    });
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener('open', () => resolve(), { once: true });
      socket.addEventListener('error', () => reject(new Error('BOT_SOCKET')), { once: true });
    });
    const first = await this.next(message => message.type === 'snapshot' && !message.view.readOnly);
    if (first.type !== 'snapshot') throw new Error('BOT_NO_SNAPSHOT');
    this.roomView = first.view;
  }

  payload(): string | null {
    return this.lastPayload;
  }

  async send(command: Command | RoomCommand, options: { commandId?: string } = {}): Promise<{ ok: boolean; code?: ClientErrorCode; revision?: number }> {
    const socket = this.socket;
    if (!socket || !this.roomView) return { ok: false, code: 'ROOM_UNAVAILABLE' as ClientErrorCode };
    const commandId = options.commandId ?? crypto.randomUUID();
    const envelope: Record<string, unknown> = {
      protocolVersion: 1, commandId, expectedRevision: this.roomView.revision, command,
    };
    // Same base as the browser client: the window generation, or the open setup round.
    const game = this.roomView.game;
    const window = game?.activeWindow;
    const base = window ? { windowId: window.windowId, windowRevision: window.windowRevision }
      : game?.phase === 'setup' && game.pending ? { windowId: `setup-${game.pending.round}`, windowRevision: 0 } : null;
    if (!isRoomCommand(command) && base) {
      envelope.windowId = base.windowId;
      envelope.windowRevision = base.windowRevision;
    }
    const payload = JSON.stringify(envelope);
    this.lastPayload = payload;
    socket.send(payload);
    const reply = await this.next(message => message.type !== 'snapshot' && (message.commandId === commandId || message.commandId === undefined));
    if (reply.type === 'error') return { ok: false, code: reply.code };
    if (reply.type === 'ack') {
      while ((this.roomView?.revision ?? 0) < reply.revision) {
        await this.next(message => message.type === 'snapshot');
      }
      return { ok: true, revision: reply.revision };
    }
    return { ok: false };
  }

  async sendPayload(payload: string): Promise<{ ok: boolean; code?: ClientErrorCode; revision?: number }> {
    const socket = this.socket;
    if (!socket) return { ok: false };
    const commandId = (JSON.parse(payload) as { commandId: string }).commandId;
    this.lastPayload = payload;
    socket.send(payload);
    const reply = await this.next(message => message.type !== 'snapshot' && (message.commandId === commandId || message.commandId === undefined));
    if (reply.type === 'error') return { ok: false, code: reply.code };
    if (reply.type === 'ack') return { ok: true, revision: reply.revision };
    return { ok: false };
  }

  async resendLast(): Promise<{ ok: boolean; code?: ClientErrorCode; revision?: number }> {
    if (!this.lastPayload) return { ok: false };
    return this.sendPayload(this.lastPayload);
  }

  close(): void {
    this.socket?.close();
    this.socket = null;
  }

  private async next(predicate: (message: Wire) => boolean): Promise<Wire> {
    for (;;) {
      const index = this.queue.findIndex(predicate);
      if (index >= 0) return this.queue.splice(index, 1)[0]!;
      await new Promise<void>(resolve => { this.wake = resolve; });
    }
  }
}
