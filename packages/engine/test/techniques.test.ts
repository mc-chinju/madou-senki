import {discardIds, moveToDiscard } from '../src/index.js';
import {passReclaims} from './combat-helpers.js';
import { expect, it } from 'vitest';
import * as engine from '../src/index.js';
import { act, finish, pass, ready, until } from './combat-helpers.js';
import { character, entropy, handCard, handCards } from './fixtures.js';

const ordinary = [
  ['a2-p07-r3c3', '黒流弓', '黒妖精のアーネス', 'far', 5, 10],
  ['a2-p08-r1c1', '黒翼飛翔剣', '黒妖精のアーネス', 'far', 5, 7],
  ['a2-p08-r1c3', '風斬剣', '竜皇子アスフェルト', 'far', 4, 6],
  ['a2-p08-r2c1', '雷斬剣', '竜皇子アスフェルト', 'far', 5, 7],
  ['a2-p08-r2c2', '裂風斬', '竜皇子アスフェルト', 'far', 6, 8],
  ['a2-p08-r3c3', '気斬', '忍びのイダ', 'far', 6, 8],
  ['a2-p09-r1c2', '破黒剣', '黒騎士ガーウィン', 'near', 4, 5],
  ['a2-p09-r3c2', '気破', '大神官ジル', 'near', 4, 14],
  ['a2-p09-r3c3', '死鬼旋風脚', '大神官ジル', 'near', 6, 6],
] as const;

it.each(ordinary)('resolves and consumes the ordinary printed technique %s %s', (physicalId, name, owner, range, effectLevel, damage) => {
  let state = ready();
  character(state, 'A', owner);
  if (range === 'near') {
    state.distances.A!.B = 'near';
    state.distances.B!.A = 'near';
  }
  const card = handCard(state, 'A', name);
  expect(card).toBe(physicalId);
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: card, targetIds: ['B'], dedicated: false });
  const action = Object.values(state.actions!)[0]!;
  expect(action.technique.effectLevel).toBe(effectLevel);
  state = finish(state);
  expect(state.players.B!.damage).toBe(damage);
  expect(discardIds(state)).toContain(card);
  expect(state.resolution).not.toContain(card);
});

const dedicated = [
  ['黒流弓', '黒妖精のアーネス', ['B', 'C'], 5, 10],
  ['黒翼飛翔剣', '黒妖精のアーネス', ['B'], 6, 10],
  ['風斬剣', '竜皇子アスフェルト', ['B', 'C'], 6, 12],
  ['雷斬剣', '竜皇子アスフェルト', ['B', 'C'], 7, 14],
  ['裂風斬', '竜皇子アスフェルト', ['B', 'C'], 8, 16],
  ['気斬', '忍びのイダ', ['B'], 7, 16],
  ['破黒剣', '黒騎士ガーウィン', ['B'], 5, 7],
  ['気破', '大神官ジル', ['B'], 4, 14],
  ['死鬼旋風脚', '大神官ジル', ['B'], 6, 6],
] as const;

it.each(dedicated)('applies the optional dedicated section of %s only when selected', (name, owner, targets, effectLevel, damage) => {
  let state = ready();
  character(state, 'A', owner);
  if (name === '破黒剣' || name === '気破' || name === '死鬼旋風脚') {
    for (const target of targets) {
      state.distances.A![target] = 'near';
      state.distances[target]![`A`] = 'near';
    }
  }
  const card = handCard(state, 'A', name);
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: card, targetIds: [...targets], dedicated: true });
  const action = Object.values(state.actions!)[0]!;
  expect(action.technique.effectLevel).toBe(effectLevel);
  expect(action.technique.noChecks).toBe(true);
  expect(action.checks).toEqual([]);
  state = finish(state);
  for (const target of targets) expect(state.players[target]!.damage).toBe(damage);
  expect(discardIds(state)).toContain(card);
});

it.each(ordinary.map(([, name]) => name))('rejects a wrong-owner dedicated selection for %s without mutation', name => {
  const state = ready();
  const card = handCard(state, 'A', name);
  const before = JSON.stringify(state);
  expect(engine.transition(state, { actorId: 'A', command: { type: 'ATTACK', cardInstanceId: card, targetIds: ['B'], dedicated: true } }, entropy())).toEqual({ ok: false, code: 'UNSUPPORTED_CARD' });
  expect(JSON.stringify(state)).toBe(before);
  expect(state.players.A!.hand).toContain(card);
});

const extraMaaiTechniques = [
  ['黒翼飛翔剣', 'far', 7],
  ['風斬剣', 'far', 6],
  ['裂風斬', 'far', 8],
  ['気破', 'near', 16],
  ['死鬼旋風脚', 'near', 6],
] as const;

it.each(extraMaaiTechniques)('does not evade %s with only one of the required two maai cards', (name, range, damage) => {
  let state = ready();
  if (range === 'near') {
    state.distances.A!.B = 'near';
    state.distances.B!.A = 'near';
  }
  const attack = handCard(state, 'A', name);
  const maai = handCard(state, 'B', '間合い／休息');
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: attack, targetIds: ['B'], dedicated: false });
  state = until(state, 'normal-defense');
  state = passReclaims(act(state, 'B', { type: 'PLAY_MAAI', cardInstanceId: maai }));
  expect(state.windows!.at(-1)).toMatchObject({ kind: 'normal-defense', participants: ['B'] });
  state = act(state, 'B', { type: 'START_FOLLOWERS' });
  expect(state.windows!.at(-1)!.kind).toBe('follower-entry-abilities');
  state=until(state,'follower-start');
  state = finish(state);
  expect(state.players.B!.damage).toBe(damage);
  expect(discardIds(state)).toEqual(expect.arrayContaining([attack, maai]));
});

it('shares each attacker advance across targets and preserves uncancelled maai toward the retry', () => {
  let state = ready();
  character(state, 'A', '竜皇子アスフェルト');
  const attack = handCard(state, 'A', '風斬剣');
  const [bFirst, bSecond, cFirst, cSecond, bRetry, cRetry] = handCards(state, ['B', 'B', 'C', 'C', 'B', 'C'], '間合い／休息');
  const advance = handCard(state, 'A', '踏み込み／蹴る');
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: attack, targetIds: ['B', 'C'], dedicated: true });
  state = until(state, 'normal-defense');
  state = passReclaims(act(state, 'B', { type: 'PLAY_MAAI', cardInstanceId: bFirst }));
  expect(state.windows!.at(-1)!.continuation).toMatchObject({ targetId: 'B' });
  state = passReclaims(act(state, 'B', { type: 'PLAY_MAAI', cardInstanceId: bSecond }));
  expect(state.windows!.at(-1)!.continuation).toMatchObject({ targetId: 'C' });
  state = passReclaims(act(state, 'C', { type: 'PLAY_MAAI', cardInstanceId: cFirst }));
  state = passReclaims(act(state, 'C', { type: 'PLAY_MAAI', cardInstanceId: cSecond }));
  expect(state.windows!.at(-1)!.kind).toBe('defense-advance');
  state = passReclaims(act(state, 'A', { type: 'PLAY_ADVANCE', cardInstanceId: advance }));
  state = act(state, 'A', { type: 'PASS' });
  expect(state.windows!.at(-1)).toMatchObject({ kind: 'normal-defense', continuation: { targetId: 'B' } });
  state = passReclaims(act(state, 'B', { type: 'PLAY_MAAI', cardInstanceId: bRetry }));
  expect(state.windows!.at(-1)!.continuation).toMatchObject({ targetId: 'C' });
  state = passReclaims(act(state, 'C', { type: 'PLAY_MAAI', cardInstanceId: cRetry }));
  state = act(state, 'A', { type: 'PASS' });
  expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  state = finish(state);
  expect(state.players.B!.damage).toBe(0);
  expect(state.players.C!.damage).toBe(0);
  expect(discardIds(state)).toEqual(expect.arrayContaining([bFirst, bSecond, cFirst, cSecond, bRetry, cRetry, advance, attack]));
});

it.each(['雷斬剣', '裂風斬'])('rejects 見切る against %s before consuming the defense', name => {
  let state = ready();
  const attack = handCard(state, 'A', name);
  const evade = handCard(state, 'B', '見切る');
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: attack, targetIds: ['B'], dedicated: false });
  state = until(state, 'normal-defense');
  const before = JSON.stringify(state);
  expect(engine.transition(state, { actorId: 'B', command: { type: 'PLAY_DEFENSE', cardInstanceId: evade, dedicated: false } }, entropy())).toEqual({ ok: false, code: 'ILLEGAL_DEFENSE' });
  expect(JSON.stringify(state)).toBe(before);
  expect(state.players.B!.hand).toContain(evade);
});

it('keeps follower HP bypass distinct from follower bypass and does not silently use Asfelt character powers', () => {
  let hpBypass = ready();
  const wind = handCard(hpBypass, 'A', '風斬剣');
  const fort = handCard(hpBypass, 'B', '砦');
  hpBypass.players.B!.hand = hpBypass.players.B!.hand.filter(id => id !== fort);
  hpBypass.players.B!.followers = [{ cardInstanceId: fort, revealed: false }];
  hpBypass = act(hpBypass, 'A', { type: 'ATTACK', cardInstanceId: wind, targetIds: ['B'], dedicated: false });
  hpBypass = finish(hpBypass);
  expect(hpBypass.players.B!.damage).toBe(6);
  expect(discardIds(hpBypass)).toContain(fort);

  let followerBypass = ready();
  character(followerBypass, 'A', '黒妖精のアーネス');
  const blackBow = handCard(followerBypass, 'A', '黒流弓');
  const guardian = handCard(followerBypass, 'B', '水竜');
  followerBypass.players.B!.hand = followerBypass.players.B!.hand.filter(id => id !== guardian);
  followerBypass.players.B!.followers = [{ cardInstanceId: guardian, revealed: false }];
  followerBypass = act(followerBypass, 'A', { type: 'ATTACK', cardInstanceId: blackBow, targetIds: ['B'], dedicated: true });
  followerBypass = finish(followerBypass);
  expect(followerBypass.players.B!.damage).toBe(10);
  expect(followerBypass.players.B!.followers).toEqual([{ cardInstanceId: guardian, revealed: false }]);

  let optionalPower = ready();
  character(optionalPower, 'A', '竜皇子アスフェルト');
  const thunder = handCard(optionalPower, 'A', '雷斬剣');
  const dragon = handCard(optionalPower, 'B', '飛竜');
  optionalPower.players.B!.hand = optionalPower.players.B!.hand.filter(id => id !== dragon);
  optionalPower.players.B!.followers = [{ cardInstanceId: dragon, revealed: false }];
  optionalPower = act(optionalPower, 'A', { type: 'ATTACK', cardInstanceId: thunder, targetIds: ['B'], dedicated: false });
  optionalPower = finish(optionalPower);
  expect(optionalPower.players.B!.damage).toBe(0);
  expect(optionalPower.players.B!.followers).toEqual([{ cardInstanceId: dragon, revealed: true }]);
});

it.each([
  ['黒翼飛翔剣', '黒妖精のアーネス', true, 10],
  ['気斬', '忍びのイダ', false, 8],
] as const)('%s bypasses even a higher-level follower in its printed mode', (name, owner, dedicatedMode, damage) => {
  let state = ready();
  character(state, 'A', owner);
  const attack = handCard(state, 'A', name);
  const guardian = handCard(state, 'B', '水竜');
  state.players.B!.hand = state.players.B!.hand.filter(id => id !== guardian);
  state.players.B!.followers = [{ cardInstanceId: guardian, revealed: false }];
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: attack, targetIds: ['B'], dedicated: dedicatedMode });
  state = finish(state);
  expect(state.players.B!.damage).toBe(damage);
  expect(state.players.B!.followers).toEqual([{ cardInstanceId: guardian, revealed: false }]);
});

it('keeps 裂風斬 ordinary follower HP bypass while still applying level comparison', () => {
  let state = ready();
  character(state, 'A', '竜皇子アスフェルト');
  const attack = handCard(state, 'A', '裂風斬');
  const fort = handCard(state, 'B', '砦');
  state.players.B!.hand = state.players.B!.hand.filter(id => id !== fort);
  state.players.B!.followers = [{ cardInstanceId: fort, revealed: false }];
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: attack, targetIds: ['B'], dedicated: false });
  state = finish(state);
  expect(state.players.B!.damage).toBe(8);
  expect(discardIds(state)).toContain(fort);
});

it('destroys matching-attribute followers before ordinary level defense', () => {
  let state = ready();
  state.distances.A!.B = 'near';
  state.distances.B!.A = 'near';
  const attack = handCard(state, 'A', '破黒剣');
  const white = handCard(state, 'B', '守護者');
  const soldier = handCard(state, 'B', '兵士');
  state.players.B!.hand = state.players.B!.hand.filter(id => id !== white && id !== soldier);
  state.players.B!.followers = [{ cardInstanceId: white, revealed: false }, { cardInstanceId: soldier, revealed: false }];
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: attack, targetIds: ['B'], dedicated: false });
  state = finish(state);
  expect(state.players.B!.damage).toBe(4);
  expect(state.players.B!.followers).toEqual([]);
  expect(discardIds(state)).toEqual(expect.arrayContaining([white, soldier, attack]));
});

it('destroys every follower at or below the dedicated final effect level across all targets', () => {
  let state = ready();
  character(state, 'A', '竜皇子アスフェルト');
  const attack = handCard(state, 'A', '裂風斬');
  const guardian = handCard(state, 'B', '守護者');
  const fireDragon = handCard(state, 'B', '炎竜');
  const metalGolem = handCard(state, 'C', 'メタルゴーレム');
  state.players.B!.hand = state.players.B!.hand.filter(id => id !== guardian && id !== fireDragon);
  state.players.C!.hand = state.players.C!.hand.filter(id => id !== metalGolem);
  state.players.B!.followers = [{ cardInstanceId: guardian, revealed: false }, { cardInstanceId: fireDragon, revealed: false }];
  state.players.C!.followers = [{ cardInstanceId: metalGolem, revealed: false }];
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: attack, targetIds: ['B', 'C'], dedicated: true });
  state = finish(state);
  expect(state.players.B!.damage).toBe(16);
  expect(state.players.C!.damage).toBe(16);
  expect(state.players.B!.followers).toEqual([]);
  expect(state.players.C!.followers).toEqual([]);
  expect(discardIds(state)).toEqual(expect.arrayContaining([guardian, fireDragon, metalGolem, attack]));
});

it('keeps white followers untouched and unrevealed when maai fully evades 破黒剣', () => {
  let state = ready();
  state.distances.A!.B = 'near';
  state.distances.B!.A = 'near';
  const attack = handCard(state, 'A', '破黒剣');
  const maai = handCard(state, 'B', '間合い／休息');
  const guardian = handCard(state, 'B', '守護者');
  state.players.B!.hand = state.players.B!.hand.filter(id => id !== guardian);
  state.players.B!.followers = [{ cardInstanceId: guardian, revealed: false }];
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: attack, targetIds: ['B'], dedicated: false });
  state = until(state, 'normal-defense');
  state = passReclaims(act(state, 'B', { type: 'PLAY_MAAI', cardInstanceId: maai }));
  state = act(state, 'A', { type: 'PASS' });
  state = finish(state);
  expect(state.players.B!.damage).toBe(0);
  expect(state.players.B!.followers).toEqual([{ cardInstanceId: guardian, revealed: false }]);
  expect(discardIds(state)).toEqual(expect.arrayContaining([attack, maai]));
  expect(discardIds(state)).not.toContain(guardian);
  expect(engine.allCardInstanceIds(state)).toHaveLength(220);
  expect(new Set(engine.allCardInstanceIds(state)).size).toBe(220);
  expect(JSON.parse(JSON.stringify(state))).toEqual(state);
});

it('keeps followers untouched and unrevealed when two maai fully evade dedicated 裂風斬', () => {
  let state = ready();
  character(state, 'A', '竜皇子アスフェルト');
  const attack = handCard(state, 'A', '裂風斬');
  const [firstMaai, secondMaai] = handCards(state, ['B', 'B'], '間合い／休息');
  const fireDragon = handCard(state, 'B', '炎竜');
  state.players.B!.hand = state.players.B!.hand.filter(id => id !== fireDragon);
  state.players.B!.followers = [{ cardInstanceId: fireDragon, revealed: false }];
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: attack, targetIds: ['B'], dedicated: true });
  state = until(state, 'normal-defense');
  state = passReclaims(act(state, 'B', { type: 'PLAY_MAAI', cardInstanceId: firstMaai }));
  state = passReclaims(act(state, 'B', { type: 'PLAY_MAAI', cardInstanceId: secondMaai }));
  state = act(state, 'A', { type: 'PASS' });
  state = finish(state);
  expect(state.players.B!.damage).toBe(0);
  expect(state.players.B!.followers).toEqual([{ cardInstanceId: fireDragon, revealed: false }]);
  expect(discardIds(state)).toEqual(expect.arrayContaining([attack, firstMaai, secondMaai]));
  expect(discardIds(state)).not.toContain(fireDragon);
  expect(engine.allCardInstanceIds(state)).toHaveLength(220);
  expect(new Set(engine.allCardInstanceIds(state)).size).toBe(220);
  expect(JSON.parse(JSON.stringify(state))).toEqual(state);
});

it('skips follower destruction only for the evaded target in a mixed multi-target 裂風斬', () => {
  let state = ready();
  character(state, 'A', '竜皇子アスフェルト');
  const attack = handCard(state, 'A', '裂風斬');
  const [firstMaai, secondMaai] = handCards(state, ['B', 'B'], '間合い／休息');
  const bGuardian = handCard(state, 'B', '守護者');
  const cGolem = handCard(state, 'C', 'メタルゴーレム');
  state.players.B!.hand = state.players.B!.hand.filter(id => id !== bGuardian);
  state.players.C!.hand = state.players.C!.hand.filter(id => id !== cGolem);
  state.players.B!.followers = [{ cardInstanceId: bGuardian, revealed: false }];
  state.players.C!.followers = [{ cardInstanceId: cGolem, revealed: false }];
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: attack, targetIds: ['B', 'C'], dedicated: true });
  state = until(state, 'normal-defense');
  state = passReclaims(act(state, 'B', { type: 'PLAY_MAAI', cardInstanceId: firstMaai }));
  state = passReclaims(act(state, 'B', { type: 'PLAY_MAAI', cardInstanceId: secondMaai }));
  expect(state.windows!.at(-1)!.continuation).toMatchObject({ targetId: 'C' });
  state = act(state, 'C', { type: 'START_FOLLOWERS' });
  state = act(state, 'A', { type: 'PASS' });
  state = finish(state);
  expect(state.players.B!.damage).toBe(0);
  expect(state.players.B!.followers).toEqual([{ cardInstanceId: bGuardian, revealed: false }]);
  expect(state.players.C!.damage).toBe(16);
  expect(state.players.C!.followers).toEqual([]);
  expect(discardIds(state)).toEqual(expect.arrayContaining([attack, firstMaai, secondMaai, cGolem]));
  expect(discardIds(state)).not.toContain(bGuardian);
  expect(engine.allCardInstanceIds(state)).toHaveLength(220);
  expect(new Set(engine.allCardInstanceIds(state)).size).toBe(220);
  expect(JSON.parse(JSON.stringify(state))).toEqual(state);
});

it('freezes spirit-based damage when the damage window closes', () => {
  let state = ready();
  character(state, 'A', '忍びのイダ');
  const attack = handCard(state, 'A', '気斬');
  const charm = handCard(state, 'A', '悪の魅力');
  state.players.A!.hand = state.players.A!.hand.filter(id => id !== charm);
  state.players.A!.attachments.push(charm);
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: attack, targetIds: ['B'], dedicated: false });
  state = until(state, 'damage');
  expect(Object.values(state.actions!)[0]!.technique.damage).toBeNull();
  state = until(state, 'normal-defense');
  expect(Object.values(state.groups!)[0]!.targets[0]!.hits[0]!.damage).toBe(9);
  state.players.A!.attachments = state.players.A!.attachments.filter(id => id !== charm);
  moveToDiscard(state,charm,{faceUp:true});
  expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  state = finish(state);
  expect(state.players.B!.damage).toBe(9);
});

it('records 気破 dedicated Gadyura immunity exception and applies the snapshotted damage', () => {
  let state = ready();
  character(state, 'A', '大神官ジル');
  character(state, 'B', '不死王ガドューラ');
  state.distances.A!.B = 'near';
  state.distances.B!.A = 'near';
  const attack = handCard(state, 'A', '気破');
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: attack, targetIds: ['B'], dedicated: true });
  expect(Object.values(state.actions!)[0]!.technique.characterImmunityExceptions).toEqual([
    { characterName: '不死王ガドューラ', immunity: 'spirit-techniques' },
  ]);
  state = finish(state);
  expect(state.players.B!.damage).toBe(14);
});

it('enforces Gadyura mandatory white-technique restriction before spending 気破', () => {
  const state = ready();
  character(state, 'A', '不死王ガドューラ');
  state.distances.A!.B = 'near';
  state.distances.B!.A = 'near';
  const attack = handCard(state, 'A', '気破');
  const before = JSON.stringify(state);
  expect(engine.transition(state, { actorId: 'A', command: { type: 'ATTACK', cardInstanceId: attack, targetIds: ['B'], dedicated: false } }, entropy())).toEqual({ ok: false, code: 'UNSUPPORTED_CARD' });
  expect(JSON.stringify(state)).toBe(before);
  expect(state.players.A!.hand).toContain(attack);
});
