import { getAction } from '@madou/catalog';
import type { ConditionalAbilityId } from '@madou/protocol';
import { reset } from 'cloudflare:test';
import { openTestRoom } from './fixtures/recovery-room.js';
import { makeScenario } from './fixtures/game-scenarios.js';
import { activeWindowRef, allCardInstanceIds, viewFor, type GameCommand, type GameState } from '@madou/engine';
import { afterEach, expect, it } from 'vitest';
import { conditionalScenarioNames, conditionalScenarioSpecs, makeConditionalScenario } from './fixtures/conditional-ability-scenarios.js';

it.each(conditionalScenarioNames)('%s conserves the actual deck and leaves all new conditional sources unselected', name => {
  const game = makeConditionalScenario(name, ['A', 'B', 'C', 'D'].map(id => ({ id, name: id })));
  const ids = allCardInstanceIds(game); expect(ids).toHaveLength(220); expect(new Set(ids).size).toBe(220);
  const spec = conditionalScenarioSpecs[name]; const owner = 'ownerSeat' in spec ? 'B' : 'A';
  expect(viewFor(game, owner).conditionalAbilities.length).toBeGreaterThan(0);
  for (const setting of viewFor(game, owner).conditionalAbilities) expect(setting.enabled).toBe(false);
  if (name === 'conditional-asfelt-truth') expect(game.players.A!.faction).toBe('GOOD');
  if (name === 'conditional-lia-lance-ii') expect(game.players.B!.characterId).toBe('c2-p07-r1c1');
  if (name === 'conditional-asfelt-dragon') expect(game.players.B!.followers).toHaveLength(1);
});

afterEach(async () => { await reset(); });
it.each(conditionalScenarioNames)('%s is registered with the browser scenario factory', name => {
  expect(makeScenario(name, ['A', 'B', 'C', 'D'].map(id => ({ id, name: id })))).toEqual(makeConditionalScenario(name, ['A', 'B', 'C', 'D'].map(id => ({ id, name: id }))));
});

const TIA = 'c2-p02-r1c1-ab04', LIA = 'c2-p03-r1c2-ab03', ARNES = 'c2-p03-r2c2-ab04';
const DRAGON = 'c2-p04-r1c2-ab03', TRUTH = 'c2-p04-r1c2-ab05', UPA = 'c2-p05-r1c2-ab01';
const GARWIN = 'c2-p05-r2c1-ab05', DIA = 'c2-p06-r1c2-ab02';
const acceptance = [
  { scenario: 'conditional-tia-public', abilityId: TIA, owner: 'A', spirit: 1 },
  { scenario: 'conditional-lia-public', abilityId: LIA, owner: 'A', spirit: 2 },
  { scenario: 'conditional-arnes-defense', abilityId: ARNES, owner: 'B', spirit: 2 },
  { scenario: 'conditional-asfelt-dragon', abilityId: DRAGON, owner: 'B', spirit: 0 },
  { scenario: 'conditional-asfelt-truth', abilityId: TRUTH, owner: 'A', spirit: 1 },
  { scenario: 'conditional-upa-attack', abilityId: UPA, owner: 'A', spirit: 0 },
  { scenario: 'conditional-garwin-rival', abilityId: GARWIN, owner: 'A', spirit: 2 },
  { scenario: 'conditional-dia-public', abilityId: DIA, owner: 'A', spirit: 0 },
] as const;
async function savedRoom(scenario: typeof conditionalScenarioNames[number]) {
  const room = await openTestRoom(scenario); let sequence = 0;
  const game = async () => (await room.stored()).state.game!;
  async function send(actorId: string, command: GameCommand) {
    const before = await room.stored();
    const envelope = { protocolVersion: 1 as const, commandId: `conditional-${sequence++}`, expectedRevision: before.revision, ...activeWindowRef(before.state.game!), command };
    const ack = await room.command(actorId, envelope); expect(ack, JSON.stringify(command)).toMatchObject({ type: 'ack' });
    const ids = allCardInstanceIds(await game()); expect(ids).toHaveLength(220); expect(new Set(ids).size).toBe(220);
    return { actorId, envelope, ack };
  }
  async function until(done: (state: GameState) => boolean) {
    for (let step = 0; step < 1000; step++) {
      const state = await game(); if (done(state)) return;
      const window = state.windows?.at(-1); if (!window) throw Error('CONDITIONAL_DO_NO_WINDOW');
      await send(window.participants[window.cursor]!, { type: 'PASS' });
    }
    throw Error('CONDITIONAL_DO_NOT_READY');
  }
  async function set(actor: string, abilityId: ConditionalAbilityId, enabled = true, targetIds?: string[]) {
    const option = (await room.snapshotFor(actor)).game!.conditionalAbilities.find(option => option.abilityId === abilityId)!;
    return send(actor, { type: 'SET_CONDITIONAL_ABILITY', abilityId, targetEventId: option.targetEventId!, enabled, ...(abilityId === LIA && enabled ? { targetIds: targetIds ?? ['B'] } : {}) });
  }
  async function replay(receipt: Awaited<ReturnType<typeof send>>) {
    const before = await room.stored(); await room.restart();
    expect(await room.command(receipt.actorId, receipt.envelope)).toEqual(receipt.ack);
    expect(await room.stored()).toEqual(before);
  }
  const choice = async (actor: string, abilityId: string) => (await room.snapshotFor(actor)).game!.conditionalAbilities.find(option => option.abilityId === abilityId)!;
  return { ...room, game, send, until, set, replay, choice };
}
it.each(acceptance)('DO $scenario ON persists, retries exactly once, and OFF removes its numeric contribution', async entry => {
  const room = await savedRoom(entry.scenario); const base = viewFor(room.initial, entry.owner).self.stats;
  const receipt = await room.set(entry.owner, entry.abilityId); await room.replay(receipt);
  await room.until(state => viewFor(state, entry.owner).conditionalAbilities.find(x => x.abilityId === entry.abilityId)!.enabled);
  await room.replay(receipt);
  const own = (await room.snapshotFor(entry.owner)).game!;
  expect(own.self.stats.spirit).toBe(base.spirit + entry.spirit);
  expect(own.self.stats.handLimit).toBe(base.handLimit + (entry.abilityId === DIA ? 2 : 0));
  for (const actor of ['A', 'B', 'C', 'D'].filter(id => id !== entry.owner)) {
    const other = (await room.snapshotFor(actor)).game!;
    expect(other.conditionalAbilities.some(x => x.abilityId === entry.abilityId)).toBe(false);
    expect(JSON.stringify(other)).not.toContain('conditionalSelections');
  }
  await room.until(state => viewFor(state, entry.owner).conditionalAbilities.find(x => x.abilityId === entry.abilityId)!.canDeactivate);
  const off = await room.set(entry.owner, entry.abilityId, false); await room.replay(off);
  expect(await room.choice(entry.owner, entry.abilityId)).toMatchObject({ enabled: false });
  expect((await room.snapshotFor(entry.owner)).game!.self.stats).toEqual(base);
}, 20000);
it.each(acceptance)('DO $scenario non-use keeps the saved original stats and election OFF after eviction', async entry => {
  const room = await savedRoom(entry.scenario); const before = await room.stored();
  await room.restart();
  expect(await room.stored()).toEqual(before);
  expect(await room.choice(entry.owner, entry.abilityId)).toMatchObject({ enabled: false });
  expect((await room.snapshotFor(entry.owner)).game!.self.stats).toEqual(viewFor(room.initial, entry.owner).self.stats);
});
it.each(acceptance)('DO $scenario cancellation rejects the beneficial election but spends its attempt', async entry => {
  const room = await savedRoom(entry.scenario); const before = viewFor(room.initial, entry.owner).self.stats;
  await room.set(entry.owner, entry.abilityId);
  await room.until(state => viewFor(state, 'D').activeWindow?.pendingActorId === 'D');
  const targetAbilityId = (await room.snapshotFor('D')).game!.reactionTargetAbilityId!;
  const receipt = await room.send('D', { type: 'PLAY_REACTION', cardInstanceId: 'a2-p02-r2c3', mode: 'cancel-ability', targetAbilityId });
  await room.replay(receipt);
  await room.until(state => !state.windows?.length || state.windows.at(-1)!.kind === 'normal-defense');
  expect(await room.choice(entry.owner, entry.abilityId)).toMatchObject({ enabled: false, canActivate: false });
  expect((await room.snapshotFor(entry.owner)).game!.self.stats).toEqual(before);
  expect((await room.game()).discard.filter(id => id === 'a2-p02-r2c3')).toHaveLength(1);
}, 20000);
it('DO hidden Lester becomes public through REVEAL and activates the persisted Tia election', async () => {
  const room = await savedRoom('conditional-tia-hidden'); const base = viewFor(room.initial, 'A').self.stats.spirit;
  await room.set('A', TIA); await room.until(state => !state.windows?.length);
  expect((await room.snapshotFor('A')).game!.self.stats.spirit).toBe(base);
  expect(JSON.stringify(await room.snapshotFor('A'))).not.toContain(room.initial.players.B!.characterId);
  await room.send('B', { type: 'REVEAL_CHARACTER' }); await room.until(state => !state.windows?.length); await room.restart();
  expect((await room.snapshotFor('A')).game!.self.stats.spirit).toBe(base + 1);
});
it.each(['conditional-lia-hidden', 'conditional-lia-lance-ii'] as const)('DO %s applies actual Lance identity and the separate public aura condition', async scenario => {
  const room = await savedRoom(scenario); const a = viewFor(room.initial, 'A').self.stats.spirit, b = viewFor(room.initial, 'B').self.stats.spirit;
  await room.set('A', LIA); await room.until(state => !state.windows?.length); await room.restart();
  expect((await room.snapshotFor('A')).game!.self.stats.spirit).toBe(a + 2);
  expect((await room.snapshotFor('B')).game!.self.stats.spirit).toBe(b + (scenario === 'conditional-lia-hidden' ? 0 : 1));
  if (scenario === 'conditional-lia-lance-ii') expect((await room.game()).players.B!.characterId).toBe('c2-p07-r1c1');
});
it('DO Lia rejects forged hidden targets without changing state, then cancels an update without erasing its old subset', async () => {
  const room = await savedRoom('conditional-lia-public'); const initial = await room.stored();
  const option = await room.choice('A', LIA);
  expect(option.eligibleTargetIds).not.toContain('C');
  const error = await room.command('A', { protocolVersion: 1, commandId: 'forged-hidden', expectedRevision: initial.revision,
    ...activeWindowRef(initial.state.game!), command: { type: 'SET_CONDITIONAL_ABILITY', abilityId: LIA, targetEventId: option.targetEventId!, enabled: true, targetIds: ['C'] } });
  expect(error).toMatchObject({ type: 'error' }); expect(await room.stored()).toEqual(initial);
  await room.set('A', LIA); await room.until(state => !state.windows?.length);
  await room.send('C', { type: 'REVEAL_CHARACTER' }); await room.until(state => !state.windows?.length);
  expect(await room.choice('A', LIA)).toMatchObject({ selectedTargetIds: ['B'] });
  await room.send('A', { type: 'PASS_ACTION' }); await room.set('A', LIA, true, ['C']);
  await room.until(state => viewFor(state, 'D').activeWindow?.pendingActorId === 'D');
  const receipt = await room.send('D', { type: 'PLAY_REACTION', cardInstanceId: 'a2-p02-r2c3', mode: 'cancel-ability', targetAbilityId: (await room.snapshotFor('D')).game!.reactionTargetAbilityId! });
  await room.replay(receipt); await room.until(state => !state.windows?.length); await room.restart();
  expect(await room.choice('A', LIA)).toMatchObject({ enabled: true, selectedTargetIds: ['B'] });
  const state = await room.game();
  expect(viewFor(state, 'B').self.stats.spirit).toBe(viewFor(room.initial, 'B').self.stats.spirit + 1);
  expect(viewFor(state, 'C').self.stats.spirit).toBe(viewFor(room.initial, 'C').self.stats.spirit);
}, 20000);

it.each([
  { scenario: 'conditional-arnes-attack', abilityId: ARNES, spirit: 2, damage: 0 },
  { scenario: 'conditional-upa-attack', abilityId: UPA, spirit: 1, damage: 1 },
] as const)('DO $scenario applies attack-only spirit and warrior damage to the actual paid attack', async entry => {
  const room = await savedRoom(entry.scenario); const base = viewFor(room.initial, 'A').self.stats.spirit;
  const attack = room.initial.players.A!.hand.find(id => getAction(id)!.name === '破黒剣')!;
  await room.set('A', entry.abilityId); await room.until(state => !state.windows?.length);
  expect((await room.snapshotFor('A')).game!.self.stats.spirit).toBe(base);
  await room.send('A', { type: 'ATTACK', cardInstanceId: attack, targetIds: ['B'], dedicated: false });
  await room.until(state => state.windows?.at(-1)?.kind === 'normal-defense');
  const current = (await room.snapshotFor('A')).game!;
  expect(current.self.stats.spirit).toBe(base + entry.spirit);
  expect(current.currentAttack!.technique.damage).toBe(5 + entry.damage);
  await room.until(state => !state.windows?.length);
  expect((await room.snapshotFor('A')).game!.self.stats.spirit).toBe(base);
  expect((await room.game()).players.B!.damage).toBe(5 + entry.damage);
}, 20000);
it('DO Dragon morale freezes the elected +2 in the saved real dragon roll', async () => {
  const room = await savedRoom('conditional-asfelt-dragon'); const base = viewFor(room.initial, 'B').self.stats.spirit;
  await room.set('B', DRAGON); await room.until(state => state.windows?.at(-1)?.kind === 'before-roll' && state.rolls?.at(-1)?.purpose === 'follower-morale');
  const rollId = (await room.game()).rolls!.at(-1)!.id;
  await room.until(state => state.rolls!.find(roll => roll.id === rollId)!.stage === 'after-roll');
  const roll = (await room.game()).rolls!.find(roll => roll.id === rollId)!;
  expect(roll.threshold).toBe(base + roll.modifier + 2);
  await room.restart(); expect((await room.game()).rolls!.find(item => item.id === rollId)).toEqual(roll);
}, 20000);
it.each([{ target: 'B', effect: 4, damage: 5 }, { target: 'C', effect: 5, damage: 7 }, { target: 'D', effect: 5, damage: 7 }])('DO Truth freezes exact values against public target $target', async entry => {
  const room = await savedRoom('conditional-asfelt-truth');
  const attack = room.initial.players.A!.hand.find(id => getAction(id)!.name === '破黒剣')!;
  await room.set('A', TRUTH); await room.until(state => !state.windows?.length);
  await room.send('A', { type: 'ATTACK', cardInstanceId: attack, targetIds: [entry.target], dedicated: false });
  await room.until(state => state.windows?.at(-1)?.kind === 'normal-defense');
  const current = (await room.snapshotFor('A')).game!.currentAttack!;
  expect(current.technique).toMatchObject({ effectLevel: entry.effect, damage: entry.damage });
  await room.until(state => !state.windows?.length);
  expect((await room.game()).players[entry.target]!.damage).toBe(entry.damage);
}, 20000);
it('DO Dia capacity loss keeps eight physical cards until END and saves the exact discard choice once', async () => {
  const room = await savedRoom('conditional-dia-public');
  expect(room.initial.players.A!.hand).toHaveLength(8);
  await room.set('A', DIA); await room.until(state => !state.windows?.length);
  expect((await room.snapshotFor('A')).game!.self.stats.handLimit).toBe(8);
  await room.send('A', { type: 'PASS_ACTION' });
  const off = await room.set('A', DIA, false); await room.replay(off);
  expect((await room.snapshotFor('A')).game!.self.stats.handLimit).toBe(6);
  const hand = [...(await room.game()).players.A!.hand]; expect(hand).toHaveLength(8);
  await room.restart(); expect((await room.game()).players.A!.hand).toEqual(hand);
  const before = await room.stored();
  expect(await room.command('A', { protocolVersion: 1, commandId: 'bad-end', expectedRevision: before.revision, ...activeWindowRef(before.state.game!), command: { type: 'END_TURN', discardIds: [] } })).toMatchObject({ type: 'error' });
  expect(await room.stored()).toEqual(before);
  const discardIds = hand.slice(0, 2); const receipt = await room.send('A', { type: 'END_TURN', discardIds }); await room.replay(receipt);
  await room.until(state => !state.windows?.length); await room.replay(receipt);
  expect((await room.game()).players.A!.hand).toEqual(hand.slice(2));
  for (const id of discardIds) expect((await room.game()).discard.filter(card => card === id)).toHaveLength(1);
}, 20000);
it('DO Arnes defense check freezes spirit against the actual revealed male attacker', async () => {
  const room = await savedRoom('conditional-arnes-defense'); const base = viewFor(room.initial, 'B').self.stats.spirit;
  await room.set('B', ARNES); await room.until(state => state.windows?.at(-1)?.kind === 'normal-defense');
  const defense = (await room.game()).players.B!.hand.find(id => getAction(id)!.name === '転移')!;
  await room.send('B', { type: 'PLAY_DEFENSE', cardInstanceId: defense, dedicated: false });
  await room.until(state => state.windows?.at(-1)?.kind === 'after-roll');
  expect((await room.game()).rolls!.at(-1)!.threshold).toBe(base + 2);
  await room.restart(); expect((await room.game()).rolls!.at(-1)!.threshold).toBe(base + 2);
}, 20000);
it('DO hidden Dia reserves its choice without adding capacity until actual reveal', async () => {
  const room = await savedRoom('conditional-dia-hidden');
  await room.set('A', DIA); await room.until(state => !state.windows?.length);
  expect((await room.snapshotFor('A')).game!.self.stats.handLimit).toBe(6);
  await room.send('A', { type: 'REVEAL_CHARACTER' }); await room.until(state => !state.windows?.length);
  expect((await room.snapshotFor('A')).game!.self.stats.handLimit).toBe(8);
});
it('DO Truth flying-dragon preview and saved multi-target attack agree for every target', async () => {
  const room = await savedRoom('conditional-asfelt-truth');
  await room.set('A', TRUTH); await room.until(state => !state.windows?.length);
  const option = (await room.snapshotFor('A')).game!.followerAttackOptions.find(option => option.cardInstanceId === 'a2-p22-r3c1')!;
  expect(option.targetValues).toEqual([
    { actorId: 'B', effectLevel: 6, damage: 9 }, { actorId: 'C', effectLevel: 7, damage: 11 }, { actorId: 'D', effectLevel: 7, damage: 11 },
  ]);
  await room.send('A', { type: 'ATTACK', cardInstanceId: option.cardInstanceId, targetIds: option.legalTargetIds, dedicated: true });
  for (const target of option.targetValues!) {
    await room.until(state => viewFor(state, 'A').currentAttack?.targetId === target.actorId && state.windows?.at(-1)?.kind === 'normal-defense');
    expect((await room.snapshotFor('A')).game!.currentAttack!.technique).toMatchObject({ effectLevel: target.effectLevel, damage: target.damage });
    await room.send(target.actorId, { type: 'PASS' });
  }
  await room.until(state => !state.windows?.length);
}, 20000);
it('DO Upa bundle preview and real source hits retain warrior addition without modifying magic damage', async () => {
  const room = await savedRoom('conditional-upa-attack');
  await room.set('A', UPA); await room.until(state => !state.windows?.length);
  const option = (await room.snapshotFor('A')).game!.followerBundleOptions.find(option => option.abilityId === 'c2-p05-r1c2-ab02')!;
  expect(option.sources.find(source => source.cardInstanceId === 'a2-p20-r3c1' && !source.dedicated)).toMatchObject({ damage: 9 });
  const dragon = option.sources.find(source => source.cardInstanceId === 'a2-p22-r2c2')!; expect(dragon.damage).toBe(12);
  await room.send('A', { type: 'USE_FOLLOWER_ATTACK', abilityId: option.abilityId, targetEventId: option.targetEventId, sources: [
    { cardInstanceId: 'a2-p20-r3c1', dedicated: false, targetIds: ['B'] }, { cardInstanceId: dragon.cardInstanceId, dedicated: false, targetIds: dragon.legalTargetIds },
  ] });
  await room.until(state => state.windows?.at(-1)?.kind === 'normal-defense');
  expect((await room.snapshotFor('A')).game!.currentAttack!.technique.damage).toBe(9);
  await room.until(state => viewFor(state, 'A').currentAttack?.technique.damage === 12 && state.windows?.at(-1)?.kind === 'normal-defense');
  await room.restart(); expect((await room.snapshotFor('A')).game!.currentAttack!.technique.damage).toBe(12);
  await room.until(state => !state.windows?.length);
  expect((await room.game()).discard).toEqual(expect.arrayContaining(['a2-p20-r3c1', 'a2-p22-r2c2']));
}, 20000);
