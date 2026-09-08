import { reset } from 'cloudflare:test';
import { afterEach, expect, it } from 'vitest';
import { activeWindowRef, allCardInstanceIds, transition, viewFor, type GameCommand, type GameState } from '@madou/engine';
import { makeTechniqueValueScenario, type TechniqueValueScenarioName } from './fixtures/technique-value-scenarios.js';
import { entropy } from './fixtures/scenario-tools.js';
import { openTestRoom } from './fixtures/recovery-room.js';

afterEach(async () => { await reset(); });
const cases = [
  { fixture: 'value-staff', ability: 'c2-p01-r1c1-ab02', name: '賢者の杖', effect: 6, damage: 6, baseEffect: 5, baseDamage: 6, window: 'effect-level' },
  { fixture: 'value-fist', ability: 'c2-p01-r1c2-ab02', name: '鉄拳', effect: 6, damage: 3, baseEffect: 5, baseDamage: 2, window: 'effect-level' },
  { fixture: 'value-spirit', ability: 'c2-p01-r2c1-ab03', name: '気合い', effect: 6, damage: 7, baseEffect: 5, baseDamage: 7, window: 'effect-level' },
  { fixture: 'value-axe', ability: 'c2-p03-r1c1-ab03', name: '斧使い', effect: 5, damage: 14, baseEffect: 5, baseDamage: 7, window: 'damage' },
  { fixture: 'value-black-magic', ability: 'c2-p05-r1c1-ab02', name: '破壊神の力', effect: 5, damage: 5, baseEffect: 4, baseDamage: 5, window: 'effect-level' },
] as const;
function source(name: TechniqueValueScenarioName) {
  let game = makeTechniqueValueScenario(name, ['A', 'B', 'C', 'D'].map(id => ({ id, name: id })));
  function act(actorId: string, command: GameCommand, dice = Array(100).fill(1) as number[]) {
    const input = { actorId, command }; const random = { ...entropy(), dice };
    const result = transition(game, input, random); expect(result.ok).toBe(true); if (!result.ok) throw Error(result.code);
    expect(transition(JSON.parse(JSON.stringify(game)), input, random)).toEqual(result); game = result.state;
    expect(allCardInstanceIds(game)).toHaveLength(220); expect(new Set(allCardInstanceIds(game)).size).toBe(220);
  }
  function until(done: (game: GameState) => boolean, dice = Array(100).fill(1) as number[]) {
    for (let i = 0; i < 500; i++) {
      if (done(game)) return;
      const window = game.windows?.at(-1); if (!window) throw Error('VALUE_WINDOW_MISSING');
      act(window.participants[window.cursor]!, { type: 'PASS' }, dice);
    }
    throw Error('VALUE_WINDOW_NOT_REACHED');
  }
  function use(abilityId: string) {
    until(game => viewFor(game, 'A').abilityOptions.some(option => option.abilityId === abilityId));
    const offer = viewFor(game, 'A').abilityOptions.find(option => option.abilityId === abilityId)!;
    act('A', { type: 'USE_ABILITY', abilityId, targetEventId: offer.targetEventId }); return offer.targetEventId;
  }
  return { get game() { return game; }, act, until, use };
}
for (const selected of [false, true]) it.each(cases)('$fixture selected=' + selected + ' keeps usage separate and applies only explicit modifiers', entry => {
  const f = source(entry.fixture); const original = viewFor(f.game, 'A').currentAction!;
  expect(original.source).toBe('card'); if (original.source === 'ability') throw Error('NOT_CARD');
  const useLevel = original.technique.useLevel;
  f.until(game => game.windows?.at(-1)?.kind === entry.window && game.windows.at(-1)?.participants[game.windows.at(-1)!.cursor] === 'A');
  expect(viewFor(f.game, 'A').abilityOptions.map(option => option.abilityId)).toContain(entry.ability);
  const event = selected ? f.use(entry.ability) : viewFor(f.game, 'A').abilityOptions.find(option => option.abilityId === entry.ability)!.targetEventId;
  if (selected) {
    expect(viewFor(f.game, 'A').currentAction).toMatchObject({ source: 'ability', abilityId: entry.ability, abilityName: entry.name, label: entry.name });
    const other = viewFor(f.game, 'B');
    expect(other.currentAction).toMatchObject({ source: 'ability', label: '特殊能力' });
    expect(other.currentAction).not.toHaveProperty('abilityId'); expect(other.currentAction).not.toHaveProperty('abilityName'); expect(other.currentAction).not.toHaveProperty('name');
    const serializedOther = JSON.stringify(other);
    expect(serializedOther).not.toContain(entry.ability); expect(serializedOther).not.toContain(entry.name);
    expect(other.actionCalculation).toMatchObject({ actionId: original.actionId, cardInstanceId: original.cardInstanceId });
    expect(serializedOther).toContain(original.cardInstanceId);
  }
  f.until(game => game.windows?.at(-1)?.kind === 'normal-defense');
  const view = viewFor(f.game, 'B');
  expect(view.currentAction).toMatchObject({ technique: { useLevel, effectLevel: selected ? entry.effect : entry.baseEffect, damage: selected ? entry.damage : entry.baseDamage,
    calculation: { effectLevel: 'final', damage: 'final' } } });
  expect(viewFor(f.game, 'A').abilityOptions.map(option => option.abilityId)).not.toContain(entry.ability);
  const before = structuredClone(f.game);
  expect(transition(f.game, { actorId: 'A', command: { type: 'USE_ABILITY', abilityId: entry.ability, targetEventId: event } }, entropy())).toMatchObject({ ok: false, code: 'ABILITY_DISABLED' });
  expect(f.game).toEqual(before);
  f.until(game => !game.windows?.length);
  expect(f.game.players.B!.damage).toBe(selected ? entry.damage : entry.baseDamage);
});
it.each([false, true])('Prayer before Fist=%s preserves replacement-before-addition and separate native/bonus dice', prayerFirst => {
  const f = source('value-fist'); const parentId = viewFor(f.game, 'A').currentAction!.actionId;
  const pray = () => {
    f.until(game => game.windows?.at(-1)?.kind === 'effect-level' && viewFor(game, 'C').activeWindow?.pendingActorId === 'C');
    f.act('C', { type: 'PLAY_REACTION', cardInstanceId: 'a2-p05-r2c3', mode: 'effect-plus', targetActionId: parentId, dedicated: true });
    f.until(game => game.windows?.at(-1)?.kind === 'effect-level');
  };
  if (prayerFirst) pray();
  f.use('c2-p01-r1c2-ab02');
  if (!prayerFirst) pray();
  f.until(game => game.windows?.at(-1)?.kind === 'damage');
  expect(viewFor(f.game, 'A').currentAction).toMatchObject({ technique: { useLevel: 5, effectLevel: 7, calculation: { effectLevel: 'final', damage: 'pending' } } });
  f.until(game => viewFor(game, 'A').currentRoll?.purpose === 'attack-damage', [2, 3]);
  const native = viewFor(f.game, 'A').currentRoll!; expect(native.faces).toEqual([2, 3]);
  f.until(game => viewFor(game, 'A').currentRoll?.purpose === 'ability-value', [4]);
  const bonus = viewFor(f.game, 'A').currentRoll!; expect(bonus.faces).toEqual([4]); expect(bonus.rollId).not.toBe(native.rollId);
  f.until(game => !game.windows?.length);
  expect(f.game.players.B!.damage).toBe(9);
});
it('canceling Shin keeps the ability attempt spent while the original attack continues unchanged', () => {
  const f = source('value-spirit'); f.use('c2-p01-r2c1-ab03');
  f.until(game => !!viewFor(game, 'C').reactionTargetAbilityId && viewFor(game, 'C').activeWindow?.pendingActorId === 'C');
  f.act('C', { type: 'PLAY_REACTION', cardInstanceId: 'a2-p02-r2c3', mode: 'cancel-ability', targetAbilityId: viewFor(f.game, 'C').reactionTargetAbilityId! });
  f.until(game => game.windows?.at(-1)?.kind === 'effect-level');
  expect(viewFor(f.game, 'A').abilityOptions.map(option => option.abilityId)).not.toContain('c2-p01-r2c1-ab03');
  f.until(game => game.windows?.at(-1)?.kind === 'normal-defense');
  expect(viewFor(f.game, 'A').currentAction).toMatchObject({ technique: { effectLevel: 5, damage: 7 } });
  expect(f.game.rolls?.some(roll => roll.purpose === 'ability-check') ?? false).toBe(false);
  f.until(game => !game.windows?.length); expect(f.game.players.B!.damage).toBe(7); expect(f.game.discard).toContain('a2-p02-r2c3');
});

async function savedRoom(name: TechniqueValueScenarioName) {
  const room = await openTestRoom(name); let sequence = 0;
  async function send(actorId: string, command: GameCommand) {
    const before = await room.stored();
    const envelope = { protocolVersion: 1 as const, commandId: `value-${sequence++}`, expectedRevision: before.revision, ...activeWindowRef(before.state.game!), command };
    const ack = await room.command(actorId, envelope); expect(ack).toMatchObject({ type: 'ack' });
    return { actorId, envelope, ack };
  }
  async function advance(done: (game: GameState) => boolean) {
    let last: Awaited<ReturnType<typeof send>> | undefined;
    for (let i = 0; i < 500; i++) {
      const game = (await room.stored()).state.game!;
      if (done(game)) return last;
      const window = game.windows?.at(-1); if (!window) throw Error('VALUE_DO_WINDOW_MISSING');
      last = await send(window.participants[window.cursor]!, { type: 'PASS' });
    }
    throw Error('VALUE_DO_NOT_REACHED');
  }
  async function use(abilityId: string) {
    await advance(game => viewFor(game, 'A').abilityOptions.some(option => option.abilityId === abilityId));
    const game = (await room.stored()).state.game!;
    const offer = viewFor(game, 'A').abilityOptions.find(option => option.abilityId === abilityId)!;
    return send('A', { type: 'USE_ABILITY', abilityId, targetEventId: offer.targetEventId });
  }
  async function replay(receipt: Awaited<ReturnType<typeof send>>) {
    const before = await room.stored(); await room.restart();
    expect(await room.command(receipt.actorId, receipt.envelope)).toEqual(receipt.ack);
    expect(await room.stored()).toEqual(before);
  }
  return { ...room, send, advance, use, replay };
}
it('DO eviction and old receipts preserve the two independent Fist damage rolls and finalized parent values', async () => {
  const room = await savedRoom('value-fist'); const accepted = await room.use('c2-p01-r1c2-ab02'); await room.replay(accepted);
  await room.advance(game => viewFor(game, 'A').currentRoll?.purpose === 'attack-damage');
  const native = viewFor((await room.stored()).state.game!, 'A').currentRoll!;
  expect(native.formula).toBe('2d6'); expect(native.faces).toHaveLength(2);
  const bonusReceipt = await room.advance(game => viewFor(game, 'A').currentRoll?.purpose === 'ability-value');
  expect(bonusReceipt).toBeTruthy(); await room.replay(bonusReceipt!);
  const pending = (await room.stored()).state.game!; const bonus = viewFor(pending, 'A').currentRoll!;
  expect(bonus.formula).toBe('d6'); expect(bonus.faces).toHaveLength(1); expect(bonus.rollId).not.toBe(native.rollId);
  const other = (await room.snapshotFor('B')).game!;
  expect(other.actionCalculation).toMatchObject({ cardInstanceId: 'a2-p10-r3c1', effectLevel: 6, calculation: { effectLevel: 'final', damage: 'pending' } });
  expect(JSON.stringify(other)).not.toContain('c2-p01-r1c2');
  await room.advance(game => viewFor(game, 'A').activeWindow?.kind === 'normal-defense');
  const final = (await room.stored()).state.game!; const total = native.total! + bonus.total!;
  expect(viewFor(final, 'A').currentAction).toMatchObject({ technique: { useLevel: 5, effectLevel: 6, damage: total, calculation: { effectLevel: 'final', damage: 'final' } } });
  await room.replay(bonusReceipt!); await room.replay(accepted);
  await room.advance(game => !game.windows?.length);
  const done = (await room.stored()).state.game!; expect(done.players.B!.damage).toBe(total);
  expect(allCardInstanceIds(done)).toHaveLength(220); expect(new Set(allCardInstanceIds(done)).size).toBe(220);
});
it('DO preserves an actual Shin forced-failure child and resumes without a bonus after receipt replay', async () => {
  const room = await savedRoom('value-spirit'); await room.use('c2-p01-r2c1-ab03');
  await room.advance(game => viewFor(game, 'C').currentRoll?.purpose === 'ability-check' && viewFor(game, 'C').currentRoll?.stage === 'before-roll' && viewFor(game, 'C').activeWindow?.pendingActorId === 'C');
  const before = (await room.stored()).state.game!; const targetRollId = viewFor(before, 'C').currentRoll!.rollId;
  const force = await room.send('C', { type: 'PLAY_REACTION', cardInstanceId: 'a2-p02-r2c3', mode: 'force-fail', targetRollId });
  await room.replay(force);
  const during = (await room.snapshotFor('B')).game!;
  expect(during.actionCalculation).toMatchObject({ cardInstanceId: 'a2-p08-r1c1', effectLevel: 5 });
  await room.advance(game => viewFor(game, 'A').activeWindow?.kind === 'normal-defense');
  const resolved = (await room.stored()).state.game!;
  expect(resolved.rolls?.find(roll => roll.id === targetRollId)).toMatchObject({ forcedFailure: true, success: false, modifier: 0 });
  expect(viewFor(resolved, 'A').currentAction).toMatchObject({ technique: { effectLevel: 5, damage: 7 } });
  await room.replay(force);
  await room.advance(game => !game.windows?.length);
  const done = (await room.stored()).state.game!; expect(done.players.B!.damage).toBe(7); expect(done.discard).toContain('a2-p02-r2c3');
  expect(allCardInstanceIds(done)).toHaveLength(220); expect(new Set(allCardInstanceIds(done)).size).toBe(220);
});
