import { reset } from 'cloudflare:test';
import { afterEach, expect, it } from 'vitest';
import { activeWindowRef, allCardInstanceIds, transition, viewFor, type GameCommand, type GameState } from '@madou/engine';
import { makeNamedResponseScenario, namedResponseScenarioNames, type NamedResponseScenarioName } from './fixtures/named-response-scenarios.js';

import { entropy } from './fixtures/scenario-tools.js';
import { openTestRoom } from './fixtures/recovery-room.js';

afterEach(async () => { await reset(); });
it.each(namedResponseScenarioNames)('%s starts at an actual pending source declaration', name => {
  const game = makeNamedResponseScenario(name, ['A', 'B', 'C', 'D'].map(id => ({ id, name: id })));
  const view = viewFor(game, 'B');
  const sorrow = name.startsWith('response-sorrow');
  expect(view.currentAction).toMatchObject({ source: 'ability', actorId: 'B', stage: 'declaration', abilityId: sorrow ? 'c2-p05-r2c2-ab02' : 'c2-p04-r2c2-ab01' });
  expect(view.reactionTargetAbilityId).toBeTruthy();
  expect(view.activeWindow?.pendingActorId).toBe('C');
  expect(game.players.B!.revealed).toBe(!name.endsWith('hidden-source'));
  if (sorrow) {
    const knight = name.endsWith('unrelated') ? 'C' : 'A';
    expect(game.players[knight]!.characterId).toBe('c2-p07-r1c1');
    expect(game.players[knight]!.abilityCharacterIds).toEqual(['c2-p02-r2c2', 'c2-p07-r1c1']);
  }
  const ids = allCardInstanceIds(game);
  expect(ids).toHaveLength(220);
  expect(new Set(ids).size).toBe(220);
});

const mirror = 'c2-p01-r2c1-ab05';
const sorrow = 'c2-p07-r1c1-ab02';
const shadow = 'c2-p04-r2c2-ab01';
const majesty = 'c2-p05-r2c2-ab02';
function cards(game: GameState) {
  const ids = allCardInstanceIds(game);
  expect(ids).toHaveLength(220);
  expect(new Set(ids).size).toBe(220);
}
function attackCard(game: GameState) {
  const attack = viewFor(game, 'A').currentAttack!;
  const action = game.actions![attack.actionId]!;
  expect(action.actorId).toBe('A');
  expect(action.kind).toBe('attack');
  return action.cardInstanceId;
}
function consumed(game: GameState, cardId: string) {
  expect(game.discard.filter(id => id === cardId)).toHaveLength(1);
  expect(game.players.A!.hand).not.toContain(cardId);
  expect(game.players.A!.chants.map(card => card.cardInstanceId)).not.toContain(cardId);
  expect(game.players.A!.followers.map(card => card.cardInstanceId)).not.toContain(cardId);
}
function hiddenSource(game: GameState, abilityId: string, name: string) {
  expect(game.players.B!.revealed).toBe(false);
  for (const actor of ['A', 'C', 'D']) {
    const json = JSON.stringify(viewFor(game, actor));
    expect(json).not.toContain(abilityId);
    expect(json).not.toContain(name);
  }
}
function fixture(name: NamedResponseScenarioName) {
  let game = makeNamedResponseScenario(name, ['A', 'B', 'C', 'D'].map(id => ({ id, name: id })));
  function act(actorId: string, command: GameCommand) {
    const input = { actorId, command };
    const random = entropy();
    const result = transition(game, input, random);
    expect(result.ok).toBe(true);
    if (!result.ok) throw Error(result.code);
    expect(transition(JSON.parse(JSON.stringify(game)), input, random)).toEqual(result);
    game = result.state;
    cards(game);
  }
  function until(done: (state: GameState) => boolean) {
    for (let i = 0; i < 500; i++) {
      if (done(game)) return;
      const window = game.windows?.at(-1);
      if (!window) throw Error('NAMED_TEST_NO_WINDOW');
      act(window.participants[window.cursor]!, { type: 'PASS' });
    }
    throw Error('NAMED_TEST_NOT_READY');
  }
  function use(actorId: string, abilityId: string) {
    until(state => viewFor(state, actorId).activeWindow?.pendingActorId === actorId);
    const option = viewFor(game, actorId).abilityOptions.find(option => option.abilityId === abilityId);
    expect(option).toBeDefined();
    act(actorId, { type: 'USE_ABILITY', abilityId, targetEventId: option!.targetEventId });
    return option!.targetEventId;
  }
  return { get game() { return game; }, act, until, use };
}
const positive = [
  { scenario: 'response-mirror-attacker', actor: 'A', id: mirror },
  { scenario: 'response-mirror-third', actor: 'C', id: mirror },
  { scenario: 'response-sorrow', actor: 'A', id: sorrow },
] as const;
it.each(positive)('$scenario pins and cancels only the pending source before any ability check', entry => {
  const f = fixture(entry.scenario);
  const physical = attackCard(f.game);
  const sourceId = viewFor(f.game, 'B').reactionTargetAbilityId!;
  const eventId = f.use(entry.actor, entry.id);
  expect(eventId).toBe(sourceId);
  expect(viewFor(f.game, entry.actor).reactionTargetAbilityId).not.toBe(sourceId);
  f.until(state => state.windows?.at(-1)?.kind === 'normal-defense');
  expect(f.game.rolls?.filter(roll => roll.purpose === 'ability-check') ?? []).toEqual([]);
  expect(viewFor(f.game, 'B').abilityOptions.map(option => option.abilityId)).not.toContain(entry.id === mirror ? shadow : majesty);
  expect(viewFor(f.game, 'A').currentAttack!.reflection).toBeUndefined();
  f.until(state => !state.windows?.length);
  expect(f.game.players.B!.damage).toBe(6);
  expect(f.game.players.A!.damage).toBe(0);
  consumed(f.game, physical);
});
it.each([
  { scenario: 'response-mirror-hidden-source', actor: 'A', id: mirror },
  { scenario: 'response-mirror-hidden-owner', actor: 'A', id: mirror },
  { scenario: 'response-sorrow-hidden-source', actor: 'A', id: sorrow },
  { scenario: 'response-sorrow-unrelated', actor: 'C', id: sorrow },
] as const)('$scenario does not offer a response when its actual public or own-attacker condition is absent', entry => {
  const f = fixture(entry.scenario);
  const physical = attackCard(f.game);
  const sourceId = viewFor(f.game, 'B').reactionTargetAbilityId!;
  if (entry.scenario.endsWith('hidden-source')) hiddenSource(f.game, entry.id === mirror ? shadow : majesty, entry.id === mirror ? '影分身' : '魔導王の威厳');
  f.until(state => viewFor(state, entry.actor).activeWindow?.pendingActorId === entry.actor);
  if (entry.scenario.endsWith('hidden-source')) hiddenSource(f.game, entry.id === mirror ? shadow : majesty, entry.id === mirror ? '影分身' : '魔導王の威厳');
  expect(viewFor(f.game, entry.actor).abilityOptions.map(option => option.abilityId)).not.toContain(entry.id);
  const before = structuredClone(f.game);
  expect(transition(f.game, { actorId: entry.actor, command: { type: 'USE_ABILITY', abilityId: entry.id, targetEventId: sourceId } }, entropy())).toMatchObject({ ok: false, code: 'ABILITY_DISABLED' });
  expect(f.game).toEqual(before);
  f.until(state => !state.windows?.length);
  expect(f.game.players.B!.damage).toBe(entry.id === mirror ? 6 : 0);
  expect(f.game.players.A!.damage).toBe(entry.id === mirror ? 0 : 6);
  consumed(f.game, physical);
});
it.each([positive[0], positive[2]])('$scenario may decline the response and let the source resolve', entry => {
  const f = fixture(entry.scenario);
  const physical = attackCard(f.game);
  f.until(state => viewFor(state, entry.actor).activeWindow?.pendingActorId === entry.actor);
  expect(viewFor(f.game, entry.actor).abilityOptions.map(option => option.abilityId)).toContain(entry.id);
  f.until(state => !state.windows?.length);
  expect(f.game.players.B!.damage).toBe(entry.id === mirror ? 6 : 0);
  expect(f.game.players.A!.damage).toBe(entry.id === mirror ? 0 : 6);
  const checks = f.game.rolls!.filter(roll => roll.purpose === 'ability-check');
  expect(checks).toHaveLength(entry.id === mirror ? 2 : 1);
  consumed(f.game, physical);
});
it.each([positive[1], positive[2]])('$scenario canceled response leaves original checks or reflection intact and cannot be repeated', entry => {
  const f = fixture(entry.scenario);
  const physical = attackCard(f.game);
  const sourceId = f.use(entry.actor, entry.id);
  const responseId = viewFor(f.game, 'D').reactionTargetAbilityId!;
  expect(responseId).not.toBe(sourceId);
  f.until(state => viewFor(state, 'D').activeWindow?.pendingActorId === 'D');
  f.act('D', { type: 'PLAY_REACTION', cardInstanceId: 'a2-p02-r2c3', mode: 'cancel-ability', targetAbilityId: responseId });
  f.until(state => viewFor(state, entry.actor).reactionTargetAbilityId === sourceId && viewFor(state, entry.actor).activeWindow?.pendingActorId === entry.actor);
  expect(viewFor(f.game, entry.actor).abilityOptions.map(option => option.abilityId)).not.toContain(entry.id);
  const before = structuredClone(f.game);
  expect(transition(f.game, { actorId: entry.actor, command: { type: 'USE_ABILITY', abilityId: entry.id, targetEventId: sourceId } }, entropy())).toMatchObject({ ok: false, code: 'ABILITY_DISABLED' });
  expect(f.game).toEqual(before);
  if (entry.id === sorrow) {
    f.until(state => !!viewFor(state, 'A').currentAttack?.reflection);
    expect(viewFor(f.game, 'A').currentAttack!.reflection?.sourceCardInstanceId).toBe(physical);
    f.act('A', { type: 'PLAY_DEFENSE', cardInstanceId: 'a2-p05-r3c1', dedicated: false });
  }
  f.until(state => !state.windows?.length);
  expect(f.game.players.B!.damage).toBe(entry.id === mirror ? 6 : 0);
  expect(f.game.players.A!.damage).toBe(0);
  expect(f.game.rolls!.filter(roll => roll.purpose === 'ability-check')).toHaveLength(entry.id === mirror ? 2 : 1);
  expect(f.game.discard.filter(id => id === 'a2-p02-r2c3')).toHaveLength(1);
  if (entry.id === sorrow) expect(f.game.discard.filter(id => id === 'a2-p05-r3c1')).toHaveLength(1);
  consumed(f.game, physical);
});
it.each([positive[0], positive[2]])('$scenario rejects the shared event and foreign source IDs atomically', entry => {
  const f = fixture(entry.scenario);
  f.until(state => viewFor(state, entry.actor).activeWindow?.pendingActorId === entry.actor);
  const option = viewFor(f.game, entry.actor).abilityOptions.find(option => option.abilityId === entry.id)!;
  expect(option.targetEventId).toBe(viewFor(f.game, entry.actor).reactionTargetAbilityId);
  for (const targetEventId of [f.game.windows!.at(-1)!.eventId, 'ability-foreign']) {
    const before = structuredClone(f.game);
    expect(transition(f.game, { actorId: entry.actor, command: { type: 'USE_ABILITY', abilityId: entry.id, targetEventId } }, entropy())).toMatchObject({ ok: false, code: 'INVALID_TARGET' });
    expect(f.game).toEqual(before);
  }
});

async function savedRoom(name: NamedResponseScenarioName) {
  const room = await openTestRoom(name);
  let sequence = 0;
  async function send(actorId: string, command: GameCommand) {
    const before = await room.stored();
    const envelope = {
      protocolVersion: 1 as const,
      commandId: `named-${sequence++}`,
      expectedRevision: before.revision,
      ...activeWindowRef(before.state.game!),
      command,
    };
    const ack = await room.command(actorId, envelope);
    expect(ack).toMatchObject({ type: 'ack' });
    cards((await room.stored()).state.game!);
    return { actorId, envelope, ack };
  }
  async function until(done: (game: GameState) => boolean) {
    for (let i = 0; i < 500; i++) {
      const game = (await room.stored()).state.game!;
      if (done(game)) return;
      const window = game.windows?.at(-1);
      if (!window) throw Error('NAMED_DO_NO_WINDOW');
      await send(window.participants[window.cursor]!, { type: 'PASS' });
    }
    throw Error('NAMED_DO_NOT_READY');
  }
  async function use(actorId: string, abilityId: string) {
    await until(state => viewFor(state, actorId).activeWindow?.pendingActorId === actorId);
    const option = (await room.snapshotFor(actorId)).game!.abilityOptions.find(option => option.abilityId === abilityId)!;
    return send(actorId, { type: 'USE_ABILITY', abilityId, targetEventId: option.targetEventId });
  }
  async function replay(receipt: Awaited<ReturnType<typeof send>>) {
    const before = await room.stored();
    await room.restart();
    expect(await room.command(receipt.actorId, receipt.envelope)).toEqual(receipt.ack);
    expect(await room.stored()).toEqual(before);
  }
  return { ...room, send, until, use, replay };
}
it('DO keeps successful Sorrow bound to the original source through eviction and completed receipt replay', async () => {
  const room = await savedRoom('response-sorrow');
  const physical = attackCard(room.initial);
  const sourceId = (await room.snapshotFor('A')).game!.reactionTargetAbilityId!;
  const response = await room.use('A', sorrow);
  expect(response.envelope.command).toMatchObject({ targetEventId: sourceId });
  await room.replay(response);
  expect((await room.snapshotFor('A')).game!.currentAction).toMatchObject({ source: 'ability', actorId: 'A', abilityId: sorrow });
  await room.until(state => state.windows?.at(-1)?.kind === 'normal-defense');
  await room.replay(response);
  expect((await room.snapshotFor('B')).game!.abilityOptions.map(option => option.abilityId)).not.toContain(majesty);
  await room.until(state => !state.windows?.length);
  await room.replay(response);
  const done = (await room.stored()).state.game!;
  expect(done.players.B!.damage).toBe(6);
  expect(done.players.A!.damage).toBe(0);
  expect(done.rolls?.filter(roll => roll.purpose === 'ability-check') ?? []).toEqual([]);
  consumed(done, physical);
});
it.each([positive[1], positive[2]])('DO $scenario restores nested cancellation and the still-pending original source', async entry => {
  const room = await savedRoom(entry.scenario);
  const physical = attackCard(room.initial);
  const sourceId = (await room.snapshotFor('B')).game!.reactionTargetAbilityId!;
  const response = await room.use(entry.actor, entry.id);
  await room.replay(response);
  const responseId = (await room.snapshotFor('D')).game!.reactionTargetAbilityId!;
  expect(responseId).not.toBe(sourceId);
  await room.until(state => viewFor(state, 'D').activeWindow?.pendingActorId === 'D');
  const cancel = await room.send('D', { type: 'PLAY_REACTION', cardInstanceId: 'a2-p02-r2c3', mode: 'cancel-ability', targetAbilityId: responseId });
  await room.replay(cancel);
  await room.until(state => viewFor(state, entry.actor).reactionTargetAbilityId === sourceId && viewFor(state, entry.actor).activeWindow?.pendingActorId === entry.actor);
  await room.replay(response);
  await room.replay(cancel);
  const restored = (await room.snapshotFor(entry.actor)).game!;
  expect(restored.reactionTargetAbilityId).toBe(sourceId);
  expect(restored.abilityOptions.map(option => option.abilityId)).not.toContain(entry.id);
  if (entry.id === sorrow) {
    await room.until(state => !!viewFor(state, 'A').currentAttack?.reflection);
    const attack = (await room.snapshotFor('A')).game!.currentAttack!;
    expect(attack.reflection?.sourceCardInstanceId).toBe(physical);
    await room.replay(response);
    expect((await room.snapshotFor('A')).game!.currentAttack).toEqual(attack);
    const evade = await room.send('A', { type: 'PLAY_DEFENSE', cardInstanceId: 'a2-p05-r3c1', dedicated: false });
    await room.replay(evade);
  } else {
    await room.until(state => viewFor(state, 'B').currentRoll?.purpose === 'ability-check' && viewFor(state, 'B').currentRoll?.stage === 'after-roll');
    const roll = (await room.snapshotFor('B')).game!.currentRoll;
    await room.replay(response);
    expect((await room.snapshotFor('B')).game!.currentRoll).toEqual(roll);
  }
  await room.until(state => !state.windows?.length);
  await room.replay(response);
  await room.replay(cancel);
  const done = (await room.stored()).state.game!;
  expect(done.players.B!.damage).toBe(entry.id === mirror ? 6 : 0);
  expect(done.players.A!.damage).toBe(0);
  expect(done.rolls!.filter(roll => roll.purpose === 'ability-check')).toHaveLength(entry.id === mirror ? 2 : 1);
  expect(done.discard.filter(id => id === 'a2-p02-r2c3')).toHaveLength(1);
  if (entry.id === sorrow) expect(done.discard.filter(id => id === 'a2-p05-r3c1')).toHaveLength(1);
  consumed(done, physical);
});
