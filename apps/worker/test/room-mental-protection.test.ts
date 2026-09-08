import { reset } from 'cloudflare:test';
import { afterEach, expect, it } from 'vitest';
import { activeWindowRef, allCardInstanceIds, transition, viewFor, type GameCommand, type GameState } from '@madou/engine';
import { makeMentalProtectionScenario, mentalProtectionScenarioNames, type MentalProtectionScenarioName } from './fixtures/mental-protection-scenarios.js';
import { entropy } from './fixtures/scenario-tools.js';
import { openTestRoom } from './fixtures/recovery-room.js';

afterEach(async () => { await reset(); });
function cards(game: GameState) {
  const ids = allCardInstanceIds(game);
  expect(ids).toHaveLength(220);
  expect(new Set(ids).size).toBe(220);
}
function fixture(name: MentalProtectionScenarioName) {
  const players = (name === 'protect-lancelot-ii' ? ['A', 'B', 'C', 'D', 'E'] : ['A', 'B', 'C', 'D']).map(id => ({ id, name: id }));
  let game = makeMentalProtectionScenario(name, players);
  function act(actorId: string, command: GameCommand, dice = [1, 2]) {
    const input = { actorId, command };
    const random = { ...entropy(), dice };
    const result = transition(game, input, random);
    expect(result.ok, JSON.stringify({ input, result: result.ok ? 'ok' : result })).toBe(true);
    if (!result.ok) throw Error(result.code);
    expect(transition(JSON.parse(JSON.stringify(game)), input, random)).toEqual(result);
    game = result.state;
    cards(game);
  }
  function until(done: (state: GameState) => boolean, dice?: number[]) {
    for (let i = 0; i < 500; i++) {
      if (done(game)) return;
      const window = game.windows?.at(-1);
      if (!window) throw Error('PROTECTION_TEST_NO_WINDOW');
      act(window.participants[window.cursor]!, { type: 'PASS' }, dice);
    }
    throw Error('PROTECTION_TEST_NOT_READY');
  }
  function use(actorId: string, abilityId: string) {
    until(state => viewFor(state, actorId).activeWindow?.pendingActorId === actorId);
    const option = viewFor(game, actorId).abilityOptions.find(option => option.abilityId === abilityId);
    expect(option).toBeDefined();
    act(actorId, { type: 'USE_ABILITY', abilityId, targetEventId: option!.targetEventId });
    return option!.targetEventId;
  }
  const source = game.actions![viewFor(game, 'A').currentAttack!.actionId]!.cardInstanceId;
  return { get game() { return game; }, act, until, use, source };
}
function consumed(game: GameState, source: string) {
  expect(game.discard.filter(id => id === source)).toHaveLength(1);
  expect(game.players.A!.hand).not.toContain(source);
  expect(game.players.A!.chants.map(card => card.cardInstanceId)).not.toContain(source);
  expect(game.players.A!.followers.map(card => card.cardInstanceId)).not.toContain(source);
}
const named = [
  { scenario: 'protect-cham', actor: 'C', id: 'c2-p01-r2c2-ab04' },
  { scenario: 'protect-tia', actor: 'A', id: 'c2-p02-r1c1-ab03' },
  { scenario: 'protect-lancelot', actor: 'A', id: 'c2-p02-r2c2-ab03' },
  { scenario: 'protect-lancelot-ii', actor: 'A', id: 'c2-p02-r2c2-ab03' },
  { scenario: 'protect-uonos', actor: 'A', id: 'c2-p05-r1c1-ab03' },
  { scenario: 'protect-gad-response', actor: 'A', id: 'c2-p06-r1c1-ab02' },
] as const;
const guards = [
  { scenario: 'protect-gil-six', id: 'c2-p01-r1c2-ab04', damage: 0, success: false },
  { scenario: 'protect-shin-six', id: 'c2-p01-r2c1-ab04', damage: 6, success: true },
  { scenario: 'protect-garwin-six', id: 'c2-p05-r2c1-ab02', damage: 6, success: true },
] as const;
it.each(mentalProtectionScenarioNames)('%s uses a conserved actual physical attack with new protection unselected', name => {
  const f = fixture(name);
  cards(f.game);
  expect(f.game.actions![viewFor(f.game, 'A').currentAttack!.actionId]).toMatchObject({ actorId: 'A', kind: 'attack', cardInstanceId: f.source });
  expect(f.game.discard).not.toContain(f.source);
  if (name.endsWith('-six')) expect(viewFor(f.game, 'A').currentRoll).toMatchObject({ faces: [6, 6], purpose: 'ability-check', stage: 'after-roll' });
});
it.each(named)('$scenario actual response cancels only the selected mental source and consumes the attack once', entry => {
  const f = fixture(entry.scenario);
  const sourceFrame = viewFor(f.game, entry.actor).reactionTargetAbilityId;
  const event = f.use(entry.actor, entry.id);
  expect(event).toBe(sourceFrame);
  if (entry.scenario !== 'protect-cham' && entry.scenario !== 'protect-lancelot-ii') {
    expect(f.game.players[entry.actor]!.revealed).toBe(false);
    for (const actor of ['B', 'C', 'D']) expect(JSON.stringify(viewFor(f.game, actor))).not.toContain(entry.id);
  }
  f.until(state => !state.windows?.length);
  expect(f.game.players.B!.damage).toBe(6);
  expect(f.game.rolls?.filter(roll => roll.purpose === 'ability-check') ?? []).toHaveLength(0);
  consumed(f.game, f.source);
});
it.each([
  { scenario: 'protect-cham-hidden-owner', actor: 'C', id: 'c2-p01-r2c2-ab04' },
  { scenario: 'protect-cham-hidden-source', actor: 'C', id: 'c2-p01-r2c2-ab04' },
  { scenario: 'protect-tia-hidden-source', actor: 'A', id: 'c2-p02-r1c1-ab03' },
  { scenario: 'protect-uonos-hidden-source', actor: 'A', id: 'c2-p05-r1c1-ab03' },
] as const)('$scenario preserves printed public conditions', entry => {
  const f = fixture(entry.scenario);
  f.until(state => viewFor(state, entry.actor).activeWindow?.pendingActorId === entry.actor);
  expect(viewFor(f.game, entry.actor).abilityOptions.map(option => option.abilityId)).not.toContain(entry.id);
  const before = structuredClone(f.game);
  const event = viewFor(f.game, entry.actor).reactionTargetAbilityId!;
  expect(transition(f.game, { actorId: entry.actor, command: { type: 'USE_ABILITY', abilityId: entry.id, targetEventId: event } }, entropy()).ok).toBe(false);
  expect(f.game).toEqual(before);
  f.until(state => !state.windows?.length);
  expect(f.game.players.B!.damage).toBe(6);
  expect(f.game.rolls?.filter(roll => roll.purpose === 'ability-check')).toHaveLength(1);
  consumed(f.game, f.source);
});
it.each(guards)('$scenario preserves ordinary success/failure while suppressing all six-double consequences', entry => {
  const f = fixture(entry.scenario);
  const before = viewFor(f.game, 'A').self;
  expect(viewFor(f.game, 'A').currentRoll).toMatchObject({ faces: [6, 6], success: entry.success });
  f.use('A', entry.id);
  for (const actor of ['B', 'C', 'D']) expect(JSON.stringify(viewFor(f.game, actor))).not.toContain(entry.id);
  f.until(state => !state.windows?.length);
  expect(f.game.players.B!.damage).toBe(entry.damage);
  expect(f.game.players.A!.presence).toBe('active');
  expect(f.game.players.A!.statuses ?? []).toEqual([]);
  expect(viewFor(f.game, 'A').self.faction).toBe(before.faction);
  expect(viewFor(f.game, 'A').self.protection).toEqual(before.protection);
  expect(f.game.rolls!.find(roll => roll.purpose === 'ability-check')).toMatchObject({ faces: [6, 6], success: entry.success });
  consumed(f.game, f.source);
});
it('Fate can cancel a selected guard, spends its attempt, and restores the original double effect', () => {
  const f = fixture('protect-garwin-six');
  const event = f.use('A', 'c2-p05-r2c1-ab02');
  f.until(state => viewFor(state, 'D').activeWindow?.pendingActorId === 'D');
  f.act('D', { type: 'PLAY_REACTION', cardInstanceId: 'a2-p02-r2c3', mode: 'cancel-ability', targetAbilityId: viewFor(f.game, 'D').reactionTargetAbilityId! });
  f.until(state => viewFor(state, 'A').currentRoll?.stage === 'after-roll' && viewFor(state, 'A').activeWindow?.pendingActorId === 'A');
  expect(viewFor(f.game, 'A').abilityOptions.map(option => option.abilityId)).not.toContain('c2-p05-r2c1-ab02');
  expect(transition(f.game, { actorId: 'A', command: { type: 'USE_ABILITY', abilityId: 'c2-p05-r2c1-ab02', targetEventId: event } }, entropy()).ok).toBe(false);
  f.until(state => !state.windows?.length);
  expect(f.game.players.B!.damage).toBe(0);
  expect(f.game.players.A!.statuses?.some(status => status.kind === 'stopped')).toBe(true);
  expect(viewFor(f.game, 'A').self.protection.characterIds).toEqual(['c2-p06-r1c2']);
  consumed(f.game, f.source);
});
it('Garwin selected against actual Nightmare keeps damage and a failed resistance but prevents its new stop', () => {
  const f = fixture('protect-garwin-nightmare');
  expect(viewFor(f.game, 'B').currentAttack!.technique.damage).toBe(2);
  f.use('B', 'c2-p05-r2c1-ab02');
  f.until(state => viewFor(state, 'B').currentRoll?.purpose === 'status-resistance' && viewFor(state, 'B').currentRoll?.stage === 'after-roll', [6, 6]);
  expect(viewFor(f.game, 'B').currentRoll).toMatchObject({ success: false, faces: [6, 6] });
  f.until(state => !state.windows?.length);
  expect(f.game.players.B!.damage).toBe(2);
  expect(f.game.players.B!.statuses ?? []).toEqual([]);
  consumed(f.game, f.source);
});
it.each(['protect-gad-warrior', 'protect-gad-null'] as const)('%s cancels the whole 精 hit before any resistance, including null damage', scenario => {
  const f = fixture(scenario);
  if (scenario === 'protect-gad-null') expect(viewFor(f.game, 'B').currentAttack!.technique.damage).toBeNull();
  f.use('B', 'c2-p06-r1c1-ab02');
  f.until(state => !state.windows?.length);
  expect(f.game.players.B!.damage).toBe(0);
  expect(f.game.rolls?.filter(roll => roll.purpose === 'status-resistance') ?? []).toEqual([]);
  consumed(f.game, f.source);
});
it('actual Gil dedicated 気破 bypasses Gad mental technique immunity with exact original damage', () => {
  const f = fixture('protect-gad-gil-exception');
  expect(viewFor(f.game, 'B').abilityOptions.map(option => option.abilityId)).not.toContain('c2-p06-r1c1-ab02');
  const damage = viewFor(f.game, 'B').currentAttack!.technique.damage;
  expect(damage).toBe(38);
  f.until(state => !state.windows?.length);
  expect(f.game.players.B!.damage).toBe(damage);
  consumed(f.game, f.source);
});

async function savedRoom(scenario: MentalProtectionScenarioName) {
  const room = await openTestRoom(scenario);
  let sequence = 0;
  async function send(actorId: string, command: GameCommand) {
    const before = await room.stored();
    const envelope = { protocolVersion: 1 as const, commandId: `protection-${sequence++}`, expectedRevision: before.revision, ...activeWindowRef(before.state.game!), command };
    const ack = await room.command(actorId, envelope);
    expect(ack).toMatchObject({ type: 'ack' });
    cards((await room.stored()).state.game!);
    return { actorId, envelope, ack };
  }
  async function until(done: (state: GameState) => boolean) {
    for (let i = 0; i < 500; i++) {
      const game = (await room.stored()).state.game!;
      if (done(game)) return;
      const window = game.windows?.at(-1);
      if (!window) throw Error('PROTECTION_DO_NO_WINDOW');
      await send(window.participants[window.cursor]!, { type: 'PASS' });
    }
    throw Error('PROTECTION_DO_NOT_READY');
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
it.each([
  { scenario: 'protect-gil-six', actor: 'A', id: 'c2-p01-r1c2-ab04', damage: 0 },
  { scenario: 'protect-gad-response', actor: 'A', id: 'c2-p06-r1c1-ab02', damage: 6 },
  { scenario: 'protect-gad-null', actor: 'B', id: 'c2-p06-r1c1-ab02', damage: 0 },
] as const)('DO $scenario replays an exact receipt across eviction before and after effect commitment', async entry => {
  const room = await savedRoom(entry.scenario);
  const source = room.initial.actions![viewFor(room.initial, 'A').currentAttack!.actionId]!.cardInstanceId;
  const before = viewFor(room.initial, 'A').self;
  const receipt = await room.use(entry.actor, entry.id);
  await room.replay(receipt);
  for (const actor of ['A', 'B', 'C', 'D'].filter(actor => actor !== entry.actor)) expect(JSON.stringify((await room.snapshotFor(actor)).game)).not.toContain(entry.id);
  await room.until(state => !state.windows?.length);
  await room.replay(receipt);
  const done = (await room.stored()).state.game!;
  expect(done.players.B!.damage).toBe(entry.damage);
  expect(done.players.A!.statuses ?? []).toEqual([]);
  expect(viewFor(done, 'A').self.faction).toBe(before.faction);
  expect(viewFor(done, 'A').self.protection).toEqual(before.protection);
  consumed(done, source);
});
