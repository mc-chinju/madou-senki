import { env } from 'cloudflare:workers';
import { evictDurableObject, runInDurableObject } from 'cloudflare:test';
import { ruleset } from '@madou/catalog';
import type { ClientEnvelope, ClientServerMessage } from '@madou/protocol';
import { RoomStorage } from '../../src/rooms/storage.js';
import type { RoomData, RoomView } from '../../src/rooms/types.js';
import { makeScenario, type ScenarioName } from './game-scenarios.js';

type Message = ClientServerMessage<RoomView>;
class Inbox {
  private messages: Message[] = [];
  private wake: (() => void) | null = null;
  constructor(readonly socket: WebSocket) {
    socket.addEventListener('message', event => { this.messages.push(JSON.parse(String(event.data)) as Message); this.wake?.(); });
    socket.accept();
  }
  async next(predicate: (message: Message) => boolean): Promise<Message> {
    for (;;) { const i = this.messages.findIndex(predicate); if (i >= 0) return this.messages.splice(i, 1)[0]!;
      await new Promise<void>(resolve => { this.wake = resolve; }); }
  }
}

/** Exercises the real DO/WebSocket boundary; direct storage access only seeds/inspects test fixtures. */
export async function openTestRoom(name: ScenarioName, actorIds: string[] = ['A', 'B', 'C', 'D']) {
  const roomId = crypto.randomUUID();
  const room = env.ROOMS.getByName(roomId);
  const players = actorIds.map(id => ({ id, name: `${id}さん` }));
  const game = makeScenario(name, players);
  const state: RoomData = { schemaVersion: 1, roomId, title: name, ownerId: 'A', rulesetId: ruleset.id,
    capacity: players.length, visibility: 'private', status: 'playing', createdAt: 1000, game, inviteHash: 'internal-only', closeVotes: [],
    members: Object.fromEntries(players.map(p => [p.id, { ...p, ready: true, joinedAt: 1000 }])) };
  await runInDurableObject(room, (_instance, context) => { new RoomStorage(context.storage).initialize(state); });
  async function connect(actorId: string) {
    const response = await room.fetch('https://room.internal/connect', { headers: { Upgrade: 'websocket', 'X-Room-Actor': actorId } });
    if (!response.webSocket) throw Error('TEST_SOCKET_FAILED');
    const inbox = new Inbox(response.webSocket);
    const first = await inbox.next(message => message.type === 'snapshot');
    if (first.type !== 'snapshot') throw Error('TEST_NO_SNAPSHOT');
    return { inbox, view: first.view };
  }
  return { room, roomId, initial: game,
    async command(actorId: string, envelope: ClientEnvelope) {
      const { inbox } = await connect(actorId);
      inbox.socket.send(JSON.stringify(envelope));
      const response = await inbox.next(message => message.type !== 'snapshot');
      inbox.socket.close(); return response;
    },
    async snapshotFor(actorId: string) { const { inbox, view } = await connect(actorId); inbox.socket.close(); return view; },
    async restart() { await evictDurableObject(room, { webSockets: 'close' }); },
    async stored() { return runInDurableObject(room, (_instance, context) => new RoomStorage<RoomData, unknown, unknown>(context.storage).snapshot()!); },
  };
}
