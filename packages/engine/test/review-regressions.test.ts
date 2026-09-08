import { expect, it } from 'vitest';
import { allCardInstanceIds, derivedStats, transition, viewFor, type GameInput } from '../src/index.js';
import { act, finish, pass, ready, until } from './combat-helpers.js';
import { character, entropy, handCard } from './fixtures.js';

it('checks dynamic parry shortage and returns to defense with the failed card spent', () => {
  let state = ready(); character(state, 'B', '凍気のアイエル');
  const attack = handCard(state, 'A', '踏み込み／弓');
  const parry = handCard(state, 'B', '受け流し');
  const evade = handCard(state, 'B', '見切る');
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: attack, targetIds: ['B'], dedicated: false });
  state = until(state, 'normal-defense');
  state = act(state, 'B', { type: 'PLAY_DEFENSE', cardInstanceId: parry, dedicated: false });
  const defense = Object.values(state.actions!).find(action => action.cardInstanceId === parry)!;
  expect(defense.technique.useLevel).toBe(3);
  expect(defense.checks).toHaveLength(3 - derivedStats(state.players.B!).warrior_level);
  for (let i = 0; i < 60 && state.windows!.at(-1)!.kind !== 'normal-defense'; i++) state = pass(state, [6, 6]);
  expect(state.discard).toContain(parry);
  state = act(state, 'B', { type: 'PLAY_DEFENSE', cardInstanceId: evade, dedicated: false });
  expect(finish(state).players.B!.damage).toBe(0);
});

it('rejects parry against magic before reserving or spending anything', () => {
  let state = ready(); character(state, 'A', '白魔術師シェリム');
  const attack = handCard(state, 'A', '沈黙'); const parry = handCard(state, 'B', '受け流し');
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: attack, targetIds: ['B'], dedicated: false }); state = until(state, 'normal-defense');
  const before = JSON.stringify(state);
  expect(transition(state, { actorId: 'B', command: { type: 'PLAY_DEFENSE', cardInstanceId: parry, dedicated: false } }, entropy())).toEqual({ ok: false, code: 'ILLEGAL_DEFENSE' });
  expect(JSON.stringify(state)).toBe(before);
});

it('requires a non-Shin spirit-minus-two activation check before ordinary level checks', () => {
  let state = ready(); character(state, 'A', 'リーア姫');
  const attack = handCard(state, 'A', '天地百撃斬');
  state.players.A!.hand = state.players.A!.hand.filter(id => id !== attack);
  state.players.A!.chants.push({ cardInstanceId: attack, revealed: false });
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: attack, targetIds: ['B'], dedicated: false }, [2]);
  const stats = derivedStats(state.players.A!);
  expect(Object.values(state.actions!)[0]!.checks).toEqual([-2, ...Array(7 - stats.warrior_level).fill(0)]);
  for (let i = 0; i < 80 && state.windows?.length; i++) state = pass(state, [6, 6]);
  expect(state.players.B!.damage).toBe(0);
  expect(state.discard).toContain(attack);
  expect(state.groups ?? {}).toEqual({});
});

it.each([false, true])('keeps Ida chant disposal an explicit persisted on-hit choice: %s', discard => {
  let state = ready(); character(state, 'A', '忍びのイダ');
  const attack = handCard(state, 'A', '手裏剣'); const chant = handCard(state, 'B', '天地百撃斬');
  state.players.B!.hand = state.players.B!.hand.filter(id => id !== chant);
  state.players.B!.chants.push({ cardInstanceId: chant, revealed: false });
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: attack, targetIds: ['B'], dedicated: true }, [2]);
  for (let i = 0; i < 100 && state.windows?.length && state.windows.at(-1)!.kind !== 'on-hit-choice'; i++) state = pass(state);
  expect(state.windows?.at(-1)?.kind).toBe('on-hit-choice');
  expect(state.players.B!.chants).toHaveLength(1);
  expect(viewFor(state, 'A').legalChoices).toContain('DISCARD_HIT_CHANTS');
  expect(JSON.stringify(viewFor(state, 'A'))).not.toContain(chant);
  const before = allCardInstanceIds(state).sort();
  const input = { actorId: 'A', command: { type: 'DISCARD_HIT_CHANTS', discard } } as unknown as GameInput;
  const result = transition(JSON.parse(JSON.stringify(state)), input, entropy());
  expect(result.ok).toBe(true);
  if (!result.ok) throw Error(result.code);
  expect(result.state.players.B!.chants).toHaveLength(discard ? 0 : 1);
  expect(result.state.discard.includes(chant)).toBe(discard);
  expect(allCardInstanceIds(result.state).sort()).toEqual(before);
});
