import { reset } from 'cloudflare:test';
import { afterEach, expect, it } from 'vitest';
import { activeWindowRef, allCardInstanceIds, transition, viewFor, type GameCommand, type GameState } from '@madou/engine';
import { makeRollingDefenseScenario, type RollingDefenseScenarioName } from './fixtures/rolling-defense-scenarios.js';
import { entropy } from './fixtures/scenario-tools.js';
import { openTestRoom } from './fixtures/recovery-room.js';

afterEach(async () => { await reset(); });
const half = 'c2-p03-r1c1-ab02'; const grace = 'c2-p03-r1c2-ab01'; const shield = 'c2-p07-r1c1-ab01'; const majesty = 'c2-p05-r2c2-ab02';
const cases = [
  { name: 'defense-half', level: 5, damage: 6, ability: half },
  { name: 'defense-half-odd', level: 5, damage: 7, ability: half },
  { name: 'defense-half-resistance', level: 5, damage: null, ability: half },
  { name: 'defense-half-shared', level: 6, damage: 8, ability: half },
  { name: 'defense-grace-zero', level: 1, damage: 2, ability: grace },
  { name: 'defense-grace-residual', level: 8, damage: 10, ability: grace },
  { name: 'defense-shield', level: 5, damage: 6, ability: shield },
  { name: 'defense-majesty', level: 5, damage: 6, ability: majesty },
  { name: 'defense-majesty-prohibited', level: 2, damage: 2, ability: null },
] as const;
function cards(game: GameState) { const ids = allCardInstanceIds(game); expect(ids).toHaveLength(220); expect(new Set(ids).size).toBe(220); }
function fixture(name: RollingDefenseScenarioName) {
  let game = makeRollingDefenseScenario(name, ['A', 'B', 'C', 'D'].map(id => ({ id, name: id })));
  function act(actorId: string, command: GameCommand, dice?: number[]) {
    const input = { actorId, command }; const random = { ...entropy(), ...(dice ? { dice } : {}) }; const result = transition(game, input, random);
    expect(result.ok).toBe(true); if (!result.ok) throw Error(result.code);
    expect(transition(JSON.parse(JSON.stringify(game)), input, random)).toEqual(result); game = result.state; cards(game);
  }
  function until(done: (state: GameState) => boolean, dice?: number[]) {
    for (let i = 0; i < 500; i++) {
      if (done(game)) return;
      const window = game.windows?.at(-1); if (!window) throw Error('ROLLING_DEFENSE_WINDOW_MISSING');
      act(window.participants[window.cursor]!, { type: 'PASS' }, dice);
    }
    throw Error('ROLLING_DEFENSE_WINDOW_NOT_REACHED');
  }
  function use(abilityId: string) {
    const option = viewFor(game, 'B').abilityOptions.find(option => option.abilityId === abilityId); expect(option).toBeDefined();
    act('B', { type: 'USE_ABILITY', abilityId, targetEventId: option!.targetEventId }); return option!.targetEventId;
  }
  return { get game() { return game; }, act, until, use };
}
function attackCard(game: GameState) {
  const action = viewFor(game, 'A').currentAction;
  expect(action).toMatchObject({ source: 'card', actorId: 'A', sourceZone: 'hand' });
  if (!action || action.source !== 'card') throw Error('ROLLING_SOURCE_MISSING'); return action.cardInstanceId;
}
function consumed(game: GameState, id: string) {
  expect(game.discard.filter(card => card === id)).toHaveLength(1); expect(game.players.A!.hand).not.toContain(id);
  expect(game.players.A!.chants.map(card => card.cardInstanceId)).not.toContain(id); expect(game.players.A!.followers.map(card => card.cardInstanceId)).not.toContain(id);
}
function concealed(game: GameState, id: string, name: string) {
  expect(game.players.B!.revealed).toBe(false);
  for (const actor of ['A', 'C', 'D']) { const json = JSON.stringify(viewFor(game, actor)); expect(json).not.toContain(id); expect(json).not.toContain(name); }
}
function rejectSpent(f: ReturnType<typeof fixture>, abilityId: string, targetEventId: string) {
  const before = structuredClone(f.game);
  expect(transition(f.game, { actorId: 'B', command: { type: 'USE_ABILITY', abilityId, targetEventId } }, entropy())).toMatchObject({ ok: false, code: 'ABILITY_DISABLED' });
  expect(f.game).toEqual(before);
}
function forceFailure(f: ReturnType<typeof fixture>, purpose: string) {
  f.until(state => viewFor(state, 'B').currentRoll?.purpose === purpose && viewFor(state, 'B').currentRoll?.stage === 'after-roll' && viewFor(state, 'C').activeWindow?.pendingActorId === 'C');
  f.act('C', { type: 'PLAY_REACTION', cardInstanceId: 'a2-p02-r2c3', mode: 'force-fail', targetRollId: viewFor(f.game, 'B').currentRoll!.rollId });
}
it.each(cases)('$name starts with the actual source, unselected ability and no frozen body damage', entry => {
  const f = fixture(entry.name); const view = viewFor(f.game, 'B');
  expect(view.currentAttack!.technique).toMatchObject({ effectLevel: entry.level, damage: entry.damage });
  expect(view.currentAttack!.targets[0]!.hits[0]!.bodyDamage).toBeUndefined();
  if (entry.ability) expect(view.abilityOptions.map(option => option.abilityId)).toContain(entry.ability);
  else { expect(view.abilityOptions.map(option => option.abilityId)).not.toContain(majesty); expect(view.currentAttack!.defenseRestrictions.counterProhibited).toBe(true); }
  if (entry.name === 'defense-shield') {
    expect(f.game.players.B!.characterId).toBe('c2-p07-r1c1'); expect(f.game.players.B!.abilityCharacterIds).toEqual(['c2-p02-r2c2', 'c2-p07-r1c1']);
    expect(view.abilityOptions.map(option => option.abilityId)).toContain('c2-p02-r2c2-ab01');
  }
  cards(f.game);
});

for (const selected of [false, true]) it.each(['defense-half', 'defense-half-odd'] as const)('%s half selected=' + selected + ' applies after actual Soldier HP with final rounding', name => {
  const f = fixture(name); const source = attackCard(f.game);
  const event = viewFor(f.game, 'B').abilityOptions.find(option => option.abilityId === half)!.targetEventId;
  if (selected) { f.use(half); concealed(f.game, half, '魔法抵抗'); }
  f.until(state => state.windows?.at(-1)?.kind === 'follower-start'); rejectSpent(f, half, event);
  f.until(state => viewFor(state, 'A').followerDefenseResults.some(result => result.cardInstanceId === 'a2-p18-r3c3'));
  expect(viewFor(f.game, 'A').followerDefenseResults[0]!.hits[0]!.hpReduction).toBe(1);
  f.until(state => !state.windows?.length);
  const raw = name === 'defense-half' ? 5 : 6; expect(f.game.players.B!.damage).toBe(selected ? Math.floor(raw / 2) : raw); consumed(f.game, source);
});
it('half applies to actual resistance-failure damage without inventing direct damage for Phantom Arrow', () => {
  const f = fixture('defense-half-resistance'); const source = attackCard(f.game); f.use(half);
  forceFailure(f, 'status-resistance');
  f.until(state => !state.windows?.length);
  expect(f.game.players.B!.damage).toBe(5); expect(f.game.discard.filter(id => id === 'a2-p02-r2c3')).toHaveLength(1); consumed(f.game, source);
});
it('public body damage freezes for Lamba while the other target still has its own hit continuation', () => {
  const f = fixture('defense-half-shared'); const source = attackCard(f.game); f.use(half);
  f.until(state => !!viewFor(state, 'B').currentAttack?.targets[0]!.hits[0]!.bodyDamage);
  const attack = viewFor(f.game, 'B').currentAttack!;
  expect(attack.targets[0]!.hits[0]).toMatchObject({ technique: { damage: 7 }, bodyDamage: { directDamage: 3, resistanceDamage: 0, total: 3 } });
  expect(attack.targets[1]!.hits[0]!.bodyDamage).toBeUndefined();
  for (const actor of ['A', 'C', 'D']) expect(viewFor(f.game, actor).currentAttack).toEqual(attack);
  f.until(state => !state.windows?.length); expect(f.game.players.B!.damage).toBe(3); expect(f.game.players.C!.damage).toBe(8); consumed(f.game, source);
});
it.each(['defense-grace-zero', 'defense-grace-residual'] as const)('%s saves the actual check and separate d6 before applying only the received value', name => {
  const f = fixture(name); const source = attackCard(f.game); const event = f.use(grace); concealed(f.game, grace, '光の加護');
  f.until(state => viewFor(state, 'B').currentRoll?.purpose === 'ability-check' && viewFor(state, 'B').currentRoll?.stage === 'after-roll');
  const check = viewFor(f.game, 'B').currentRoll!; expect(check.faces).toEqual([1, 1]); expect(check.modifier).toBe(-3);
  f.until(state => viewFor(state, 'B').currentRoll?.purpose === 'ability-value' && viewFor(state, 'B').currentRoll?.stage === 'after-roll', [1, 1, 1]);
  expect(viewFor(f.game, 'B').currentRoll!.faces).toEqual([1]); expect(viewFor(f.game, 'B').currentRoll!.rollId).not.toBe(check.rollId);
  if (name === 'defense-grace-residual') {
    f.until(state => state.windows?.at(-1)?.kind === 'normal-defense');
    expect(viewFor(f.game, 'B').currentAttack!.technique).toMatchObject({ effectLevel: 7, damage: 10 }); rejectSpent(f, grace, event);
  }
  f.until(state => !state.windows?.length); expect(f.game.players.B!.damage).toBe(name === 'defense-grace-zero' ? 0 : 10); consumed(f.game, source);
});
it('a forced failed Grace check creates no reduction die or immunity and cannot be tried again', () => {
  const f = fixture('defense-grace-zero'); const source = attackCard(f.game); const event = f.use(grace);
  forceFailure(f, 'ability-check'); f.until(state => state.windows?.at(-1)?.kind === 'normal-defense');
  expect(f.game.rolls?.filter(roll => roll.purpose === 'ability-value')).toEqual([]);
  expect(viewFor(f.game, 'B').currentAttack!.technique.effectLevel).toBe(1); rejectSpent(f, grace, event);
  f.until(state => !state.windows?.length); expect(f.game.players.B!.damage).toBe(2); consumed(f.game, source);
});
for (const failed of [false, true]) it('actual transformed Light Shield failed=' + failed + ' stays separate from inherited armor', () => {
  const f = fixture('defense-shield'); const source = attackCard(f.game); const event = f.use(shield);
  if (failed) {
    forceFailure(f, 'ability-check'); f.until(state => state.windows?.at(-1)?.kind === 'normal-defense'); rejectSpent(f, shield, event);
    expect(viewFor(f.game, 'B').abilityOptions.map(option => option.abilityId)).toContain('c2-p02-r2c2-ab01');
  }
  f.until(state => !state.windows?.length); expect(f.game.players.B!.damage).toBe(failed ? 6 : 0); consumed(f.game, source);
});
it('Majesty reflects the copied original source without consuming a fictitious card and gives its attacker a defense', () => {
  const f = fixture('defense-majesty'); const source = attackCard(f.game); const bHand = [...f.game.players.B!.hand];
  f.use(majesty); concealed(f.game, majesty, '魔導王の威厳');
  f.until(state => !!viewFor(state, 'A').currentAttack?.reflection);
  const attack = viewFor(f.game, 'A').currentAttack!;
  expect(attack.reflection).toEqual({ source: 'ability', actorId: 'B', sourceCardInstanceId: source });
  expect(attack.technique).toMatchObject({ effectLevel: 5, damage: 6 }); expect(attack.targetId).toBe('A'); concealed(f.game, majesty, '魔導王の威厳');
  expect(f.game.players.B!.hand).toEqual(bHand);
  f.act('A', { type: 'PLAY_DEFENSE', cardInstanceId: 'a2-p05-r3c1', dedicated: false });
  f.until(state => !state.windows?.length); expect(f.game.players.A!.damage).toBe(0); expect(f.game.players.B!.damage).toBe(0);
  expect(f.game.discard.filter(id => id === 'a2-p05-r3c1')).toHaveLength(1); consumed(f.game, source);
});
it('a failed Majesty check leaves the original incoming hit and no reflected child', () => {
  const f = fixture('defense-majesty'); const source = attackCard(f.game); const event = f.use(majesty);
  forceFailure(f, 'ability-check'); f.until(state => state.windows?.at(-1)?.kind === 'normal-defense');
  expect(viewFor(f.game, 'A').currentAttack!.reflection).toBeUndefined(); rejectSpent(f, majesty, event);
  f.until(state => !state.windows?.length); expect(f.game.players.B!.damage).toBe(6); expect(f.game.players.A!.damage).toBe(0); consumed(f.game, source);
});
it('an actual dedicated Skeleton attack prohibits Majesty but still resolves the unchosen armor path', () => {
  const f = fixture('defense-majesty-prohibited'); const source = attackCard(f.game);
  expect(viewFor(f.game, 'B').abilityOptions.map(option => option.abilityId)).not.toContain(majesty);
  f.until(state => !state.windows?.length); expect(f.game.players.B!.damage).toBe(2); consumed(f.game, source);
});

it.each([
  { scenario: 'defense-half', id: half, name: '魔法抵抗', damage: 5 },
  { scenario: 'defense-grace-zero', id: grace, name: '光の加護', damage: 2 },
  { scenario: 'defense-majesty', id: majesty, name: '魔導王の威厳', damage: 6 },
] as const)('$name cancellation spends the attempt and keeps its identity private through the actual reaction', entry => {
  const f = fixture(entry.scenario); const source = attackCard(f.game); const event = f.use(entry.id);
  f.until(state => viewFor(state, 'C').activeWindow?.pendingActorId === 'C' && !!viewFor(state, 'C').reactionTargetAbilityId);
  concealed(f.game, entry.id, entry.name);
  f.act('C', { type: 'PLAY_REACTION', cardInstanceId: 'a2-p02-r2c3', mode: 'cancel-ability', targetAbilityId: viewFor(f.game, 'C').reactionTargetAbilityId! });
  concealed(f.game, entry.id, entry.name);
  f.until(state => state.windows?.at(-1)?.kind === 'normal-defense'); rejectSpent(f, entry.id, event);
  expect(f.game.rolls?.filter(roll => roll.purpose === 'ability-check' || roll.purpose === 'ability-value') ?? []).toEqual([]);
  expect(viewFor(f.game, 'A').currentAttack!.reflection).toBeUndefined();
  f.until(state => !state.windows?.length); expect(f.game.players.B!.damage).toBe(entry.damage);
  expect(f.game.discard.filter(id => id === 'a2-p02-r2c3')).toHaveLength(1); consumed(f.game, source);
});

async function savedRoom(name: RollingDefenseScenarioName) {
  const room = await openTestRoom(name); let sequence = 0;
  async function send(actorId: string, command: GameCommand) {
    const before = await room.stored();
    const envelope = { protocolVersion: 1 as const, commandId: `rolling-${sequence++}`, expectedRevision: before.revision, ...activeWindowRef(before.state.game!), command };
    const ack = await room.command(actorId, envelope); expect(ack).toMatchObject({ type: 'ack' }); cards((await room.stored()).state.game!);
    return { actorId, envelope, ack };
  }
  async function until(done: (game: GameState) => boolean) {
    for (let i = 0; i < 500; i++) {
      const game = (await room.stored()).state.game!; if (done(game)) return;
      const window = game.windows?.at(-1); if (!window) throw Error('ROLLING_DO_WINDOW_MISSING');
      await send(window.participants[window.cursor]!, { type: 'PASS' });
    }
    throw Error('ROLLING_DO_WINDOW_NOT_REACHED');
  }
  async function use(abilityId: string) {
    const option = (await room.snapshotFor('B')).game!.abilityOptions.find(option => option.abilityId === abilityId)!;
    return send('B', { type: 'USE_ABILITY', abilityId, targetEventId: option.targetEventId });
  }
  async function replay(receipt: Awaited<ReturnType<typeof send>>) {
    const before = await room.stored(); await room.restart();
    expect(await room.command(receipt.actorId, receipt.envelope)).toEqual(receipt.ack); expect(await room.stored()).toEqual(before);
  }
  return { ...room, send, until, use, replay };
}
it('DO restores Grace check and separate numeric die without regenerating either or applying the old receipt twice', async () => {
  const room = await savedRoom('defense-grace-zero'); const source = attackCard(room.initial); const use = await room.use(grace); await room.replay(use);
  let checkId = '';
  for (const purpose of ['ability-check', 'ability-value']) {
    await room.until(state => viewFor(state, 'B').currentRoll?.purpose === purpose && viewFor(state, 'B').currentRoll?.stage === 'after-roll');
    const before = (await room.snapshotFor('B')).game!.currentRoll!;
    expect(before.faces).toHaveLength(purpose === 'ability-check' ? 2 : 1);
    if (purpose === 'ability-check') { checkId = before.rollId; expect(before.modifier).toBe(-3); }
    else expect(before.rollId).not.toBe(checkId);
    await room.replay(use); expect((await room.snapshotFor('B')).game!.currentRoll).toEqual(before);
  }
  await room.until(state => !state.windows?.length); await room.replay(use);
  const done = (await room.stored()).state.game!; expect(done.players.B!.damage).toBe(0); consumed(done, source);
});
it('DO preserves a half reservation and the final body damage while a different target is still resolving', async () => {
  const room = await savedRoom('defense-half-shared'); const source = attackCard(room.initial); const use = await room.use(half); await room.replay(use);
  await room.until(state => !!viewFor(state, 'B').currentAttack?.targets[0]!.hits[0]!.bodyDamage);
  const attack = (await room.snapshotFor('A')).game!.currentAttack!;
  expect(attack.targets[0]!.hits[0]!.bodyDamage).toEqual({ directDamage: 3, resistanceDamage: 0, total: 3 });
  expect(attack.targets[1]!.hits[0]!.bodyDamage).toBeUndefined();
  await room.replay(use); expect((await room.snapshotFor('A')).game!.currentAttack).toEqual(attack);
  await room.until(state => !state.windows?.length); await room.replay(use);
  const done = (await room.stored()).state.game!; expect(done.players.B!.damage).toBe(3); expect(done.players.C!.damage).toBe(8); consumed(done, source);
});
it('DO keeps committed reflection, its original source and the original attacker defense across receipt replay', async () => {
  const room = await savedRoom('defense-majesty'); const source = attackCard(room.initial); const use = await room.use(majesty);
  await room.until(state => viewFor(state, 'B').currentRoll?.purpose === 'ability-check' && viewFor(state, 'B').currentRoll?.stage === 'after-roll');
  const check = (await room.snapshotFor('B')).game!.currentRoll; await room.replay(use);
  expect((await room.snapshotFor('B')).game!.currentRoll).toEqual(check);
  await room.until(state => !!viewFor(state, 'A').currentAttack?.reflection);
  const attack = (await room.snapshotFor('A')).game!.currentAttack!; await room.replay(use);
  expect((await room.snapshotFor('A')).game!.currentAttack).toEqual(attack);
  expect(attack.reflection).toEqual({ source: 'ability', actorId: 'B', sourceCardInstanceId: source });
  concealed((await room.stored()).state.game!, majesty, '魔導王の威厳');
  const defense = await room.send('A', { type: 'PLAY_DEFENSE', cardInstanceId: 'a2-p05-r3c1', dedicated: false }); await room.replay(defense);
  await room.until(state => !state.windows?.length); await room.replay(use); await room.replay(defense);
  const done = (await room.stored()).state.game!; expect(done.players.A!.damage).toBe(0); expect(done.players.B!.damage).toBe(0);
  expect(done.discard.filter(id => id === 'a2-p05-r3c1')).toHaveLength(1); consumed(done, source);
});
it('DO saves a forced failed check and its cancellation of further ability processing', async () => {
  const room = await savedRoom('defense-grace-zero'); const source = attackCard(room.initial); const use = await room.use(grace);
  await room.until(state => viewFor(state, 'B').currentRoll?.purpose === 'ability-check' && viewFor(state, 'B').currentRoll?.stage === 'after-roll' && viewFor(state, 'C').activeWindow?.pendingActorId === 'C');
  const rollId = (await room.snapshotFor('B')).game!.currentRoll!.rollId;
  const failure = await room.send('C', { type: 'PLAY_REACTION', cardInstanceId: 'a2-p02-r2c3', mode: 'force-fail', targetRollId: rollId }); await room.replay(failure);
  await room.until(state => state.windows?.at(-1)?.kind === 'normal-defense'); await room.replay(use); await room.replay(failure);
  expect((await room.snapshotFor('B')).game!.abilityOptions.map(option => option.abilityId)).not.toContain(grace);
  await room.until(state => !state.windows?.length); await room.replay(failure);
  const done = (await room.stored()).state.game!; expect(done.players.B!.damage).toBe(2);
  expect(done.rolls?.filter(roll => roll.purpose === 'ability-value')).toEqual([]);
  expect(done.discard.filter(id => id === 'a2-p02-r2c3')).toHaveLength(1); consumed(done, source);
});
