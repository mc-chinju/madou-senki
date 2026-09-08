import { expect, it } from 'vitest';
import { actionCards, getCharacter } from '@madou/catalog';
import { allCardInstanceIds, createGame, derivedStats, transition } from '../src/index.js';
import { entropy, freshGame, handCard } from './fixtures.js';
const identityEntropy = () => ({ now: 20, dice: [], random: Array(1500).fill(0.999999) });
it('resolves all five OPENs and replacements before next player, keeps their physical cards and derives live modifiers', () => {
  const s = createGame(['A', 'B', 'C', 'D'].map(id => ({ id, name: id })), identityEntropy(), { distribution: 'random', startingSeat: 0 });
  const a = s.players.A!;
  expect(a.open).toEqual(actionCards.filter(c => c.category === 'open').map(c => c.id));
  expect(a.hand).toHaveLength(5); expect(s.players.B!.open).toEqual([]);
  const stats = derivedStats(a); const base = getCharacter(a.characterId)!.base_stats;
  expect(stats).toEqual({ warrior_level: base.warrior_level + 1, magic_level: base.magic_level + 1, spirit: base.spirit + 1, endurance: base.endurance, handLimit: 6, chantLimit: 2, followerLimit: 3, moraleBonus: 1, followerLevelBonus: 1 });
  expect(a.damage).toBe(0);
  const events = s.events.filter(e => e.type === 'CARD_DRAWN' || e.type === 'OPEN');
  expect(events.slice(0, 10).every(e => e.actorId === 'A')).toBe(true); expect(events[10]!.actorId).toBe('B');
  expect(new Set(allCardInstanceIds(s)).size).toBe(220);
  a.open = []; expect(derivedStats(a).spirit).toBe(base.spirit); expect(derivedStats(a).followerLimit).toBe(2);
});
it('Dawn merges discard and current deck during refill, leaves OPEN outside shuffle, and entropy failure is atomic', () => {
  const s = freshGame(); const follower = handCard(s, 'A', '兵士');
  while (s.players.A!.hand.length > 5) s.deck.push(s.players.A!.hand.shift()!);
  const dawn = handCard(s, 'B', '大陸の夜明け'); s.players.B!.hand = s.players.B!.hand.filter(id => id !== dawn);
  s.deck.unshift(dawn); const discarded = s.deck.pop()!; s.discard.push(discarded);
  const before = JSON.stringify(s); const input = { actorId: 'A', command: { type: 'PLACE_INITIAL_FOLLOWER', cardInstanceId: follower } } as const;
  expect(transition(s, input, { now: 1, dice: [], random: [] })).toEqual({ ok: false, code: 'INVALID_ENTROPY' }); expect(JSON.stringify(s)).toBe(before);
  const result = transition(s, input, identityEntropy()); expect(result.ok).toBe(true); if (!result.ok) throw Error(result.code);
  expect(result.state.discard).toEqual([]); expect(result.state.players.A!.open).toContain(dawn); expect(result.state.deck).toContain(discarded);
  expect(result.state.players.A!.hand).toHaveLength(5); expect(new Set(allCardInstanceIds(result.state)).size).toBe(220);
  expect(result).toEqual(transition(JSON.parse(before), input, identityEntropy()));
  expect(result.state.events.map(e => e.id)).toEqual(Array.from({ length: result.state.events.length }, (_, i) => i + 1));
});
it('Blessing allows a third initial follower and Haja still refills only to five', () => {
  let s = createGame(['A', 'B', 'C', 'D'].map(id => ({ id, name: id })), identityEntropy(), { distribution: 'random', startingSeat: 0 });
  for (const name of ['兵士', '市民', 'ゴブリン']) {
    const id = handCard(s, 'A', name); while (s.players.A!.hand.length > 5) s.deck.push(s.players.A!.hand.shift()!);
    const r = transition(s, { actorId: 'A', command: { type: 'PLACE_INITIAL_FOLLOWER', cardInstanceId: id } }, entropy());
    expect(r.ok).toBe(true); if (!r.ok) throw Error(r.code); s = r.state; expect(s.players.A!.hand).toHaveLength(5);
  }
  expect(s.players.A!.followers).toHaveLength(3);
});
it('draws available cards and stops without replenishment debt when deck and discard are empty', () => {
  const s = freshGame(); const id = handCard(s, 'A', '兵士');
  while (s.players.A!.hand.length > 5) s.deck.push(s.players.A!.hand.shift()!);
  s.resolution.push(...s.deck.splice(0));
  const r = transition(s, { actorId: 'A', command: { type: 'PLACE_INITIAL_FOLLOWER', cardInstanceId: id } }, { now: 0, dice: [] });
  expect(r.ok).toBe(true); if (!r.ok) throw Error(r.code); expect(r.state.players.A!.hand).toHaveLength(4); expect(new Set(allCardInstanceIds(r.state)).size).toBe(220);
});
