import { describe, expect, it } from 'vitest';
import { parseClientEnvelope } from '../src/room-messages.js';

const envelope = (command: unknown) => ({ protocolVersion: 1, commandId: 'cmd-1', expectedRevision: 3, command });
describe('room command boundary', () => {
  it('normalizes each explicit lobby command without accepting an actor identity', () => {
    for (const command of [{ type: 'READY', ready: true }, { type: 'START' }, { type: 'LEAVE' },
      { type: 'CLOSE_BY_AGREEMENT', agree: false }, { type: 'UPDATE_SETTINGS', title: '卓', capacity: 4, visibility: 'private' }]) {
      expect(parseClientEnvelope(envelope(command))).toEqual({ ok: true, value: envelope(command) });
      expect(parseClientEnvelope(envelope({ ...command, actorId: 'victim' })).ok).toBe(false);
    }
  });
  it('retains game commands and requires paired window identity only for game commands', () => {
    expect(parseClientEnvelope({ ...envelope({ type: 'PASS' }), windowId: 'w', windowRevision: 2 })).toMatchObject({ ok: true });
    expect(parseClientEnvelope({ ...envelope({ type: 'READY', ready: true }), windowId: 'w', windowRevision: 2 }).ok).toBe(false);
  });
  it('rejects malformed and out-of-bounds lobby commands', () => {
    for (const command of [{ type: 'READY', ready: 1 }, { type: 'START', extra: 1 }, { type: 'CLOSE_BY_AGREEMENT' },
      { type: 'UPDATE_SETTINGS', title: '', capacity: 4, visibility: 'public' },
      { type: 'UPDATE_SETTINGS', title: 'ok', capacity: 3, visibility: 'public' },
      { type: 'UPDATE_SETTINGS', title: 'ok', capacity: 10.5, visibility: 'public' },
      { type: 'UPDATE_SETTINGS', title: 'ok', capacity: 4, visibility: 'friends' }]) {
      expect(parseClientEnvelope(envelope(command)).ok).toBe(false);
    }
    expect(parseClientEnvelope({ ...envelope({ type: 'LEAVE' }), actorId: 'victim' }).ok).toBe(false);
  });
  it('never invokes accessors or accepts symbol/hidden keys or custom prototypes', () => {
    let calls = 0;
    const getter = Object.defineProperty({}, 'type', { enumerable: true, get() { calls++; return 'START'; } });
    const wrapped = Object.defineProperty({}, 'command', { enumerable: true, get() { calls++; return { type: 'START' }; } });
    for (const value of [envelope(getter), wrapped, envelope(Object.assign(Object.create({}), { type: 'START' })),
      envelope({ type: 'START', [Symbol('secret')]: 1 }), envelope(Object.defineProperty({ type: 'START' }, 'extra', { value: 1 }))]) {
      expect(parseClientEnvelope(value).ok).toBe(false);
    }
    expect(calls).toBe(0);
  });
});
