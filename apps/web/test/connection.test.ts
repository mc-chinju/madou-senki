import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearPendingDeparture, RoomConnection, type SocketTransport } from '../src/connection/client.js';
import type { RoomView } from '../../worker/src/rooms/types.js';

class Socket implements SocketTransport {
  sent: string[] = [];
  message: (data: string) => void = () => {};
  closed: () => void = () => {};
  send(data: string) { this.sent.push(data); }
  close() { this.closed(); }
  onMessage(listener: (data: string) => void) { this.message = listener; }
  onClose(listener: () => void) { this.closed = listener; }
  receive(value: unknown) { this.message(JSON.stringify(value)); }
}
function view(revision = 4, readOnly = false): RoomView {
  return { roomId: 'room', title: 'Test', ownerId: 'A', rulesetId: 'second', capacity: 4, visibility: 'public', status: 'lobby', revision,
    members: [{ id: 'A', name: 'A', ready: false, connected: true }], readOnly, closeVotes: [], game: null };
}
const snapshot = (revision = 4, readOnly = false) => ({ type: 'snapshot', revision, view: view(revision, readOnly) });
function fixture() {
  const sockets: Socket[] = [];
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  let serial = 0;
  const options = { roomId: 'room', actorId: 'A', url: 'ws://localhost/room', storage,
    socketFactory: () => { const socket = new Socket(); sockets.push(socket); return socket; }, commandId: () => `command-${++serial}` };
  const client = new RoomConnection(options);
  client.start();
  return { client, sockets, storage, options, values };
}
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('browser room connection', () => {
  it('allows actions only after sync and waits for ACK plus the updated snapshot', () => {
    const { client, sockets } = fixture();
    expect(client.send({ type: 'READY', ready: true })).toBe(false);
    sockets[0]!.receive(snapshot());
    expect(client.getSnapshot().status).toBe('ready');
    expect(client.send({ type: 'READY', ready: true })).toBe(true);
    expect(client.send({ type: 'READY', ready: true })).toBe(false);
    sockets[0]!.receive({ type: 'ack', commandId: 'command-1', revision: 5 });
    expect(client.getSnapshot().status).toBe('syncing');
    sockets[0]!.receive(snapshot(5));
    expect(client.getSnapshot().status).toBe('ready');
  });
  it('reconnects then resends the exact unacknowledged envelope only after a fresh snapshot', () => {
    const { client, sockets } = fixture();
    sockets[0]!.receive(snapshot());
    client.send({ type: 'READY', ready: true });
    const original = sockets[0]!.sent[0];
    sockets[0]!.close();
    expect(client.send({ type: 'LEAVE' })).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(sockets[1]!.sent).toEqual([]);
    sockets[1]!.receive(snapshot(5));
    expect(sockets[1]!.sent).toEqual([original]);
    sockets[1]!.receive({ type: 'ack', commandId: 'command-1', revision: 5 });
    expect(client.getSnapshot().status).toBe('ready');
  });
  it('restores pending commands across reload, scoped to actor and room', () => {
    const { client, sockets, options, values } = fixture();
    sockets[0]!.receive(snapshot()); client.send({ type: 'READY', ready: true });
    const original = sockets[0]!.sent[0]; client.stop();
    expect([...values.values()].join('')).not.toContain('members');
    const reloaded = new RoomConnection(options); reloaded.start(); sockets[1]!.receive(snapshot(5));
    expect(sockets[1]!.sent).toEqual([original]);
    const stranger = new RoomConnection({ ...options, actorId: 'B' }); stranger.start(); sockets[2]!.receive(snapshot());
    expect(sockets[2]!.sent).toEqual([]);
  });
  it('drops a rejected stale action and waits for the corrected snapshot before accepting another', () => {
    const { client, sockets } = fixture();
    sockets[0]!.receive(snapshot()); client.send({ type: 'READY', ready: true });
    sockets[0]!.receive({ type: 'error', code: 'STALE_REVISION', commandId: 'command-1' });
    expect(client.send({ type: 'LEAVE' })).toBe(false);
    sockets[0]!.receive(snapshot(6));
    expect(client.getSnapshot().status).toBe('ready');
    client.send({ type: 'LEAVE' });
    expect(JSON.parse(sockets[0]!.sent[1]!)).toMatchObject({ expectedRevision: 6, commandId: 'command-2' });
  });
  it('keeps old tabs read-only without reconnecting to steal the active generation', () => {
    const { client, sockets } = fixture();
    sockets[0]!.receive(snapshot(4, true));
    expect(client.getSnapshot().status).toBe('read-only');
    expect(client.send({ type: 'LEAVE' })).toBe(false);
    vi.advanceTimersByTime(30000);
    expect(sockets).toHaveLength(1);
  });
  it('ignores late events from superseded sockets and cancels reconnects when disposed', () => {
    const { client, sockets } = fixture();
    sockets[0]!.receive(snapshot()); sockets[0]!.close(); vi.advanceTimersByTime(1000);
    sockets[1]!.receive(snapshot(8)); sockets[0]!.receive(snapshot(99));
    expect(client.getSnapshot().view?.revision).toBe(8);
    client.stop(); vi.advanceTimersByTime(30000);
    expect(sockets).toHaveLength(2);
    expect(client.getSnapshot().status).toBe('stopped');
  });
  it('recovers from a lost ACK even when the connection does not close by itself', () => {
    const { client, sockets } = fixture();
    sockets[0]!.receive(snapshot()); client.send({ type: 'READY', ready: true });
    sockets[0]!.receive(snapshot(5));
    vi.advanceTimersByTime(11000);
    expect(sockets).toHaveLength(2);
    sockets[1]!.receive(snapshot(5));
    expect(sockets[1]!.sent).toEqual(sockets[0]!.sent);
  });
  it('does not let unrelated snapshots postpone receipt recovery indefinitely', () => {
    const { client, sockets } = fixture();
    sockets[0]!.receive(snapshot()); client.send({ type: 'READY', ready: true });
    vi.advanceTimersByTime(4000); sockets[0]!.receive(snapshot(5));
    vi.advanceTimersByTime(4000); sockets[0]!.receive(snapshot(6));
    vi.advanceTimersByTime(3000);
    expect(sockets).toHaveLength(2);
  });
  it('refuses to send if pending-operation persistence fails', () => {
    const { client, sockets, storage } = fixture();
    sockets[0]!.receive(snapshot());
    vi.spyOn(storage, 'setItem').mockImplementation(() => { throw Error('storage blocked'); });
    expect(client.send({ type: 'LEAVE' })).toBe(false);
    expect(sockets[0]!.sent).toEqual([]);
    expect(client.getSnapshot().error).toBe('CLIENT_STORAGE_ERROR');
  });
  it('rejects an oversized but protocol-valid envelope before persisting or transmitting it', () => {
    const { client, sockets, values } = fixture();
    sockets[0]!.receive(snapshot());
    const cardInstanceIds = Array.from({ length: 220 }, (_, i) => `card-${i}-${'x'.repeat(110)}`);
    expect(client.send({ type: 'REST', cardInstanceIds })).toBe(false);
    expect(sockets[0]!.sent).toEqual([]);
    expect(values.size).toBe(0);
    expect(client.getSnapshot().error).toBe('MESSAGE_TOO_LARGE');
  });
  it('keeps the pending receipt when an ACK revision cannot represent this command commit', () => {
    const { client, sockets } = fixture();
    sockets[0]!.receive(snapshot()); client.send({ type: 'READY', ready: true });
    for (const revision of [0, 3, 4]) {
      sockets[0]!.receive({ type: 'ack', commandId: 'command-1', revision });
      expect(client.getSnapshot().pending).toBe(true);
    }
    // Concurrent seats may commit between the send and this commit, so any later revision acknowledges it.
    sockets[0]!.receive({ type: 'ack', commandId: 'command-1', revision: 6 });
    expect(client.getSnapshot().pending).toBe(false);
  });
  it('bases a setup command on the open round so concurrent seats do not invalidate it', () => {
    const { client, sockets } = fixture();
    const game = { revision: 4, phase: 'setup', activeWindow: null,
      pending: { kind: 'initial-followers', round: 2, participantIds: ['A'], readyIds: [] } } as unknown as NonNullable<RoomView['game']>;
    sockets[0]!.receive({ type: 'snapshot', revision: 4, view: { ...view(4), status: 'playing', game } });
    expect(client.send({ type: 'PASS_SETUP' })).toBe(true);
    expect(JSON.parse(sockets[0]!.sent[0]!)).toMatchObject({ expectedRevision: 4, windowId: 'setup-2', windowRevision: 0 });
  });
  it('clears only a departed-seat LEAVE intent and preserves other unresolved operations', () => {
    const { client, sockets, storage, values } = fixture();
    sockets[0]!.receive(snapshot()); client.send({ type: 'LEAVE' }); client.stop();
    clearPendingDeparture(storage, 'B', 'room'); expect(values.size).toBe(1);
    clearPendingDeparture(storage, 'A', 'room'); expect(values.size).toBe(0);
    const other = fixture(); other.sockets[0]!.receive(snapshot()); other.client.send({ type: 'READY', ready: true });
    clearPendingDeparture(other.storage, 'A', 'room'); expect(other.values.size).toBe(1);
  });

  /** The record is read back page by page, so a slow answer must not let a second ask pile on top of it. */
  it('asks for one older page at a time, keeps what it gathered, and gives up only the page a dead socket owed', () => {
    const { client, sockets } = fixture();
    sockets[0]!.receive(snapshot());
    expect(client.requestLogPage(0)).toBe(false);
    expect(client.requestLogPage(51)).toBe(true);
    expect(client.requestLogPage(51)).toBe(false);
    expect(client.getSnapshot().logHistory.loading).toBe(true);
    expect(JSON.parse(sockets[0]!.sent.at(-1)!)).toEqual({ type: 'LOG_PAGE', requestId: 'command-1', beforeId: 51, limit: 200 });
    // A page answering some other request is not this reader's, so it changes nothing.
    sockets[0]!.receive({ type: 'log-page', requestId: 'other', beforeId: 51, logStart: 1, logs: [{ id: 9 }], privateLogs: [] });
    expect(client.getSnapshot().logHistory).toMatchObject({ logs: [], loading: true });
    sockets[0]!.receive({ type: 'log-page', requestId: 'command-1', beforeId: 51, logStart: 1, logs: [{ id: 3 }, { id: 5 }], privateLogs: [{ id: 4 }] });
    expect(client.getSnapshot().logHistory).toEqual({ logs: [{ id: 3 }, { id: 5 }], privateLogs: [{ id: 4 }], loading: false });
    // An event is written once, so a page seen twice adds nothing and the record stays in order.
    expect(client.requestLogPage(3)).toBe(true);
    sockets[0]!.receive({ type: 'log-page', requestId: 'command-2', beforeId: 3, logStart: 1, logs: [{ id: 1 }, { id: 3 }], privateLogs: [] });
    expect(client.getSnapshot().logHistory.logs).toEqual([{ id: 1 }, { id: 3 }, { id: 5 }]);
    // A socket that dies owing a page releases the wait but keeps every page already read.
    client.requestLogPage(1);
    expect(client.getSnapshot().logHistory.loading).toBe(true);
    sockets[0]!.closed();
    expect(client.getSnapshot().logHistory).toMatchObject({ logs: [{ id: 1 }, { id: 3 }, { id: 5 }], loading: false });
    vi.advanceTimersByTime(1000);
    sockets[1]!.receive(snapshot());
    expect(client.requestLogPage(1)).toBe(true);
  });
});
