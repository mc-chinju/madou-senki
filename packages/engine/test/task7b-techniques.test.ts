import { expect, it } from 'vitest';
import * as engine from '../src/index.js';
import { closeWindow, act, finish, pass, ready, until } from './combat-helpers.js';
import { character, entropy, handCard } from './fixtures.js';

type CardCase = readonly [
  id: string,
  name: string,
  owner: string,
  range: 'near' | 'far',
  damage: number,
  chant: boolean,
];

const ordinary: readonly CardCase[] = [
  ['a2-p10-r1c1', '死鬼界滅拳', '大神官ジル', 'near', 6, false],
  ['a2-p10-r1c2', '死鬼滅殺拳', '大神官ジル', 'near', 10, false],
  ['a2-p10-r2c1', '天地爆砕剣', '侍大将のシン', 'far', 15, true],
  ['a2-p10-r2c2', '光流弓', '妖精王フューリー', 'far', 8, false],
  ['a2-p10-r2c3', '星流弓', '妖精王フューリー', 'far', 10, true],
  ['a2-p10-r3c1', '狼牙', '餓狼ヨーツルム', 'near', 2, false],
  ['a2-p10-r3c2', '連槍撃', '早駆けのランカスター', 'far', 5, false],
  ['a2-p11-r1c1', '竜殺天空槍', '早駆けのランカスター', 'far', 10, false],
  ['a2-p11-r1c2', '妖撃破山剣', '聖騎士ランスロット', 'near', 4, false],
  ['a2-p11-r2c1', '光竜剣', '聖騎士ランスロット', 'near', 6, false],
  ['a2-p11-r2c2', '光竜破山剣', '聖騎士ランスロット', 'far', 10, true],
  ['a2-p11-r2c3', '撃戦斧', '小人のランバ', 'near', 6, false],
  ['a2-p11-r3c1', '剛戦斧', '小人のランバ', 'near', 8, false],
  ['a2-p11-r3c2', '死戦斧', '小人のランバ', 'far', 10, false],
  ['a2-p11-r3c3', '滅殺斧', '小人のランバ', 'far', 12, true],
  ['a2-p12-r1c1', '破山剣', 'リーア姫', 'near', 4, false],
  ['a2-p12-r1c2', '破砕剣', 'リーア姫', 'far', 5, false],
];

function prepare(cardCase: CardCase, dedicated: boolean) {
  const [, name, owner, range, , mustChant] = cardCase;
  let state = ready();
  character(state, 'A', owner);
  if (range === 'near') {
    state.distances.A!.B = 'near';
    state.distances.B!.A = 'near';
  }
  const card = handCard(state, 'A', name);
  if (mustChant && !(name === '滅殺斧' && dedicated) && !(name === '光竜破山剣' && owner === '聖騎士ランスロット2' && dedicated)) {
    state.players.A!.hand = state.players.A!.hand.filter(id => id !== card);
    state.players.A!.chants.push({ cardInstanceId: card, revealed: false });
  }
  return { state, card };
}

it.each(ordinary)('resolves and consumes Task 7b ordinary %s %s', (id, name, owner, range, damage, chant) => {
  let { state, card } = prepare([id, name, owner, range, damage, chant], false);
  expect(card).toBe(id);
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: card, targetIds: ['B'], dedicated: false });
  state = finish(state);
  expect(state.players.B!.damage).toBe(damage);
  expect(state.discard).toContain(card);
  expect(state.resolution).not.toContain(card);
});

const dedicated = [
  ['死鬼界滅拳', '大神官ジル', 6],
  ['死鬼滅殺拳', '大神官ジル', 10],
  ['天地爆砕剣', '侍大将のシン', 15],
  ['光流弓', '妖精王フューリー', 10],
  ['星流弓', '妖精王フューリー', 13],
  ['狼牙', '餓狼ヨーツルム', 3],
  ['連槍撃', '早駆けのランカスター', 14],
  ['竜殺天空槍', '早駆けのランカスター', 15],
  ['妖撃破山剣', '聖騎士ランスロット', 7],
  ['光竜剣', '聖騎士ランスロット', 10],
  ['光竜剣', '聖騎士ランスロット2', 15],
  ['光竜破山剣', '聖騎士ランスロット', 5],
  ['光竜破山剣', '聖騎士ランスロット2', 25],
  ['撃戦斧', '小人のランバ', 6],
  ['剛戦斧', '小人のランバ', 8],
  ['死戦斧', '小人のランバ', 10],
  ['滅殺斧', '小人のランバ', 20],
  ['破山剣', 'リーア姫', 5],
  ['破山剣', '聖騎士ランスロット', 6],
  ['破山剣', '聖騎士ランスロット2', 6],
] as const;

it.each(dedicated)('applies the selected Task 7b dedicated mode of %s for %s', (name, owner, totalDamage) => {
  const base = ordinary.find(entry => entry[1] === name)!;
  let { state, card } = prepare([base[0], name, owner, base[3], base[4], base[5]], true);
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: card, targetIds: ['B'], dedicated: true });
  expect(Object.values(state.actions!)[0]!.technique.noChecks).toBe(name !== '妖撃破山剣');
  state = finish(state);
  expect(state.players.B!.damage).toBe(totalDamage);
  expect(state.discard.filter(id => id === card)).toHaveLength(1);
});

it.each(ordinary.filter(([, name]) => name !== '破砕剣').map(([, name]) => name))('rejects wrong-owner Task 7b dedicated %s before cost', name => {
  const state = ready();
  character(state, 'A', '黒騎士ガーウィン');
  const card = handCard(state, 'A', name);
  const before = JSON.stringify(state);
  expect(engine.transition(state, { actorId: 'A', command: { type: 'ATTACK', cardInstanceId: card, targetIds: ['B'], dedicated: true } }, entropy())).toEqual({ ok: false, code: 'UNSUPPORTED_CARD' });
  expect(JSON.stringify(state)).toBe(before);
  expect(state.players.A!.hand).toContain(card);
});

it('rejects the unprinted 破砕剣 dedicated mode before cost', () => {
  const state = ready();
  const card = handCard(state, 'A', '破砕剣');
  const before = JSON.stringify(state);
  expect(engine.transition(state, { actorId: 'A', command: { type: 'ATTACK', cardInstanceId: card, targetIds: ['B'], dedicated: true } }, entropy())).toEqual({ ok: false, code: 'UNSUPPORTED_CARD' });
  expect(JSON.stringify(state)).toBe(before);
});

it('enforces 天地爆砕剣 ordinary two-target maximum and dedicated all-target mode before cost', () => {
  let { state, card } = prepare(ordinary.find(entry => entry[1] === '天地爆砕剣')!, false);
  const before = JSON.stringify(state);
  expect(engine.transition(state, { actorId: 'A', command: { type: 'ATTACK', cardInstanceId: card, targetIds: ['B', 'C', 'D'], dedicated: false } }, entropy())).toEqual({ ok: false, code: 'INVALID_TARGET' });
  expect(JSON.stringify(state)).toBe(before);
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: card, targetIds: ['B', 'C'], dedicated: false });
  state = finish(state);
  expect([state.players.B!.damage, state.players.C!.damage, state.players.D!.damage]).toEqual([15, 15, 0]);

  ({ state, card } = prepare(ordinary.find(entry => entry[1] === '天地爆砕剣')!, true));
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: card, targetIds: ['B', 'C', 'D'], dedicated: true });
  state = finish(state);
  expect([state.players.B!.damage, state.players.C!.damage, state.players.D!.damage]).toEqual([15, 15, 15]);
});

it('runs the non-Shin 天地爆砕剣 spirit-minus-two check before ordinary use checks and consumes on failure', () => {
  let state = ready();
  character(state, 'A', '大神官ジル');
  const card = handCard(state, 'A', '天地爆砕剣');
  state.players.A!.hand = state.players.A!.hand.filter(id => id !== card);
  state.players.A!.chants.push({ cardInstanceId: card, revealed: false });
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: card, targetIds: ['B'], dedicated: false });
  state = until(state, 'before-roll');
  expect(engine.viewFor(state,'A').currentRoll).toMatchObject({purpose:'activation',modifier:-2,stage:'before-roll'});
  expect(Object.values(state.actions!)[0]!.checkSpecs).toEqual([{purpose:'excess-level',modifier:0},{purpose:'excess-level',modifier:0}]);
  while (state.windows!.at(-1)!.cursor < state.windows!.at(-1)!.participants.length - 1) state = pass(state);
  state = pass(state, [6, 6]);
  state = finish(state);
  expect(state.players.B!.damage).toBe(0);
  expect(state.discard.filter(id => id === card)).toHaveLength(1);
});

it('freezes one shared dice damage result for all targets and survives JSON replay', () => {
  let { state, card } = prepare(ordinary.find(entry => entry[1] === '光竜破山剣')!, true);
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: card, targetIds: ['B', 'C'], dedicated: true });
  state = until(state, 'damage');
  while (state.windows!.at(-1)!.cursor < state.windows!.at(-1)!.participants.length - 1) state = pass(state);
  const input = { actorId: state.windows!.at(-1)!.participants[state.windows!.at(-1)!.cursor]!, command: { type: 'PASS' as const } };
  const rolled = engine.transition(state, input, { ...entropy(), dice: [2, 3, 4, 5] });
  const replayed = engine.transition(JSON.parse(JSON.stringify(state)), input, { ...entropy(), dice: [2, 3, 4, 5] });
  expect(rolled).toEqual(replayed);
  if (!rolled.ok) throw Error(rolled.code);
  state = rolled.state;
  expect(engine.viewFor(state,'A').currentRoll?.stage).toBe('after-roll');
  state = closeWindow(state);
  const group = Object.values(state.groups!)[0]!;
  expect(group.targets.map(target => target.hits[0]!.damage)).toEqual([15, 15]);
  expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  state = finish(state);
  expect([state.players.B!.damage, state.players.C!.damage]).toEqual([15, 15]);
});

it('keeps printed character damage multipliers local to each target', () => {
  let state = ready();
  character(state, 'A', '妖精王フューリー');
  character(state, 'B', '不死王ガドューラ');
  character(state, 'C', '魔聖母ディア');
  const card = handCard(state, 'A', '光流弓');
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: card, targetIds: ['B', 'C'], dedicated: true });
  state = finish(state);
  expect([state.players.B!.damage, state.players.C!.damage]).toEqual([20, 10]);

  state = ready();
  character(state, 'A', '大神官ジル');
  character(state, 'B', '不死王ガドューラ');
  character(state, 'C', '魔聖母ディア');
  state.distances.A!.B = state.distances.B!.A = 'near';
  const fist = handCard(state, 'A', '死鬼滅殺拳');
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: fist, targetIds: ['B'], dedicated: true });
  state = finish(state);
  expect(state.players.B!.damage).toBe(20);
});

it('supports generic mandatory, optional, and waived chant paths without hiding identity', () => {
  let state = ready();
  character(state, 'A', '妖精王フューリー');
  const star = handCard(state, 'A', '星流弓');
  state = act(state, 'A', { type: 'CHANT', cardInstanceId: star });
  expect(state.players.A!.chants).toEqual([{ cardInstanceId: star, revealed: false }]);

  state = ready();
  character(state, 'A', '早駆けのランカスター');
  const spear = handCard(state, 'A', '竜殺天空槍');
  state = act(state, 'A', { type: 'CHANT', cardInstanceId: spear, dedicated: true });
  expect(state.players.A!.chants).toEqual([{ cardInstanceId: spear, revealed: false }]);

  state = ready();
  character(state, 'A', '聖騎士ランスロット2');
  const sword = handCard(state, 'A', '光竜破山剣');
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: sword, targetIds: ['B'], dedicated: true });
  state = finish(state);
  expect(state.players.B!.damage).toBe(25);

  state = ready();
  character(state, 'A', '小人のランバ');
  const axe = handCard(state, 'A', '滅殺斧');
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: axe, targetIds: ['B'], dedicated: true });
  state = finish(state);
  expect(state.players.B!.damage).toBe(20);
});

it('rejects optional chant for a wrong owner and noChecks never waives a required chant', () => {
  let state = ready();
  let card = handCard(state, 'A', '竜殺天空槍');
  let before = JSON.stringify(state);
  expect(engine.transition(state, { actorId: 'A', command: { type: 'CHANT', cardInstanceId: card, dedicated: true } }, entropy())).toEqual({ ok: false, code: 'UNSUPPORTED_CARD' });
  expect(JSON.stringify(state)).toBe(before);

  state = ready();
  character(state, 'A', '妖精王フューリー');
  card = handCard(state, 'A', '星流弓');
  before = JSON.stringify(state);
  expect(engine.transition(state, { actorId: 'A', command: { type: 'ATTACK', cardInstanceId: card, targetIds: ['B'], dedicated: true } }, entropy())).toEqual({ ok: false, code: 'CHANT_REQUIRED' });
  expect(JSON.stringify(state)).toBe(before);
});

it('doubles only a selected dedicated 竜殺天空槍 that used optional chant', () => {
  let state = ready();
  character(state, 'A', '早駆けのランカスター');
  const card = handCard(state, 'A', '竜殺天空槍');
  state.players.A!.hand = state.players.A!.hand.filter(id => id !== card);
  state.players.A!.chants.push({ cardInstanceId: card, revealed: false });
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: card, targetIds: ['B', 'C'], dedicated: true });
  state = finish(state);
  expect([state.players.B!.damage, state.players.C!.damage]).toEqual([30, 30]);
});

it('uses fixed threshold, dynamic threshold, and attribute-and-threshold follower destruction', () => {
  let state = ready();
  character(state, 'A', '小人のランバ');
  state.distances.A!.B = state.distances.B!.A = 'near';
  const axe = handCard(state, 'A', '撃戦斧');
  const knight = handCard(state, 'B', '王立騎士団');
  state.players.B!.hand = state.players.B!.hand.filter(id => id !== knight);
  state.players.B!.followers = [{ cardInstanceId: knight, revealed: false }];
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: axe, targetIds: ['B'], dedicated: true });
  state = finish(state);
  expect(state.discard).toContain(knight);
  expect(state.players.B!.damage).toBe(6);

  state = ready();
  character(state, 'A', '妖精王フューリー');
  const star = handCard(state, 'A', '星流弓');
  const guardian = handCard(state, 'B', '守護者');
  state.players.A!.hand = state.players.A!.hand.filter(id => id !== star);
  state.players.A!.chants.push({ cardInstanceId: star, revealed: false });
  state.players.B!.hand = state.players.B!.hand.filter(id => id !== guardian);
  state.players.B!.followers = [{ cardInstanceId: guardian, revealed: false }];
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: star, targetIds: ['B'], dedicated: true });
  state = finish(state);
  expect(state.discard).toContain(guardian);
  expect(state.players.B!.damage).toBe(13);

  state = ready();
  character(state, 'A', 'リーア姫');
  state.distances.A!.B = state.distances.B!.A = 'near';
  const mountain = handCard(state, 'A', '破山剣');
  const skeleton = handCard(state, 'B', 'スケルトン');
  const metal = handCard(state, 'B', 'メタルゴーレム');
  state.players.B!.hand = state.players.B!.hand.filter(id => id !== skeleton && id !== metal);
  state.players.B!.followers = [{ cardInstanceId: skeleton, revealed: false }, { cardInstanceId: metal, revealed: false }];
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: mountain, targetIds: ['B'], dedicated: false });
  state = finish(state);
  expect(state.discard).toContain(skeleton);
  expect(state.players.B!.followers).toEqual([{ cardInstanceId: metal, revealed: true }]);
});

it('stops before a matching rear follower when an adequate nonmatching front follower blocks the attack', () => {
  let state = ready();
  character(state, 'A', '妖精王フューリー');
  const card = handCard(state, 'A', '光流弓');
  const front = handCard(state, 'B', '守護者');
  const rear = handCard(state, 'B', 'スケルトン');
  state.players.B!.hand = state.players.B!.hand.filter(id => id !== front && id !== rear);
  state.players.B!.followers = [{ cardInstanceId: front, revealed: false }, { cardInstanceId: rear, revealed: false }];
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: card, targetIds: ['B'], dedicated: false });
  state = finish(state);
  expect(state.players.B!.damage).toBe(0);
  expect(state.players.B!.followers).toEqual([{ cardInstanceId: front, revealed: true }, { cardInstanceId: rear, revealed: false }]);
  expect(state.discard).not.toContain(rear);
});

it('lets one adequate front follower block every fixed hit without revealing the rear follower', () => {
  let state = ready();
  character(state, 'A', '早駆けのランカスター');
  const card = handCard(state, 'A', '連槍撃');
  const front = handCard(state, 'B', 'メタルゴーレム');
  const rear = handCard(state, 'B', '王立騎士団');
  state.players.B!.hand = state.players.B!.hand.filter(id => id !== front && id !== rear);
  state.players.B!.followers = [{ cardInstanceId: front, revealed: false }, { cardInstanceId: rear, revealed: false }];
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: card, targetIds: ['B'], dedicated: true });
  state = finish(state);
  expect(state.players.B!.damage).toBe(0);
  expect(state.players.B!.followers).toEqual([{ cardInstanceId: front, revealed: true }, { cardInstanceId: rear, revealed: false }]);
});

it('subtracts lower-front HP from each fixed hit before the rear follower blocks both', () => {
  let state = ready();
  character(state, 'A', '早駆けのランカスター');
  const card = handCard(state, 'A', '連槍撃');
  const front = handCard(state, 'B', '兵士');
  const rear = handCard(state, 'B', 'メタルゴーレム');
  state.players.B!.hand = state.players.B!.hand.filter(id => id !== front && id !== rear);
  state.players.B!.followers = [{ cardInstanceId: front, revealed: false }, { cardInstanceId: rear, revealed: false }];
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: card, targetIds: ['B'], dedicated: true });
  state = until(state, 'follower-start');
  state = finish(state);
  expect(state.players.B!.damage).toBe(0);
  expect(state.discard).toContain(front);
  expect(state.players.B!.followers).toEqual([{ cardInstanceId: rear, revealed: true }]);
});

it('qualifies only dedicated 天地爆砕剣 as a counter and keeps its mandatory chant', () => {
  const scenario = (dedicatedMode: boolean) => {
    let state = ready();
    character(state, 'B', '侍大将のシン');
    const attack = handCard(state, 'A', '破砕剣');
    const counter = handCard(state, 'B', '天地爆砕剣');
    state.players.B!.hand = state.players.B!.hand.filter(id => id !== counter);
    state.players.B!.chants = [{ cardInstanceId: counter, revealed: false }];
    state = act(state, 'A', { type: 'ATTACK', cardInstanceId: attack, targetIds: ['B'], dedicated: false });
    state = until(state, 'normal-defense');
    return { state, counter };
  };
  let { state, counter } = scenario(false);
  const before = JSON.stringify(state);
  expect(engine.transition(state, { actorId: 'B', command: { type: 'PLAY_DEFENSE', cardInstanceId: counter, dedicated: false } }, entropy())).toEqual({ ok: false, code: 'ILLEGAL_DEFENSE' });
  expect(JSON.stringify(state)).toBe(before);

  ({ state, counter } = scenario(true));
  state = act(state, 'B', { type: 'PLAY_DEFENSE', cardInstanceId: counter, dedicated: true });
  state = finish(state);
  expect(state.players.B!.damage).toBe(0);
  expect(state.players.A!.damage).toBe(15);
});

it('uses ordinary and dedicated 妖撃破山剣 counter values and waives checks only while countering', () => {
  for (const [dedicatedMode, damage] of [[false, 4], [true, 7]] as const) {
    let state = ready();
    character(state, 'B', '聖騎士ランスロット');
    state.distances.A!.B = state.distances.B!.A = 'near';
    const attack = handCard(state, 'A', '破山剣');
    const counter = handCard(state, 'B', '妖撃破山剣');
    state = act(state, 'A', { type: 'ATTACK', cardInstanceId: attack, targetIds: ['B'], dedicated: false });
    state = until(state, 'normal-defense');
    state = act(state, 'B', { type: 'PLAY_DEFENSE', cardInstanceId: counter, dedicated: dedicatedMode });
    expect(Object.values(state.actions!).find(action => action.cardInstanceId === counter)!.checks).toEqual([]);
    state = finish(state);
    expect(state.players.B!.damage).toBe(0);
    expect(state.players.A!.damage).toBe(damage);
  }
});

it.each([
  ['狼牙', '餓狼ヨーツルム', false, [2, 5], 7],
  ['狼牙', '餓狼ヨーツルム', true, [2, 3, 5], 10],
] as const)('freezes %s dice damage at the damage window for dedicated=%s', (name, owner, dedicatedMode, dice, damage) => {
  let state = ready();
  character(state, 'A', owner);
  if (!dedicatedMode) state.distances.A!.B = state.distances.B!.A = 'near';
  const card = handCard(state, 'A', name);
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: card, targetIds: ['B'], dedicated: dedicatedMode });
  state = until(state, 'damage');
  expect(Object.values(state.actions!)[0]!.technique.damage).toBeNull();
  while (state.windows!.at(-1)!.cursor < state.windows!.at(-1)!.participants.length - 1) state = pass(state);
  state = pass(state, [...dice]);
  state = closeWindow(state);
  expect(Object.values(state.groups!)[0]!.targets[0]!.hits[0]!.damage).toBe(damage);
  state = finish(state);
  expect(state.players.B!.damage).toBe(damage);
});

it('destroys all followers that receive ordinary 竜殺天空槍 before level defense', () => {
  let state = ready();
  character(state, 'A', '早駆けのランカスター');
  const card = handCard(state, 'A', '竜殺天空槍');
  const guardian = handCard(state, 'B', '守護者');
  const skeleton = handCard(state, 'B', 'スケルトン');
  state.players.B!.hand = state.players.B!.hand.filter(id => id !== guardian && id !== skeleton);
  state.players.B!.followers = [{ cardInstanceId: guardian, revealed: false }, { cardInstanceId: skeleton, revealed: false }];
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: card, targetIds: ['B'], dedicated: false });
  state = finish(state);
  expect(state.players.B!.followers).toEqual([]);
  expect(state.discard).toEqual(expect.arrayContaining([guardian, skeleton, card]));
  expect(state.players.B!.damage).toBe(10);
});

it('keeps mandatory white restriction and cancels a new technique while consuming each physical card once', () => {
  let state = ready();
  character(state, 'A', '不死王ガドューラ');
  state.distances.A!.B = state.distances.B!.A = 'near';
  let card = handCard(state, 'A', '死鬼界滅拳');
  let before = JSON.stringify(state);
  expect(engine.transition(state, { actorId: 'A', command: { type: 'ATTACK', cardInstanceId: card, targetIds: ['B'], dedicated: false } }, entropy())).toEqual({ ok: false, code: 'UNSUPPORTED_CARD' });
  expect(JSON.stringify(state)).toBe(before);

  state = ready();
  card = handCard(state, 'A', '破砕剣');
  const cancel = handCard(state, 'C', '命運凶変');
  while (state.players.C!.hand.length > 5) {
    const index = state.players.C!.hand.findIndex(id => id !== cancel);
    state.deck.push(state.players.C!.hand.splice(index, 1)[0]!);
  }
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: card, targetIds: ['B'], dedicated: false });
  state = act(state, 'A', { type: 'PASS' });
  state = act(state, 'B', { type: 'PASS' });
  const actionId = Object.keys(state.actions!)[0]!;
  state = act(state, 'C', { type: 'PLAY_REACTION', cardInstanceId: cancel, mode: 'cancel', targetActionId: actionId });
  state = finish(state);
  expect(state.players.B!.damage).toBe(0);
  expect(state.discard.filter(id => id === card)).toHaveLength(1);
  expect(state.discard.filter(id => id === cancel)).toHaveLength(1);
  expect(engine.allCardInstanceIds(state)).toHaveLength(220);
  expect(new Set(engine.allCardInstanceIds(state)).size).toBe(220);
});

it.each([
  ['one-hit', 1, 7],
  ['two-hit', 2, 14],
] as const)('lets dedicated 連槍撃 explicitly choose %s while retaining its dedicated package', (techniqueVariant, hitCount, totalDamage) => {
  let state = ready();
  character(state, 'A', '早駆けのランカスター');
  const card = handCard(state, 'A', '連槍撃');
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: card, targetIds: ['B'], dedicated: true, techniqueVariant });
  const action = Object.values(state.actions!)[0]!;
  expect(action.technique).toMatchObject({ effectLevel: 5, damage: 7, noChecks: true, hitCount });
  state = finish(state);
  expect(state.players.B!.damage).toBe(totalDamage);
  expect(state.discard.filter(id => id === card)).toHaveLength(1);
});

it.each([
  ['one-hit', '破砕剣', '早駆けのランカスター', true],
  ['lancelot-1', '連槍撃', '早駆けのランカスター', true],
  ['one-hit', '連槍撃', '早駆けのランカスター', false],
  ['lancelot-2', '光竜剣', '聖騎士ランスロット', true],
] as const)('rejects mismatched printed variant %s on %s before cost', (techniqueVariant, name, owner, dedicatedMode) => {
  const state = ready();
  character(state, 'A', owner);
  const card = handCard(state, 'A', name);
  const before = JSON.stringify(state);
  expect(engine.transition(state, { actorId: 'A', command: { type: 'ATTACK', cardInstanceId: card, targetIds: ['B'], dedicated: dedicatedMode, techniqueVariant } }, entropy())).toEqual({ ok: false, code: 'UNSUPPORTED_CARD' });
  expect(JSON.stringify(state)).toBe(before);
  expect(state.players.A!.hand).toContain(card);
});

it.each([
  ['光竜剣', false, undefined, false, 6],
  ['光竜剣', true, 'lancelot-1', false, 10],
  ['光竜剣', true, 'lancelot-2', false, 15],
  ['光竜破山剣', false, undefined, true, 10],
  ['光竜破山剣', true, 'lancelot-1', true, 5],
  ['光竜破山剣', true, 'lancelot-2', false, 25],
] as const)('lets an existing Lancelot II choose the complete %s package dedicated=%s variant=%s', (name, dedicatedMode, techniqueVariant, chant, damage) => {
  let state = ready();
  character(state, 'A', '聖騎士ランスロット2');
  if (name === '光竜剣') state.distances.A!.B = state.distances.B!.A = 'near';
  const card = handCard(state, 'A', name);
  if (chant) {
    state.players.A!.hand = state.players.A!.hand.filter(id => id !== card);
    state.players.A!.chants = [{ cardInstanceId: card, revealed: false }];
  }
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: card, targetIds: ['B'], dedicated: dedicatedMode, ...(techniqueVariant ? { techniqueVariant } : {}) });
  state = finish(state);
  expect(state.players.B!.damage).toBe(damage);
});

it('keeps inherited and full Lancelot II 光竜破山剣 chant packages indivisible', () => {
  for (const techniqueVariant of ['lancelot-1', 'one-hit'] as const) {
    const state = ready();
    character(state, 'A', '聖騎士ランスロット2');
    const card = handCard(state, 'A', '光竜破山剣');
    const before = JSON.stringify(state);
    const result = engine.transition(state, { actorId: 'A', command: { type: 'ATTACK', cardInstanceId: card, targetIds: ['B'], dedicated: true, techniqueVariant } }, entropy());
    expect(result).toEqual({ ok: false, code: techniqueVariant === 'lancelot-1' ? 'CHANT_REQUIRED' : 'UNSUPPORTED_CARD' });
    expect(JSON.stringify(state)).toBe(before);
    expect(state.players.A!.hand).toContain(card);
  }
});

it.each([
  ['狼牙', '餓狼ヨーツルム', false, '2d6', [2, 5], 0, 7],
  ['狼牙', '餓狼ヨーツルム', true, '3d6', [2, 3, 5], 0, 10],
  ['光竜破山剣', '聖騎士ランスロット', true, '4d6+1', [2, 3, 4, 5], 1, 15],
] as const)('retains the exact shared %s damage roll after action cleanup', (name, owner, dedicatedMode, formula, faces, modifier, total) => {
  let state = ready();
  character(state, 'A', owner);
  if (name === '狼牙' && !dedicatedMode) state.distances.A!.B = state.distances.B!.A = 'near';
  const card = handCard(state, 'A', name);
  if (name === '光竜破山剣') {
    state.players.A!.hand = state.players.A!.hand.filter(id => id !== card);
    state.players.A!.chants = [{ cardInstanceId: card, revealed: false }];
  }
  const targetIds = name === '光竜破山剣' ? ['B', 'C'] : ['B'];
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: card, targetIds, dedicated: dedicatedMode });
  const action = Object.values(state.actions!)[0]!;
  const actionId = action.id;
  const eventId = action.eventId;
  state = until(state, 'damage');
  while (state.windows!.at(-1)!.cursor < state.windows!.at(-1)!.participants.length - 1) state = pass(state);
  state = pass(state, [...faces]);
  state = closeWindow(state);
  const group = Object.values(state.groups!)[0]!;
  const rollRecord = state.randomRolls!.at(-1)!;
  expect(rollRecord).toEqual({ id: `roll-${actionId}-damage`, eventId, actionId, kind: 'damage', formula, faces: [...faces], modifier, total });
  expect(group.damageRollId).toBe(rollRecord.id);
  expect(group.targets.flatMap(target => target.hits.map(hit => hit.damageRollId))).toEqual(Array(group.targets.length * group.hitIndices.length).fill(rollRecord.id));
  expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  state = finish(state);
  expect(state.actions).toEqual({});
  expect(state.groups).toEqual({});
  expect(state.randomRolls!.at(-1)).toEqual(rollRecord);
  expect(JSON.parse(JSON.stringify(state))).toEqual(state);
});
