import { describe, expect, it } from 'vitest';
import { actionCards, getCharacter } from '@madou/catalog';
import { allCardInstanceIds, createGame, transition } from '../src/index.js';
const players = (n: number) => Array.from({ length: n }, (_, i) => ({ id: String.fromCharCode(65 + i), name: `Player ${i}` }));
const entropy = () => ({ now: 1000, dice: [], random: Array.from({ length: 2000 }, (_, i) => ((i * 193 + 17) % 997) / 997) });
describe('actual second edition setup', () => {
  it.each([4, 5, 6, 8, 10])('balances %i seats, deals sequentially, excludes transformations and conserves 220 cards', (n) => {
    const s = createGame(players(n), entropy());
    const chars = Object.values(s.players).map((p: any) => getCharacter(p.characterId)!);
    expect(chars.filter(c => c.initial_faction === 'GOOD').length).toBeGreaterThanOrEqual(Math.floor(n / 2));
    expect(chars.filter(c => c.initial_faction === 'EVIL').length).toBeGreaterThanOrEqual(Math.floor(n / 2));
    expect(chars.every(c => !c.transformation_only)).toBe(true);
    expect(new Set(chars.map(c => c.id)).size).toBe(n);
    for (const p of Object.values(s.players) as any[]) expect(p.hand).toHaveLength(5);
    expect(allCardInstanceIds(s).sort()).toEqual(actionCards.map(c => c.id).sort());
    expect(new Set(allCardInstanceIds(s)).size).toBe(220);
    for (const a of s.seatOrder) for (const b of s.seatOrder) if (a !== b) expect(s.distances[a]![b]).toBe('far');
    expect(s.phase).toBe('setup');
    expect(s.pending!.actorId).toBe(s.seatOrder[0]);
  });
  it('is reproducible and resumes JSON state deterministically without mutation', () => {
    const s = createGame(players(4), entropy(), { startingSeat: 2 });
    expect(s).toEqual(createGame(players(4), entropy(), { startingSeat: 2 }));
    const before = JSON.stringify(s);
    const input = { actorId: s.pending!.actorId, command: { type: 'PASS_SETUP' } } as const;
    expect(transition(s, input, entropy())).toEqual(transition(JSON.parse(before), input, entropy()));
    expect(JSON.stringify(s)).toBe(before);
  });
  it.each([0, 3, 11])('rejects invalid count %i', n => expect(() => createGame(players(n), entropy())).toThrow());
  it('rejects duplicate/blank/prototype player ids, bad options and entropy', () => {
    for (const id of ['A', '', '__proto__', 'constructor']) expect(() => createGame([...players(3), { id, name: 'X' }], entropy())).toThrow();
    expect(() => createGame(players(4), entropy(), { startingSeat: 4 })).toThrow();
    expect(() => createGame(players(4), { now: NaN, dice: [], random: [0.5] })).toThrow();
    expect(() => createGame(players(4), { now: 0, dice: [], random: [] })).toThrow();
    for (const invalid of [-0.1, 1, NaN]) expect(() => createGame(players(4), { now: 0, dice: [], random: [invalid] })).toThrow();
  });
  it('permits entirely one faction with random distribution', () => {
    const s = createGame(players(4), { now: 0, dice: [], random: Array(1500).fill(0.999) }, { distribution: 'random', startingSeat: 0 });
    expect(new Set(Object.values(s.players).map((p: any) => p.faction)).size).toBe(1);
  });
  it('passes each seat once and stops at first turn start', () => {
    let s = createGame(players(4), entropy(), { startingSeat: 2 });
    for (let i = 0; i < 4; i++) {
      const r = transition(s, { actorId: s.pending!.actorId, command: { type: 'PASS_SETUP' } }, entropy());
      expect(r.ok).toBe(true); if (!r.ok) throw Error(r.code); s = r.state;
    }
    expect(s.phase).toBe('turn-start'); expect(s.turnSeat).toBe(2); expect(s.pending).toBeNull();
    expect(transition(s, { actorId: 'A', command: { type: 'PASS_SETUP' } }, entropy())).toEqual({ ok: false, code: 'WRONG_PHASE' });
  });
});
