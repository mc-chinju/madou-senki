import { actionCards, initialCharacterPool } from '@madou/catalog';
import { expect, it } from 'vitest';
import { allCardInstanceIds, transition } from '../src/index.js';
import { character, entropy, freshGame, handCard } from './fixtures.js';
it('places concealed followers in order, holds the refill for the round end and rejects capacity, repeats and other hands without mutation', () => {
  let s = freshGame();
  const first = handCard(s, 'A', '兵士'); const second = handCard(s, 'A', '市民'); const third = handCard(s, 'A', 'ゴブリン');
  // Move excess hand back to deck so the round-end refill has to draw.
  while (s.players.A!.hand.length > 5) s.deck.push(s.players.A!.hand.shift()!);
  let remaining = s.players.A!.hand.length;
  for (const id of [first, second]) {
    const before = JSON.stringify(s);
    expect(transition(s, { actorId: 'B', command: { type: 'PLACE_INITIAL_FOLLOWER', cardInstanceId: id } }, entropy())).toEqual({ ok: false, code: 'CARD_NOT_IN_HAND' });
    const r = transition(s, { actorId: 'A', command: { type: 'PLACE_INITIAL_FOLLOWER', cardInstanceId: id } }, entropy());
    expect(r.ok).toBe(true); expect(JSON.stringify(s)).toBe(before); if (!r.ok) throw Error(r.code); s = r.state;
    expect(s.players.A!.hand).toHaveLength(--remaining);
    expect(transition(s, { actorId: 'A', command: { type: 'PLACE_INITIAL_FOLLOWER', cardInstanceId: id } }, entropy()).ok).toBe(false);
  }
  expect(s.players.A!.followers).toEqual([{ cardInstanceId: first, revealed: false, placedById: 'A', placedLifeId: 'initial-life:A' }, { cardInstanceId: second, revealed: false, placedById: 'A', placedLifeId: 'initial-life:A' }]);
  expect(transition(s, { actorId: 'A', command: { type: 'PLACE_INITIAL_FOLLOWER', cardInstanceId: third } }, entropy())).toEqual({ ok: false, code: 'FOLLOWER_CAPACITY' });
  expect(allCardInstanceIds(s)).toHaveLength(220); expect(new Set(allCardInstanceIds(s)).size).toBe(220);
});
it.each([['アルケミア城', 'EVIL'], ['ガイナス城', 'GOOD']])('enforces %s printed faction restriction', (name, faction) => {
  const s = freshGame(); s.players.A!.faction = faction as 'GOOD' | 'EVIL'; const id = handCard(s, 'A', name);
  expect(transition(s, { actorId: 'A', command: { type: 'PLACE_INITIAL_FOLLOWER', cardInstanceId: id } }, entropy())).toEqual({ ok: false, code: 'FOLLOWER_RESTRICTED' });
});
it('does not confuse attack/morale character clauses with placement or roll morale at setup', () => {
  const s = freshGame(); character(s, 'A', '白魔術師シェリム'); const id = handCard(s, 'A', '有翼族');
  expect(transition(s, { actorId: 'A', command: { type: 'PLACE_INITIAL_FOLLOWER', cardInstanceId: id } }, { now: 0, dice: [] }).ok).toBe(true);
});
it('rejects malformed commands, unknown actors, and nonfollowers', () => {
  const s = freshGame(); const before = JSON.stringify(s); const id = handCard(s, 'A', '命運凶変'); const snapshot = JSON.stringify(s);
  expect(transition(s, { actorId: 'A', command: { type: 'PLACE_INITIAL_FOLLOWER', cardInstanceId: id } }, entropy()).ok).toBe(false);
  expect(transition(s, { actorId: 'intruder', command: { type: 'PASS_SETUP' } }, entropy())).toEqual({ ok: false, code: 'UNKNOWN_ACTOR' });
  expect(transition(s, { actorId: 'A', command: { type: 'PASS_SETUP', actorId: 'B' } } as any, entropy())).toEqual({ ok: false, code: 'INVALID_COMMAND' });
  expect(JSON.stringify(s)).toBe(snapshot); expect(before).not.toBe(snapshot);
});

it.each(actionCards.filter(c => c.category === 'follower'))('checks every initial character against printed placement eligibility for $name', card => {
  for (const c of initialCharacterPool) {
    const s = freshGame(); character(s, 'A', c.name); const id = handCard(s, 'A', card.name);
    const expected = (card.name !== 'アルケミア城' || c.initial_faction === 'GOOD') && (card.name !== 'ガイナス城' || c.initial_faction === 'EVIL');
    const r = transition(s, { actorId: 'A', command: { type: 'PLACE_INITIAL_FOLLOWER', cardInstanceId: id } }, { now: 0, dice: [] });
    expect(r.ok, `${c.name}: ${card.name}`).toBe(expected);
  }
});
