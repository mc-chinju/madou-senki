import { reset } from 'cloudflare:test';
import { afterEach, expect, it } from 'vitest';
import { activeWindowRef, allCardInstanceIds, transition, viewFor, type GameCommand, type GameState } from '@madou/engine';
import { makeReceivedDefenseScenario, type ReceivedDefenseScenarioName } from './fixtures/received-defense-scenarios.js';
import { entropy } from './fixtures/scenario-tools.js';
import { openTestRoom } from './fixtures/recovery-room.js';

afterEach(async () => { await reset(); });
const barrier = 'c2-p02-r1c2-ab01'; const robe = 'c2-p02-r1c2-ab02'; const silver = 'c2-p02-r2c2-ab01';
const shelim = 'c2-p01-r1c1-ab01'; const dark = 'c2-p03-r2c2-ab01';
function assertCards(game: GameState) { const cards = allCardInstanceIds(game); expect(cards).toHaveLength(220); expect(new Set(cards).size).toBe(220); }
function fixture(name: ReceivedDefenseScenarioName) {
  let game = makeReceivedDefenseScenario(name, ['A', 'B', 'C', 'D'].map(id => ({ id, name: id })));
  function act(actorId: string, command: GameCommand) {
    const input = { actorId, command }; const random = entropy(); const result = transition(game, input, random);
    expect(result.ok).toBe(true); if (!result.ok) throw Error(result.code);
    expect(transition(JSON.parse(JSON.stringify(game)), input, random)).toEqual(result); game = result.state; assertCards(game);
  }
  function until(done: (state: GameState) => boolean) {
    for (let i = 0; i < 500; i++) {
      if (done(game)) return;
      const window = game.windows?.at(-1); if (!window) throw Error('RECEIVED_WINDOW_MISSING');
      act(window.participants[window.cursor]!, { type: 'PASS' });
    }
    throw Error('RECEIVED_WINDOW_NOT_REACHED');
  }
  function use(abilityId: string) {
    const option = viewFor(game, 'B').abilityOptions.find(option => option.abilityId === abilityId);
    expect(option).toBeDefined(); act('B', { type: 'USE_ABILITY', abilityId, targetEventId: option!.targetEventId });
    return option!.targetEventId;
  }
  function reject(abilityId: string, targetEventId: string) {
    const before = structuredClone(game);
    expect(transition(game, { actorId: 'B', command: { type: 'USE_ABILITY', abilityId, targetEventId } }, entropy())).toMatchObject({ ok: false, code: 'ABILITY_DISABLED' });
    expect(game).toEqual(before);
  }
  return { get game() { return game; }, act, until, use, reject };
}
function publicAttack(game: GameState) {
  const value = viewFor(game, 'B').currentAttack;
  for (const actor of ['A', 'C', 'D']) expect(viewFor(game, actor).currentAttack).toEqual(value);
  return value!;
}
function privateAbility(game: GameState, id: string, name: string) {
  expect(viewFor(game, 'B').currentAction).toMatchObject({ source: 'ability', abilityId: id, label: name });
  for (const actor of ['A', 'C', 'D']) {
    const view = viewFor(game, actor); expect(view.currentAction).toMatchObject({ source: 'ability', label: '特殊能力' });
    expect(JSON.stringify(view)).not.toContain(id); expect(JSON.stringify(view)).not.toContain(name);
  }
}
function privateFuryAbilityIdentities(game: GameState) {
  for (const actor of ['A', 'C', 'D']) {
    const serialized = JSON.stringify(viewFor(game, actor));
    for (const identity of [barrier, robe, '光の結界', 'ミスリルのローブ']) expect(serialized).not.toContain(identity);
  }
}

it.each([true, false])('Fury robeFirst=%s keeps the reservation across JSON and reaches the same immunity', robeFirst => {
  const f = fixture('received-fury'); const hand = [...f.game.players.B!.hand];
  const options = viewFor(f.game, 'B').abilityOptions;
  expect(options.map(option => option.abilityId)).toEqual(expect.arrayContaining([barrier, robe]));
  privateFuryAbilityIdentities(f.game);
  const first = robeFirst ? robe : barrier; const second = robeFirst ? barrier : robe;
  const event = f.use(first); privateAbility(f.game, first, robeFirst ? 'ミスリルのローブ' : '光の結界');
  f.until(game => game.windows?.at(-1)?.kind === 'normal-defense');
  expect(publicAttack(f.game).technique).toMatchObject({ effectLevel: robeFirst ? 4 : 3, damage: 4 });
  expect(publicAttack(f.game).targets[0]!.hits[0]!.defended).toBe(false);
  f.reject(first, event); expect(viewFor(f.game, 'B').abilityOptions.map(option => option.abilityId)).toContain(second);
  f.use(second); f.until(game => !game.windows?.length);
  expect(f.game.players.B!.damage).toBe(0); expect(f.game.players.B!.hand).toEqual(hand);
  expect(f.game.discard.filter(id => id === 'a2-p12-r2c2')).toHaveLength(1); expect(viewFor(f.game, 'B').currentAttack).toBeNull();
});
it('declining Fury leaves the original magic4/damage4 and does not activate a barrier automatically', () => {
  const f = fixture('received-fury'); const event = viewFor(f.game, 'B').abilityOptions.find(option => option.abilityId === barrier)!.targetEventId;
  expect(publicAttack(f.game).technique).toMatchObject({ effectLevel: 4, damage: 4 });
  f.until(game => game.windows?.at(-1)?.kind === 'follower-start'); f.reject(barrier, event);
  expect(publicAttack(f.game).technique).toMatchObject({ effectLevel: 4, damage: 4 });
  f.until(game => !game.windows?.length); expect(f.game.players.B!.damage).toBe(4);
});
it('canceling the reduction spends it while the reserved robe remains above threshold', () => {
  const f = fixture('received-fury'); f.use(robe); f.until(game => game.windows?.at(-1)?.kind === 'normal-defense');
  const event = f.use(barrier); privateAbility(f.game, barrier, '光の結界');
  f.until(game => viewFor(game, 'C').activeWindow?.pendingActorId === 'C' && !!viewFor(game, 'C').reactionTargetAbilityId);
  privateFuryAbilityIdentities(f.game);
  f.act('C', { type: 'PLAY_REACTION', cardInstanceId: 'a2-p02-r2c3', mode: 'cancel-ability', targetAbilityId: viewFor(f.game, 'C').reactionTargetAbilityId! });
  privateFuryAbilityIdentities(f.game);
  f.until(game => game.windows?.at(-1)?.kind === 'normal-defense');
  expect(publicAttack(f.game).technique).toMatchObject({ effectLevel: 4, damage: 4 }); f.reject(barrier, event);
  expect(viewFor(f.game, 'B').abilityOptions.map(option => option.abilityId)).not.toContain(barrier);
  f.until(game => !game.windows?.length); expect(f.game.players.B!.damage).toBe(4); expect(f.game.discard.filter(id => id === 'a2-p02-r2c3')).toHaveLength(1);
});
it.each(['received-silver-black', 'received-silver-white'] as const)('%s applies the complete armor package only to actual black attributes', name => {
  const f = fixture(name); expect(publicAttack(f.game).technique.effectLevel).toBe(5);
  f.use(silver); privateAbility(f.game, silver, '白銀の鎧');
  if (name === 'received-silver-white') {
    f.until(game => game.windows?.at(-1)?.kind === 'normal-defense');
    expect(publicAttack(f.game).technique).toMatchObject({ effectLevel: 5, damage: 6 });
  }
  f.until(game => !game.windows?.length); expect(f.game.players.B!.damage).toBe(name === 'received-silver-black' ? 0 : 6);
});
it.each(['received-shelim', 'received-shelim-hp'] as const)('%s evaluates actual incoming damage before Soldier HP reduction', name => {
  const f = fixture(name); const hp = name === 'received-shelim-hp';
  expect(publicAttack(f.game).technique).toMatchObject({ effectLevel: 6, damage: hp ? 6 : 5 });
  if (hp) { expect(f.game.players.B!.followers.map(card => card.cardInstanceId)).toEqual(['a2-p18-r3c3']); expect(f.game.discard).toContain('a2-p05-r2c3'); }
  f.use(shelim);
  if (hp) {
    f.until(game => game.windows?.at(-1)?.kind === 'normal-defense'); expect(publicAttack(f.game).targets[0]!.hits[0]!.defended).toBe(false);
    f.until(game => viewFor(game, 'A').followerDefenseResults.some(result => result.cardInstanceId === 'a2-p18-r3c3'));
    expect(viewFor(f.game, 'A').followerDefenseResults[0]!.hits[0]!.hpReduction).toBe(1);
  }
  f.until(game => !game.windows?.length); expect(f.game.players.B!.damage).toBe(hp ? 5 : 0);
});
it('a shared two-target technique reduces only Arnes incoming value and never its damage or original declaration', () => {
  const f = fixture('received-shared'); f.use(dark); f.until(game => game.windows?.at(-1)?.kind === 'normal-defense');
  const attack = publicAttack(f.game); expect(attack.technique).toMatchObject({ effectLevel: 5, damage: 8 });
  expect(attack.targets.map(target => [target.actorId, target.hits[0]!.technique!.effectLevel, target.hits[0]!.technique!.damage])).toEqual([['B', 5, 8], ['C', 6, 8]]);
  expect(viewFor(f.game, 'A').currentAction).toMatchObject({ technique: { effectLevel: 6, damage: 8 } });
  f.act('B', { type: 'PASS' }); expect(publicAttack(f.game).targetId).toBe('C'); expect(publicAttack(f.game).technique.effectLevel).toBe(6);
  f.until(game => !game.windows?.length); expect(f.game.players.B!.damage).toBe(8); expect(f.game.players.C!.damage).toBe(8);
});
it.each(['received-aiel-fire', 'received-aiel-water', 'received-fleiard-fire', 'received-fleiard-water'] as const)('%s accepts both named elements', name => {
  const f = fixture(name); const id = name.startsWith('received-aiel') ? 'c2-p04-r1c1-ab01' : 'c2-p06-r2c1-ab01';
  f.use(id); f.until(game => !game.windows?.length); expect(f.game.players.B!.damage).toBe(0);
});
it('Aiel cannot use the elemental barrier against actual wind magic', () => {
  const f = fixture('received-aiel-wind'); expect(viewFor(f.game, 'B').abilityOptions.map(option => option.abilityId)).not.toContain('c2-p04-r1c1-ab01');
  f.until(game => !game.windows?.length); expect(f.game.players.B!.damage).toBe(4);
});

async function savedRoom(name: ReceivedDefenseScenarioName) {
  const room = await openTestRoom(name); let sequence = 0;
  async function send(actorId: string, command: GameCommand) {
    const before = await room.stored(); const envelope = { protocolVersion: 1 as const, commandId: `received-${sequence++}`, expectedRevision: before.revision, ...activeWindowRef(before.state.game!), command };
    const ack = await room.command(actorId, envelope); expect(ack).toMatchObject({ type: 'ack' }); assertCards((await room.stored()).state.game!);
    return { actorId, envelope, ack };
  }
  async function until(done: (game: GameState) => boolean) {
    for (let i = 0; i < 500; i++) {
      const game = (await room.stored()).state.game!; if (done(game)) return;
      const window = game.windows?.at(-1); if (!window) throw Error('RECEIVED_DO_WINDOW_MISSING'); await send(window.participants[window.cursor]!, { type: 'PASS' });
    }
    throw Error('RECEIVED_DO_WINDOW_NOT_REACHED');
  }
  async function use(abilityId: string) {
    const option = (await room.snapshotFor('B')).game!.abilityOptions.find(option => option.abilityId === abilityId)!;
    return send('B', { type: 'USE_ABILITY', abilityId, targetEventId: option.targetEventId });
  }
  async function replay(receipt: Awaited<ReturnType<typeof send>>) {
    const before = await room.stored(); await room.restart(); expect(await room.command(receipt.actorId, receipt.envelope)).toEqual(receipt.ack); expect(await room.stored()).toEqual(before);
  }
  return { ...room, send, until, use, replay };
}
it.each([true, false])('DO restores the pending choice and resolved first package, robeFirst=%s', async robeFirst => {
  const room = await savedRoom('received-fury'); const first = robeFirst ? robe : barrier; const second = robeFirst ? barrier : robe;
  const receipt = await room.use(first); await room.replay(receipt);
  await room.until(game => game.windows?.at(-1)?.kind === 'normal-defense'); await room.replay(receipt);
  const restored = (await room.snapshotFor('B')).game!;
  expect(restored.currentAttack!.technique).toMatchObject({ effectLevel: robeFirst ? 4 : 3, damage: 4 });
  expect(restored.abilityOptions.map(option => option.abilityId)).not.toContain(first); expect(restored.abilityOptions.map(option => option.abilityId)).toContain(second);
  const final = await room.use(second); await room.replay(final); await room.until(game => !game.windows?.length); await room.replay(receipt); await room.replay(final);
  const done = (await room.stored()).state.game!; expect(done.players.B!.damage).toBe(0); expect(done.discard.filter(id => id === 'a2-p12-r2c2')).toHaveLength(1);
});
it('DO cancellation receipt restores a spent barrier with its prior robe reservation intact', async () => {
  const room = await savedRoom('received-fury'); await room.use(robe); await room.until(game => game.windows?.at(-1)?.kind === 'normal-defense');
  const use = await room.use(barrier); await room.until(game => viewFor(game, 'C').activeWindow?.pendingActorId === 'C' && !!viewFor(game, 'C').reactionTargetAbilityId);
  const cancel = await room.send('C', { type: 'PLAY_REACTION', cardInstanceId: 'a2-p02-r2c3', mode: 'cancel-ability', targetAbilityId: (await room.snapshotFor('C')).game!.reactionTargetAbilityId! }); await room.replay(cancel);
  await room.until(game => game.windows?.at(-1)?.kind === 'normal-defense'); await room.replay(use);
  const view = (await room.snapshotFor('B')).game!; expect(view.currentAttack!.technique.effectLevel).toBe(4);
  expect(view.abilityOptions.map(option => option.abilityId)).not.toContain(barrier); expect(view.abilityOptions.map(option => option.abilityId)).not.toContain(robe);
  await room.until(game => !game.windows?.length); await room.replay(cancel); expect((await room.stored()).state.game!.players.B!.damage).toBe(4);
});
