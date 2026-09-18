import { describe, expect, it } from 'vitest';
import { actionCards, getCharacter } from '@madou/catalog';
import { allCardInstanceIds, createGame, transition, type GameCommand, type GameState } from '../src/index.js';
const players = (n: number) => Array.from({ length: n }, (_, i) => ({ id: String.fromCharCode(65 + i), name: `Player ${i}` }));
const entropy = () => ({ now: 1000, dice: [], random: Array.from({ length: 2000 }, (_, i) => ((i * 193 + 17) % 997) / 997) });
function act(s: GameState, actorId: string, command: GameCommand): GameState {
  const r = transition(s, { actorId, command }, entropy());
  if (!r.ok) throw Error(`${actorId}:${command.type}:${r.code}`);
  return r.state;
}
function reject(s: GameState, actorId: string, command: GameCommand, code: string): void {
  const before = JSON.stringify(s);
  expect(transition(s, { actorId, command }, entropy())).toEqual({ ok: false, code });
  expect(JSON.stringify(s)).toBe(before);
}
/** Test-only zone move: keep every physical card while forcing the next draw. */
function deckTop(s: GameState, name: string): string {
  const id = actionCards.find(card => card.name === name)!.id;
  s.deck = s.deck.filter(x => x !== id); s.discard = s.discard.filter(x => x !== id);
  for (const p of Object.values(s.players)) { p.hand = p.hand.filter(x => x !== id); p.open = p.open.filter(x => x !== id); }
  s.deck.unshift(id); return id;
}
/** Test-only zone move: give a seat a card and keep its hand at the dealt five. */
function give(s: GameState, owner: string, name: string): string {
  const id = actionCards.find(card => card.name === name)!.id;
  s.deck = s.deck.filter(x => x !== id); s.discard = s.discard.filter(x => x !== id);
  for (const p of Object.values(s.players)) { p.hand = p.hand.filter(x => x !== id); p.open = p.open.filter(x => x !== id); }
  const hand = s.players[owner]!.hand; hand.push(id);
  while (hand.length > 5) s.deck.push(hand.splice(hand.findIndex(x => x !== id), 1)[0]!);
  return id;
}
describe('concurrent initial follower rounds', () => {
  it('accepts placement from any participant before the earlier seats are ready', () => {
    let s = createGame(players(4), entropy(), { startingSeat: 0 });
    const soldier = give(s, 'B', '兵士');
    s = act(s, 'B', { type: 'PLACE_INITIAL_FOLLOWER', cardInstanceId: soldier });
    expect(s.players.B!.followers.map(f => f.cardInstanceId)).toEqual([soldier]);
    expect(s.pending).toMatchObject({ round: 1, participantIds: ['A', 'B', 'C', 'D'], readyIds: [], placedIds: ['B'] });
  });
  it('holds the refill until the round closes, then refills only the seats that placed, in seat order', () => {
    let s = createGame(players(4), entropy(), { startingSeat: 0 });
    const first = give(s, 'A', '兵士'); const second = give(s, 'A', '市民');
    const beforeDeck = [...s.deck]; const others = ['B', 'C', 'D'].map(id => [...s.players[id]!.hand]);
    s = act(s, 'A', { type: 'PLACE_INITIAL_FOLLOWER', cardInstanceId: first });
    expect(s.players.A!.hand).toHaveLength(4);
    s = act(s, 'A', { type: 'PLACE_INITIAL_FOLLOWER', cardInstanceId: second });
    expect(s.players.A!.hand).toHaveLength(3);
    expect(s.deck).toEqual(beforeDeck);
    for (const id of ['B', 'C', 'D', 'A']) s = act(s, id, { type: 'PASS_SETUP' });
    expect(s.players.A!.hand).toHaveLength(5);
    // The round-end refill draws from the top of the untouched deck, into A's hand or its OPEN area.
    expect(beforeDeck.slice(-s.deck.length)).toEqual(s.deck);
    for (const id of beforeDeck.slice(0, beforeDeck.length - s.deck.length)) expect([...s.players.A!.hand, ...s.players.A!.open]).toContain(id);
    expect(['B', 'C', 'D'].map(id => s.players[id]!.hand)).toEqual(others);
    // A filled its two slots, so no seat may still place: setup ends with the round.
    expect(s.phase).toBe('turn-start'); expect(s.pending).toBeNull();
  });
  it('produces the same hands and deck whichever seat commits its placement first', () => {
    const play = (order: string[]) => {
      let s = createGame(players(4), entropy(), { startingSeat: 0 });
      const cards = { A: give(s, 'A', '兵士'), B: give(s, 'B', '市民') } as Record<string, string>;
      for (const id of order) s = act(s, id, { type: 'PLACE_INITIAL_FOLLOWER', cardInstanceId: cards[id]! });
      for (const id of ['A', 'B', 'C', 'D']) s = act(s, id, { type: 'PASS_SETUP' });
      return s;
    };
    const forward = play(['A', 'B']); const reversed = play(['B', 'A']);
    expect(reversed.deck).toEqual(forward.deck);
    for (const id of ['A', 'B', 'C', 'D']) expect(reversed.players[id]!.hand).toEqual(forward.players[id]!.hand);
  });
  it('opens a second round for seats that placed and stayed under the limit, and ends when nobody may place', () => {
    let s = createGame(players(4), entropy(), { startingSeat: 0 });
    const soldier = give(s, 'A', '兵士'); const twoForB = ['市民', 'ゴブリン'].map(name => give(s, 'B', name));
    const drawn = deckTop(s, '傭兵');
    s = act(s, 'A', { type: 'PLACE_INITIAL_FOLLOWER', cardInstanceId: soldier });
    for (const card of twoForB) s = act(s, 'B', { type: 'PLACE_INITIAL_FOLLOWER', cardInstanceId: card });
    for (const id of ['A', 'B', 'C', 'D']) s = act(s, id, { type: 'PASS_SETUP' });
    expect(s.phase).toBe('setup');
    expect(s.pending).toMatchObject({ round: 2, participantIds: ['A'], readyIds: [], placedIds: [] });
    expect(s.players.A!.hand).toContain(drawn);
    for (const id of ['B', 'C', 'D']) reject(s, id, { type: 'PASS_SETUP' }, 'NOT_YOUR_TURN');
    const spare = give(s, 'A', 'ゴブリン');
    s = act(s, 'A', { type: 'PLACE_INITIAL_FOLLOWER', cardInstanceId: drawn });
    reject(s, 'A', { type: 'PLACE_INITIAL_FOLLOWER', cardInstanceId: spare }, 'FOLLOWER_CAPACITY');
    s = act(s, 'A', { type: 'PASS_SETUP' });
    expect(s.phase).toBe('turn-start'); expect(s.pending).toBeNull();
    expect(s.events.some(e => e.type === 'SETUP_COMPLETE')).toBe(true);
  });
  it('rejects placement and a second ready from a seat that already finished its round', () => {
    let s = createGame(players(4), entropy(), { startingSeat: 0 });
    const soldier = give(s, 'A', '兵士');
    s = act(s, 'A', { type: 'PASS_SETUP' });
    reject(s, 'A', { type: 'PLACE_INITIAL_FOLLOWER', cardInstanceId: soldier }, 'NOT_YOUR_TURN');
    reject(s, 'A', { type: 'PASS_SETUP' }, 'NOT_YOUR_TURN');
  });
  it('measures the placement limit after the refill OPEN, so a drawn blessing reopens a full seat', () => {
    let s = createGame(players(4), entropy(), { startingSeat: 0 });
    const twoForA = ['兵士', '市民'].map(name => give(s, 'A', name));
    deckTop(s, '祝福');
    for (const card of twoForA) s = act(s, 'A', { type: 'PLACE_INITIAL_FOLLOWER', cardInstanceId: card });
    for (const id of ['A', 'B', 'C', 'D']) s = act(s, id, { type: 'PASS_SETUP' });
    expect(s.players.A!.open).toContain(actionCards.find(card => card.name === '祝福')!.id);
    expect(s.pending).toMatchObject({ round: 2, participantIds: ['A'] });
    s = act(s, 'A', { type: 'PASS_SETUP' });
    expect(s.phase).toBe('turn-start');
  });
  it('places at the front line on request and behind the existing followers by default', () => {
    let s = createGame(players(4), entropy(), { startingSeat: 0 });
    const first = give(s, 'A', '兵士'); const second = give(s, 'A', '市民');
    s = act(s, 'A', { type: 'PLACE_INITIAL_FOLLOWER', cardInstanceId: first });
    s = act(s, 'A', { type: 'PLACE_INITIAL_FOLLOWER', cardInstanceId: second, position: 'front' });
    expect(s.players.A!.followers.map(f => f.cardInstanceId)).toEqual([second, first]);
  });
  it('lets the second round place a drawn follower at the front line', () => {
    let s = createGame(players(4), entropy(), { startingSeat: 0 });
    const soldier = give(s, 'A', '兵士');
    const drawn = deckTop(s, '傭兵');
    s = act(s, 'A', { type: 'PLACE_INITIAL_FOLLOWER', cardInstanceId: soldier });
    for (const id of ['A', 'B', 'C', 'D']) s = act(s, id, { type: 'PASS_SETUP' });
    s = act(s, 'A', { type: 'PLACE_INITIAL_FOLLOWER', cardInstanceId: drawn, position: 'front' });
    expect(s.players.A!.followers.map(f => f.cardInstanceId)).toEqual([drawn, soldier]);
    expect(allCardInstanceIds(s)).toHaveLength(220);
  });
});
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
    expect(s.pending).toEqual({ kind: 'initial-followers', round: 1, participantIds: s.seatOrder, readyIds: [], placedIds: [] });
  });
  it('is reproducible and resumes JSON state deterministically without mutation', () => {
    const s = createGame(players(4), entropy(), { startingSeat: 2 });
    expect(s).toEqual(createGame(players(4), entropy(), { startingSeat: 2 }));
    const before = JSON.stringify(s);
    const input = { actorId: s.pending!.participantIds[0]!, command: { type: 'PASS_SETUP' } } as const;
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
    for (const actorId of [...s.seatOrder]) {
      const r = transition(s, { actorId, command: { type: 'PASS_SETUP' } }, entropy());
      expect(r.ok).toBe(true); if (!r.ok) throw Error(r.code); s = r.state;
    }
    expect(s.phase).toBe('turn-start'); expect(s.turnSeat).toBe(2); expect(s.pending).toBeNull();
    expect(transition(s, { actorId: 'A', command: { type: 'PASS_SETUP' } }, entropy())).toEqual({ ok: false, code: 'WRONG_PHASE' });
  });
});
