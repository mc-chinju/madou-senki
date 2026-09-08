import { reset } from 'cloudflare:test';
import { afterEach, expect, it } from 'vitest';
import { activeWindowRef, allCardInstanceIds, transition, viewFor, type GameCommand, type GameState } from '@madou/engine';
import { makeFollowerDestructionScenario, type FollowerDestructionScenarioName } from './fixtures/follower-destruction-scenarios.js';
import { entropy } from './fixtures/scenario-tools.js';
import { openTestRoom } from './fixtures/recovery-room.js';

afterEach(async () => { await reset(); });
const cases = [
  { fixture: 'destroy-lancaster', ability: 'c2-p02-r2c1-ab02', name: '竜殺槍', damage: 7, destroyed: ['a2-p22-r3c1'] },
  { fixture: 'destroy-lancelot', ability: 'c2-p02-r2c2-ab02', name: '白龍の剣', damage: 14, destroyed: ['a2-p21-r1c1'] },
  { fixture: 'destroy-asfelt', ability: 'c2-p04-r1c2-ab01', name: '風龍の剣', damage: 7, destroyed: ['a2-p22-r1c1', 'a2-p18-r3c3'] },
  { fixture: 'destroy-frenzy', ability: 'c2-p06-r1c1-ab03', name: '狂魂', damage: 5, destroyed: ['a2-p18-r3c3'] },
] as const;
function scenario(name: FollowerDestructionScenarioName) {
  let game = makeFollowerDestructionScenario(name, ['A', 'B', 'C', 'D'].map(id => ({ id, name: id })));
  function act(actorId: string, command: GameCommand) {
    const input = { actorId, command }; const random = entropy();
    const result = transition(game, input, random); expect(result.ok).toBe(true); if (!result.ok) throw Error(result.code);
    expect(transition(JSON.parse(JSON.stringify(game)), input, random)).toEqual(result); game = result.state;
    const cards = allCardInstanceIds(game); expect(cards).toHaveLength(220); expect(new Set(cards).size).toBe(220);
  }
  function until(done: (state: GameState) => boolean) {
    for (let i = 0; i < 500; i++) {
      if (done(game)) return;
      const window = game.windows?.at(-1); if (!window) throw Error('DESTRUCTION_WINDOW_MISSING');
      act(window.participants[window.cursor]!, { type: 'PASS' });
    }
    throw Error('DESTRUCTION_WINDOW_NOT_REACHED');
  }
  function use(actor: string, abilityId: string) {
    until(state => viewFor(state, actor).abilityOptions.some(option => option.abilityId === abilityId));
    const option = viewFor(game, actor).abilityOptions.find(option => option.abilityId === abilityId)!;
    act(actor, { type: 'USE_ABILITY', abilityId, targetEventId: option.targetEventId });
    return option.targetEventId;
  }
  return { get game() { return game; }, act, until, use };
}
for (const selected of [false, true]) it.each(cases)('$fixture explicit selection=' + selected + ' preserves followers until reached and spends no virtual physical card', entry => {
  const f = scenario(entry.fixture);
  expect(Object.values(f.game.abilities ?? {})).toEqual([]);
  f.until(game => viewFor(game, 'A').activeWindow?.pendingActorId === 'A');
  const option = viewFor(f.game, 'A').abilityOptions.find(option => option.abilityId === entry.ability);
  expect(option).toBeDefined();
  if (selected) {
    f.use('A', entry.ability);
    expect(viewFor(f.game, 'A').currentAction).toMatchObject({ source: 'ability', label: entry.name, abilityId: entry.ability, abilityName: entry.name });
    const other = viewFor(f.game, 'B');
    expect(other.currentAction).toMatchObject({ source: 'ability', label: '特殊能力' });
    expect(other.currentAction).not.toHaveProperty('abilityName'); expect(other.currentAction).not.toHaveProperty('abilityId');
    expect(JSON.stringify(other)).not.toContain(entry.name); expect(JSON.stringify(other)).not.toContain(entry.ability);
    expect(f.game.players.B!.followers.map(card => card.cardInstanceId)).toEqual([...entry.destroyed]);
  }
  if (!selected && entry.fixture === 'destroy-lancelot') {
    f.until(game => game.windows?.at(-1)?.kind === 'normal-defense');
    expect(viewFor(f.game, 'A').currentAttack!.targets[0]!.hits[0]!.technique!.damage).toBe(7);
  }
  f.until(game => game.windows?.at(-1)?.kind === 'follower-entry-abilities');
  if (entry.fixture === 'destroy-frenzy') f.use('B', 'c2-p03-r2c2-ab02');
  f.until(game => game.windows?.at(-1)?.kind === 'follower-start');
  const before = structuredClone(f.game);
  expect(transition(f.game, { actorId: 'A', command: { type: 'USE_ABILITY', abilityId: entry.ability, targetEventId: option!.targetEventId } }, entropy())).toMatchObject({ ok: false, code: 'ABILITY_DISABLED' });
  expect(f.game).toEqual(before);
  if (!selected && entry.fixture === 'destroy-lancelot') {
    f.until(game => viewFor(game, 'A').followerDefenseResults.some(result => result.cardInstanceId === 'a2-p21-r1c1'));
    expect(viewFor(f.game, 'A').followerDefenseResults).toEqual([
      { targetId: 'B', source: 'physical', position: 0, cardInstanceId: 'a2-p21-r1c1', hits: [{ hitIndex: 0, outcome: 'equal-destroyed', hpReduction: 0 }] },
    ]);
  }
  f.until(game => !game.windows?.length);
  expect(f.game.players.B!.damage).toBe(selected ? entry.damage : 0);
  if (selected) {
    expect(f.game.discard).toEqual(expect.arrayContaining([...entry.destroyed]));
    expect(f.game.players.B!.followers).toEqual([]);
    expect(f.game.rolls?.filter(roll => roll.purpose === 'follower-morale') ?? []).toEqual([]);
  } else if (entry.fixture !== 'destroy-lancelot') {
    expect(f.game.players.B!.followers.map(card => card.cardInstanceId)).toEqual([...entry.destroyed]);
  }
  expect(viewFor(f.game, 'A').virtualFollowerDefense).toEqual([]);
});
it('Asfelt compares the frozen blessed level and leaves a blocked hidden rear follower untouched', () => {
  const f = scenario('destroy-asfelt-blessing');
  f.use('A', 'c2-p04-r1c2-ab01');
  f.until(game => game.windows?.at(-1)?.kind === 'follower-start');
  const group = Object.values(f.game.groups!)[0]!;
  expect(group.targets[0]!.followerDefense!.map(source => source.levels)).toEqual([[7], [3]]);
  f.until(game => !game.windows?.length);
  expect(f.game.players.B!.damage).toBe(0);
  expect(f.game.players.B!.followers).toEqual([{ cardInstanceId: 'a2-p22-r1c1', revealed: true }, { cardInstanceId: 'a2-p18-r3c3', revealed: false }]);
  expect(JSON.stringify(viewFor(f.game, 'A'))).not.toContain('a2-p18-r3c3');
});
for (const entry of cases.slice(0, 2)) it(entry.name + ' cancellation leaves the whole package unapplied and its attempt spent', () => {
  const f = scenario(entry.fixture); f.use('A', entry.ability);
  f.until(game => viewFor(game, 'C').activeWindow?.pendingActorId === 'C' && !!viewFor(game, 'C').reactionTargetAbilityId);
  f.act('C', { type: 'PLAY_REACTION', cardInstanceId: 'a2-p02-r2c3', mode: 'cancel-ability', targetAbilityId: viewFor(f.game, 'C').reactionTargetAbilityId! });
  f.until(game => game.windows?.at(-1)?.kind === (entry.fixture === 'destroy-lancelot' ? 'damage' : 'attack-abilities'));
  expect(viewFor(f.game, 'A').abilityOptions.map(option => option.abilityId)).not.toContain(entry.ability);
  if (entry.fixture === 'destroy-lancelot') {
    f.until(game => game.windows?.at(-1)?.kind === 'normal-defense');
    expect(viewFor(f.game, 'A').currentAttack!.targets[0]!.hits[0]!.technique!.damage).toBe(7);
    f.until(game => viewFor(game, 'A').followerDefenseResults.some(result => result.cardInstanceId === 'a2-p21-r1c1'));
    expect(viewFor(f.game, 'A').followerDefenseResults).toEqual([
      { targetId: 'B', source: 'physical', position: 0, cardInstanceId: 'a2-p21-r1c1', hits: [{ hitIndex: 0, outcome: 'equal-destroyed', hpReduction: 0 }] },
    ]);
  }
  f.until(game => !game.windows?.length);
  expect(f.game.players.B!.damage).toBe(0); expect(f.game.discard).toContain('a2-p02-r2c3');
});

async function savedRoom(name: FollowerDestructionScenarioName) {
  const room = await openTestRoom(name); let sequence = 0;
  async function send(actorId: string, command: GameCommand) {
    const before = await room.stored();
    const envelope = { protocolVersion: 1 as const, commandId: `destruction-${sequence++}`, expectedRevision: before.revision, ...activeWindowRef(before.state.game!), command };
    const ack = await room.command(actorId, envelope); expect(ack).toMatchObject({ type: 'ack' });
    const game = (await room.stored()).state.game!; const ids = allCardInstanceIds(game);
    expect(ids).toHaveLength(220); expect(new Set(ids).size).toBe(220);
    return { actorId, envelope, ack };
  }
  async function advance(done: (game: GameState) => boolean) {
    let last: Awaited<ReturnType<typeof send>> | undefined;
    for (let i = 0; i < 500; i++) {
      const game = (await room.stored()).state.game!; if (done(game)) return last;
      const window = game.windows?.at(-1); if (!window) throw Error('DESTRUCTION_DO_WINDOW_MISSING');
      last = await send(window.participants[window.cursor]!, { type: 'PASS' });
    }
    throw Error('DESTRUCTION_DO_NOT_REACHED');
  }
  async function use(actorId: string, abilityId: string) {
    await advance(game => viewFor(game, actorId).abilityOptions.some(option => option.abilityId === abilityId));
    const game = (await room.stored()).state.game!;
    const offer = viewFor(game, actorId).abilityOptions.find(option => option.abilityId === abilityId)!;
    return send(actorId, { type: 'USE_ABILITY', abilityId, targetEventId: offer.targetEventId });
  }
  async function replay(receipt: Awaited<ReturnType<typeof send>>) {
    const before = await room.stored(); await room.restart();
    expect(await room.command(receipt.actorId, receipt.envelope)).toEqual(receipt.ack);
    expect(await room.stored()).toEqual(before);
  }
  return { ...room, send, advance, use, replay };
}
it('DO replays White Sword receipts before and after follower freeze without doubling again or undoing destruction', async () => {
  const room = await savedRoom('destroy-lancelot'); const accepted = await room.use('A', 'c2-p02-r2c2-ab02'); await room.replay(accepted);
  const hidden = (await room.snapshotFor('B')).game!;
  expect(hidden.currentAction).toMatchObject({ source: 'ability', label: '特殊能力' });
  expect(JSON.stringify(hidden)).not.toContain('白龍の剣'); expect(hidden.currentAction).not.toHaveProperty('abilityId');
  await room.advance(game => game.windows?.at(-1)?.kind === 'normal-defense');
  const beforeFollowers = (await room.snapshotFor('A')).game!;
  expect(beforeFollowers.followerDefenseResults).toEqual([]);
  expect(beforeFollowers.currentAttack!.targets[0]!.hits[0]!.technique!.damage).toBe(14);
  const frozenReceipt = await room.advance(game => game.windows?.at(-1)?.kind === 'follower-start');
  expect(frozenReceipt).toBeTruthy(); await room.replay(frozenReceipt!);
  const fixed = (await room.stored()).state.game!;
  expect(Object.values(fixed.groups!)[0]!.targets[0]!.followerDefense![0]!.levels).toEqual([5]);
  await room.advance(game => viewFor(game, 'A').followerDefenseResults.length > 0);
  const result = (await room.snapshotFor('A')).game!.followerDefenseResults;
  expect(result).toEqual([{ targetId: 'B', source: 'physical', position: 0, cardInstanceId: 'a2-p21-r1c1', hits: [{ hitIndex: 0, outcome: 'attribute-destroyed', hpReduction: 0 }] }]);
  await room.replay(accepted); await room.replay(frozenReceipt!);
  expect((await room.snapshotFor('A')).game!.followerDefenseResults).toEqual(result);
  await room.advance(game => !game.windows?.length);
  const done = (await room.stored()).state.game!;
  expect(done.players.B!.damage).toBe(14); expect(done.players.B!.followers).toEqual([]);
  expect(done.discard.filter(id => id === 'a2-p21-r1c1')).toHaveLength(1);
});
it('DO preserves Frenzy and a virtual guard child across entry and reached-result eviction with no phantom card', async () => {
  const room = await savedRoom('destroy-frenzy'); await room.use('A', 'c2-p06-r1c1-ab03');
  const guard = await room.use('B', 'c2-p03-r2c2-ab02'); await room.replay(guard);
  const frozenReceipt = await room.advance(game => game.windows?.at(-1)?.kind === 'follower-start');
  expect(frozenReceipt).toBeTruthy(); await room.replay(frozenReceipt!);
  const frozen = (await room.snapshotFor('A')).game!;
  expect(frozen.followerDefenseResults).toEqual([]); expect(frozen.virtualFollowerDefense).toHaveLength(1);
  const guardId = frozen.virtualFollowerDefense[0]!.sourceId;
  expect(frozen.players.B!.followers).toEqual([{ position: 0, face: 'back' }]);
  expect(JSON.stringify(frozen)).not.toContain('a2-p18-r3c3');
  await room.advance(game => viewFor(game, 'A').followerDefenseResults.length === 2);
  const reached = (await room.snapshotFor('A')).game!.followerDefenseResults;
  expect(reached).toEqual([
    { targetId: 'B', source: 'virtual', position: -1, hits: [{ hitIndex: 0, outcome: 'attribute-destroyed', hpReduction: 0 }] },
    { targetId: 'B', source: 'physical', position: 0, cardInstanceId: 'a2-p18-r3c3', hits: [{ hitIndex: 0, outcome: 'attribute-destroyed', hpReduction: 0 }] },
  ]);
  await room.replay(guard); await room.replay(frozenReceipt!);
  expect((await room.snapshotFor('A')).game!.followerDefenseResults).toEqual(reached);
  await room.advance(game => !game.windows?.length);
  const done = (await room.stored()).state.game!;
  expect(done.players.B!.damage).toBe(5); expect(done.players.B!.followers).toEqual([]);
  expect(done.discard.filter(id => id === 'a2-p18-r3c3')).toHaveLength(1); expect(allCardInstanceIds(done)).not.toContain(guardId);
  expect(viewFor(done, 'A').virtualFollowerDefense).toEqual([]);
});
