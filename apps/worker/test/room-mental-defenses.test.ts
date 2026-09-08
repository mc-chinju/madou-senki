import { getAction } from '@madou/catalog';
import { reset } from 'cloudflare:test';
import { afterEach, expect, it } from 'vitest';
import { activeWindowRef, allCardInstanceIds, derivedStats, transition, viewFor, type GameCommand, type GameState } from '@madou/engine';
import { makeMentalDefenseScenario, type MentalDefenseScenarioName } from './fixtures/mental-defense-scenarios.js';

import { entropy } from './fixtures/scenario-tools.js';
import { openTestRoom } from './fixtures/recovery-room.js';

afterEach(async () => { await reset(); });
it.each([
  ['mental-lester-choice', 'c2-p03-r2c1-ab01'],
  ['mental-dia-choice', 'c2-p06-r1c2-ab01'],
  ['mental-fear-choice', 'c2-p06-r1c1-ab01'],
] as const)('%s begins at an actual unselected incoming attack', (scenario, abilityId) => {
  const game = makeMentalDefenseScenario(scenario, ['A', 'B', 'C', 'D'].map(id => ({ id, name: id })));
  const view = viewFor(game, 'B');
  expect(view.activeWindow?.kind).toBe('normal-defense');
  expect(view.currentAttack!.technique).toMatchObject({ effectLevel: 5, damage: 6 });
  expect(view.abilityOptions.map(option => option.abilityId)).toContain(abilityId);
  expect(view.currentRoll).toBeNull();
  const ids = allCardInstanceIds(game);
  expect(ids).toHaveLength(220);
  expect(new Set(ids).size).toBe(220);
});

const lester = 'c2-p03-r2c1-ab01';
const dia = 'c2-p06-r1c2-ab01';
const fear = 'c2-p06-r1c1-ab01';
function cards(game: GameState) {
  const ids = allCardInstanceIds(game);
  expect(ids).toHaveLength(220);
  expect(new Set(ids).size).toBe(220);
}
function physicalSource(game: GameState) {
  const attack = viewFor(game, 'A').currentAttack!;
  const source = game.actions![attack.actionId]!;
  expect(source.actorId).toBe('A');
  expect(source.kind).toBe('attack');
  return source.cardInstanceId;
}
function consumed(game: GameState, source: string) {
  expect(game.discard.filter(id => id === source)).toHaveLength(1);
  expect(game.players.A!.hand).not.toContain(source);
  expect(game.players.A!.chants.map(card => card.cardInstanceId)).not.toContain(source);
  expect(game.players.A!.followers.map(card => card.cardInstanceId)).not.toContain(source);
}
function privateSource(game: GameState, abilityId: string, name: string) {
  expect(game.players.B!.revealed).toBe(false);
  for (const actor of ['A', 'C', 'D']) {
    const json = JSON.stringify(viewFor(game, actor));
    expect(json).not.toContain(abilityId);
    expect(json).not.toContain(name);
  }
}
function privateGoals(game: GameState) {
  for (const actor of ['B', 'C', 'D']) {
    const publicA = viewFor(game, actor).players.A!;
    expect(publicA).not.toHaveProperty('currentObjective');
    expect(publicA).not.toHaveProperty('protection');
    expect(publicA).not.toHaveProperty('defeatCondition');
    expect(publicA).not.toHaveProperty('objective');
  }
}
function fixture(name: MentalDefenseScenarioName) {
  let game = makeMentalDefenseScenario(name, ['A', 'B', 'C', 'D'].map(id => ({ id, name: id })));
  function act(actorId: string, command: GameCommand, dice?: number[]) {
    const input = { actorId, command };
    const random = { ...entropy(), ...(dice ? { dice } : {}) };
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
      if (!window) throw Error('MENTAL_TEST_NO_WINDOW');
      act(window.participants[window.cursor]!, { type: 'PASS' }, dice);
    }
    throw Error('MENTAL_TEST_NOT_READY');
  }
  function use(abilityId: string) {
    const option = viewFor(game, 'B').abilityOptions.find(option => option.abilityId === abilityId)!;
    expect(option).toBeDefined();
    act('B', { type: 'USE_ABILITY', abilityId, targetEventId: option.targetEventId });
    return option.targetEventId;
  }
  return { get game() { return game; }, act, until, use };
}
const choices = [
  { scenario: 'mental-lester-choice', id: lester, name: '魔詩' },
  { scenario: 'mental-dia-choice', id: dia, name: '魅了' },
  { scenario: 'mental-fear-choice', id: fear, name: '恐怖' },
] as const;
for (const use of [false, true]) it.each(choices)('$scenario selected=' + use + ' ordinary non-double success preserves the incoming attack', entry => {
  const f = fixture(entry.scenario);
  const source = physicalSource(f.game);
  if (use) {
    f.use(entry.id);
    privateSource(f.game, entry.id, entry.name);
    f.until(state => viewFor(state, 'A').currentRoll?.purpose === 'ability-check' && viewFor(state, 'A').currentRoll?.stage === 'after-roll', [1, 2]);
    expect(viewFor(f.game, 'A').currentRoll).toMatchObject({ rollerId: 'A', faces: [1, 2], modifier: -1, success: true });
    for (const actor of ['B', 'C', 'D']) expect(viewFor(f.game, actor).currentRoll!.threshold).toBeUndefined();
  }
  f.until(state => !state.windows?.length);
  expect(f.game.players.B!.damage).toBe(6);
  expect(f.game.players.A!.statuses?.some(status => status.kind === 'stopped') ?? false).toBe(false);
  expect(f.game.rolls?.filter(roll => roll.purpose === 'ability-check') ?? []).toHaveLength(use ? 1 : 0);
  consumed(f.game, source);
});
it.each(choices)('$scenario real Fate cancels the source without revealing its identity or restoring its attempt', entry => {
  const f = fixture(entry.scenario);
  const source = physicalSource(f.game);
  const event = f.use(entry.id);
  f.until(state => viewFor(state, 'C').activeWindow?.pendingActorId === 'C');
  privateSource(f.game, entry.id, entry.name);
  f.act('C', { type: 'PLAY_REACTION', cardInstanceId: 'a2-p02-r2c3', mode: 'cancel-ability', targetAbilityId: viewFor(f.game, 'C').reactionTargetAbilityId! });
  privateSource(f.game, entry.id, entry.name);
  f.until(state => state.windows?.at(-1)?.kind === 'normal-defense');
  const before = structuredClone(f.game);
  expect(transition(f.game, { actorId: 'B', command: { type: 'USE_ABILITY', abilityId: entry.id, targetEventId: event } }, entropy())).toMatchObject({ ok: false, code: 'ABILITY_DISABLED' });
  expect(f.game).toEqual(before);
  f.until(state => !state.windows?.length);
  expect(f.game.players.B!.damage).toBe(6);
  expect(f.game.rolls?.filter(roll => roll.purpose === 'ability-check') ?? []).toEqual([]);
  expect(f.game.discard.filter(id => id === 'a2-p02-r2c3')).toHaveLength(1);
  consumed(f.game, source);
});
it.each([
  { scenario: 'mental-lester-six', faction: 'GOOD', objective: 'EVILの全滅', enemies: ['EVIL'], protection: ['c2-p03-r1c2'], defeat: 'リーア姫の死亡', id: lester, name: '魔詩' },
  { scenario: 'mental-dia-six', faction: 'EVIL', objective: 'ディアと敵対するものの全滅', enemies: ['GOOD', 'ヴァンミール'], protection: ['c2-p06-r1c2'], defeat: '愛しいディアの死亡', id: dia, name: '魅了' },
] as const)('$scenario saves the exact replacement objective and protection privately with the attacker seat stop', entry => {
  const f = fixture(entry.scenario);
  const source = physicalSource(f.game);
  expect(viewFor(f.game, 'A').currentRoll).toMatchObject({ faces: [6, 6], success: true, modifier: -1 });
  f.until(state => !state.windows?.length);
  const own = viewFor(f.game, 'A').self;
  expect(own.faction).toBe(entry.faction);
  expect(own.objective).toBe(entry.objective);
  expect(own.currentObjective.enemyFactions).toEqual(entry.enemies);
  expect(own.protection.characterIds).toEqual(entry.protection);
  expect(own.defeatCondition).toBe(entry.defeat);
  expect(viewFor(f.game, 'A').players.A!.statuses).toContainEqual({ kind: 'stopped', timing: 'next-own-seat', expiresOnActorId: 'A' });
  privateGoals(f.game);
  privateSource(f.game, entry.id, entry.name);
  expect(f.game.players.B!.damage).toBe(0);
  consumed(f.game, source);
});
it('a fixed faction blocks Dia conversion but keeps ordinary six-double cancellation and stop', () => {
  const f = fixture('mental-dia-fixed-six');
  const source = physicalSource(f.game);
  const before = viewFor(f.game, 'A').self;
  f.until(state => !state.windows?.length);
  const after = viewFor(f.game, 'A').self;
  expect(after.faction).toBe('GOOD');
  expect(after.objective).toBe(before.objective);
  expect(after.currentObjective).toEqual(before.currentObjective);
  expect(after.protection).toEqual(before.protection);
  expect(after.defeatCondition).toBe(before.defeatCondition);
  expect(viewFor(f.game, 'A').players.A!.statuses).toContainEqual({ kind: 'stopped', timing: 'next-own-seat', expiresOnActorId: 'A' });
  expect(f.game.players.B!.damage).toBe(0);
  consumed(f.game, source);
});
it('a successful ordinary double cancels and stops without six-double conversion', () => {
  const f = fixture('mental-lester-double');
  const source = physicalSource(f.game);
  const before = viewFor(f.game, 'A').self;
  expect(viewFor(f.game, 'A').currentRoll).toMatchObject({ faces: [2, 2], success: true });
  f.until(state => !state.windows?.length);
  expect(viewFor(f.game, 'A').self.faction).toBe(before.faction);
  expect(viewFor(f.game, 'A').self.protection).toEqual(before.protection);
  expect(viewFor(f.game, 'A').players.A!.statuses).toContainEqual({ kind: 'stopped', timing: 'next-own-seat', expiresOnActorId: 'A' });
  expect(f.game.players.B!.damage).toBe(0);
  consumed(f.game, source);
});
it('a saved non-double forced failure cancels only the target and adds no stop or conversion', () => {
  const f = fixture('mental-lester-failed');
  const source = physicalSource(f.game);
  const before = viewFor(f.game, 'A').self;
  expect(viewFor(f.game, 'A').currentRoll).toMatchObject({ faces: [1, 2], forcedFailure: true, success: false });
  f.until(state => !state.windows?.length);
  expect(viewFor(f.game, 'A').self.faction).toBe(before.faction);
  expect(viewFor(f.game, 'A').self.protection).toEqual(before.protection);
  expect(f.game.players.A!.statuses?.some(status => status.kind === 'stopped') ?? false).toBe(false);
  expect(f.game.players.B!.damage).toBe(0);
  expect(f.game.discard.filter(id => id === 'a2-p02-r2c3')).toHaveLength(1);
  consumed(f.game, source);
});
it('Fear preserves the other declared target before one real death settlement and source disposal', () => {
  const f = fixture('mental-fear-six-shared');
  const source = physicalSource(f.game);
  f.until(state => viewFor(state, 'A').players.A!.pendingFatal);
  for (const actor of ['A', 'B', 'C', 'D']) expect(viewFor(f.game, actor).players.A).toMatchObject({ pendingFatal: true, presence: 'active', damage: 0 });
  expect(f.game.players.C!.damage).toBe(0);
  expect(f.game.discard).not.toContain(source);
  privateSource(f.game, fear, '恐怖');
  f.until(state => viewFor(state, 'A').lifecycleDecision?.kind === 'death-gift');
  expect(f.game.players.A!.presence).toBe('pending-death');
  expect(f.game.players.C!.damage).toBe(8);
  expect(viewFor(f.game, 'A').players.A!.pendingFatal).toBe(false);
  f.until(state => !state.windows?.length);
  expect(f.game.players.A!.presence).toBe('dead');
  expect(f.game.players.B!.damage).toBe(0);
  expect(f.game.players.C!.damage).toBe(8);
  const deaths = f.game.events.filter(event => event.type === 'PLAYER_DIED' && event.actorId === 'A');
  expect(deaths).toHaveLength(1);
  expect(deaths[0]!.death?.sourceActorId).toBe('B');
  expect(deaths[0]!.death?.sourceCardInstanceId).toBeUndefined();
  consumed(f.game, source);
});

it('a real death gift after Fear transfers only the chosen card and never duplicates the original attack', () => {
  const f = fixture('mental-fear-six-gift');
  const source = physicalSource(f.game);
  const giftCost = f.game.players.A!.hand.find(id => getAction(id)?.name === '「姫を頼む」')!;
  const gift = f.game.players.A!.hand.find(id => getAction(id)?.name === '必勝の祈り')!;
  expect(giftCost).toBeTruthy();
  expect(gift).toBeTruthy();
  f.until(state => viewFor(state, 'A').lifecycleDecision?.kind === 'death-gift' && viewFor(state, 'A').activeWindow?.pendingActorId === 'A');
  expect(f.game.players.C!.damage).toBe(8);
  f.act('A', { type: 'PLAY_DEATH_GIFT', cardInstanceId: giftCost, giftCardInstanceId: gift, targetId: 'D' });
  f.until(state => !state.windows?.length);
  expect(f.game.players.A!.presence).toBe('dead');
  expect(f.game.players.D!.hand.filter(id => id === gift)).toHaveLength(1);
  expect(f.game.discard.filter(id => id === giftCost)).toHaveLength(1);
  expect(f.game.discard).not.toContain(gift);
  for (const actor of ['B', 'C']) expect(JSON.stringify(viewFor(f.game, actor))).not.toContain(gift);
  consumed(f.game, source);
});
it('the mental stop persists past the defender turn and expires at the actual attacker next seat arrival', () => {
  const f = fixture('mental-lester-double');
  f.until(state => !state.windows?.length);
  const end = (actor: string) => f.act(actor, {
    type: 'END_TURN',
    discardIds: f.game.players[actor]!.hand.slice(0, Math.max(0, f.game.players[actor]!.hand.length - derivedStats(f.game.players[actor]!).handLimit)),
  });
  f.act('A', { type: 'PASS_WITHDRAWAL' });
  expect(f.game.seatOrder[f.game.turnSeat]).toBe('B');
  for (const actor of ['B', 'C', 'D']) {
    expect(f.game.players.A!.statuses?.some(status => status.timing === 'next-own-seat')).toBe(true);
    expect(f.game.seatOrder[f.game.turnSeat]).toBe(actor);
    f.act(actor, { type: 'START_TURN' });
    f.act(actor, { type: 'CHOOSE_DRAW', draw: false });
    f.act(actor, { type: 'PASS_ACTION' });
    end(actor);
  }
  expect(f.game.seatOrder[f.game.turnSeat]).toBe('A');
  expect(f.game.players.A!.statuses?.some(status => status.timing === 'next-own-seat') ?? false).toBe(false);
  f.act('A', { type: 'START_TURN' });
  expect(viewFor(f.game, 'A').currentRoll).toBeNull();
  expect(f.game.phase).toBe('draw');
});

async function savedRoom(name: MentalDefenseScenarioName) {
  const room = await openTestRoom(name);
  let sequence = 0;
  async function send(actorId: string, command: GameCommand) {
    const before = await room.stored();
    const envelope = {
      protocolVersion: 1 as const,
      commandId: `mental-${sequence++}`,
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
      if (!window) throw Error('MENTAL_DO_NO_WINDOW');
      await send(window.participants[window.cursor]!, { type: 'PASS' });
    }
    throw Error('MENTAL_DO_NOT_READY');
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
it('DO preserves an actual mental declaration and random roll through eviction and exact old receipt replay', async () => {
  const room = await savedRoom('mental-lester-choice');
  const source = physicalSource(room.initial);
  const receipt = await room.use('B', lester);
  await room.replay(receipt);
  privateSource((await room.stored()).state.game!, lester, '魔詩');
  await room.until(state => viewFor(state, 'A').currentRoll?.purpose === 'ability-check' && viewFor(state, 'A').currentRoll?.stage === 'after-roll');
  const roll = (await room.snapshotFor('A')).game!.currentRoll!;
  expect(roll).toMatchObject({ rollerId: 'A', modifier: -1, success: true });
  await room.replay(receipt);
  expect((await room.snapshotFor('A')).game!.currentRoll).toEqual(roll);
  await room.until(state => !state.windows?.length);
  await room.replay(receipt);
  const done = (await room.stored()).state.game!;
  const double = roll.faces![0] === roll.faces![1];
  expect(done.players.B!.damage).toBe(double ? 0 : 6);
  expect(done.players.A!.statuses?.some(status => status.timing === 'next-own-seat') ?? false).toBe(double);
  expect(done.rolls!.filter(value => value.purpose === 'ability-check')).toHaveLength(1);
  consumed(done, source);
});
it.each([
  { scenario: 'mental-lester-six', objective: 'EVILの全滅', faction: 'GOOD', protection: ['c2-p03-r1c2'] },
  { scenario: 'mental-dia-six', objective: 'ディアと敵対するものの全滅', faction: 'EVIL', protection: ['c2-p06-r1c2'] },
] as const)('DO $scenario restores saved dice and private replacement goals without repeating the source', async entry => {
  const room = await savedRoom(entry.scenario);
  const source = physicalSource(room.initial);
  const initial = (await room.snapshotFor('A')).game!;
  expect(initial.currentRoll!.faces).toEqual([6, 6]);
  const receipt = await room.send(initial.activeWindow!.pendingActorId!, { type: 'PASS' });
  const saved = (await room.snapshotFor('A')).game!.currentRoll;
  await room.replay(receipt);
  expect((await room.snapshotFor('A')).game!.currentRoll).toEqual(saved);
  await room.until(state => !state.windows?.length);
  await room.replay(receipt);
  const done = (await room.stored()).state.game!;
  const own = (await room.snapshotFor('A')).game!.self;
  expect(own).toMatchObject({ faction: entry.faction, objective: entry.objective, protection: { characterIds: entry.protection } });
  expect(viewFor(done, 'A').players.A!.statuses).toContainEqual({ kind: 'stopped', timing: 'next-own-seat', expiresOnActorId: 'A' });
  privateGoals(done);
  expect(done.players.B!.damage).toBe(0);
  consumed(done, source);
});
it.each([false, true])('DO Fear fatal intent survives eviction before other targets and death gift use=%s', async giftUsed => {
  const room = await savedRoom(giftUsed ? 'mental-fear-six-gift' : 'mental-fear-six-shared');
  const source = physicalSource(room.initial);
  const first = (await room.snapshotFor('A')).game!;
  const receipt = await room.send(first.activeWindow!.pendingActorId!, { type: 'PASS' });
  await room.until(state => viewFor(state, 'A').players.A!.pendingFatal);
  const pending = (await room.stored()).state.game!;
  expect(pending.players.C!.damage).toBe(0);
  expect(pending.discard).not.toContain(source);
  privateSource(pending, fear, '恐怖');
  await room.replay(receipt);
  expect((await room.snapshotFor('C')).game!.players.A).toMatchObject({ pendingFatal: true, presence: 'active' });
  await room.until(state => viewFor(state, 'A').lifecycleDecision?.kind === 'death-gift' && viewFor(state, 'A').activeWindow?.pendingActorId === 'A');
  await room.replay(receipt);
  const atDeath = (await room.stored()).state.game!;
  expect(atDeath.players.C!.damage).toBe(8);
  expect(viewFor(atDeath, 'A').players.A).toMatchObject({ pendingFatal: false, presence: 'pending-death' });
  const giftCost = atDeath.players.A!.hand.find(id => getAction(id)?.name === '「姫を頼む」');
  const gift = atDeath.players.A!.hand.find(id => getAction(id)?.name === '必勝の祈り');
  const deathReceipt = await room.send('A', giftUsed
    ? { type: 'PLAY_DEATH_GIFT', cardInstanceId: giftCost!, giftCardInstanceId: gift!, targetId: 'D' }
    : { type: 'PASS' });
  await room.replay(deathReceipt);
  await room.until(state => !state.windows?.length);
  await room.replay(receipt);
  await room.replay(deathReceipt);
  const done = (await room.stored()).state.game!;
  expect(done.players.A!.presence).toBe('dead');
  expect(done.players.B!.damage).toBe(0);
  expect(done.players.C!.damage).toBe(8);
  const deaths = done.events.filter(event => event.type === 'PLAYER_DIED' && event.actorId === 'A');
  expect(deaths).toHaveLength(1);
  expect(deaths[0]!.death?.sourceActorId).toBe('B');
  expect(deaths[0]!.death?.sourceCardInstanceId).toBeUndefined();
  if (giftUsed) {
    expect(done.players.D!.hand.filter(id => id === gift)).toHaveLength(1);
    expect(done.discard.filter(id => id === giftCost)).toHaveLength(1);
    expect(done.discard).not.toContain(gift);
    for (const actor of ['B', 'C']) expect(JSON.stringify(viewFor(done, actor))).not.toContain(gift);
  }
  consumed(done, source);
});
