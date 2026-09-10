import { reset } from 'cloudflare:test';
import { afterEach, expect, it } from 'vitest';
import { activeWindowRef, allCardInstanceIds, transition, viewFor, type GameCommand, type GameState } from '@madou/engine';
import { makeFollowerEntryScenario, type FollowerEntryScenarioName } from './fixtures/follower-entry-scenarios.js';
import { entropy } from './fixtures/scenario-tools.js';
import { openTestRoom } from './fixtures/recovery-room.js';

const guard = 'c2-p03-r2c2-ab02'; const illusion = 'c2-p03-r2c1-ab02'; const surprise = 'c2-p02-r1c1-ab02';
afterEach(async () => { await reset(); });
function source(name: FollowerEntryScenarioName) {
  let game = makeFollowerEntryScenario(name, ['A', 'B', 'C', 'D'].map(id => ({ id, name: id })));
  function act(actorId: string, command: GameCommand) {
    const input = { actorId, command }; const result = transition(game, input, entropy());
    expect(result.ok).toBe(true); if (!result.ok) throw Error(result.code);
    expect(transition(JSON.parse(JSON.stringify(game)), input, entropy())).toEqual(result); game = result.state;
    expect(allCardInstanceIds(game)).toHaveLength(220); expect(new Set(allCardInstanceIds(game)).size).toBe(220);
  }
  function until(done: (state: GameState) => boolean) {
    for (let i = 0; i < 500; i++) {
      if (done(game)) return;
      const window = game.windows?.at(-1); expect(window).toBeTruthy();
      if (!window) throw Error('NO_FOLLOWER_ENTRY_WINDOW');
      act(window.participants[window.cursor]!, { type: 'PASS' });
    }
    throw Error('FOLLOWER_ENTRY_DID_NOT_CONVERGE');
  }
  return { get game() { return game; }, act, until };
}
function option(game: GameState, actorId: string, abilityId: string) {
  const offered = viewFor(game, actorId).abilityOptions.find(option => option.abilityId === abilityId); expect(offered).toBeTruthy(); return offered!;
}
function atEntry(game: GameState, actorId: string, targetId = 'B') {
  const view = viewFor(game, actorId);
  return view.activeWindow?.kind === 'follower-entry-abilities' && view.activeWindow.pendingActorId === actorId && view.followerEntry?.targetId === targetId;
}
it.each([false, true])('Arnes virtual guard is explicitly selected=%s and never becomes a physical card', selected => {
  const f = source('entry-arnes'); f.until(game => atEntry(game, 'B'));
  expect(viewFor(f.game, 'A').abilityOptions).toEqual([]);
  expect(viewFor(f.game, 'B').legalChoices).not.toContain('PLAY_DEFENSE');
  if (selected) { const offer = option(f.game, 'B', guard); f.act('B', { type: 'USE_ABILITY', abilityId: guard, targetEventId: offer.targetEventId }); }
  f.until(game => viewFor(game, 'B').activeWindow?.kind === 'follower-start');
  const publicView = viewFor(f.game, 'A');
  if (selected) {
    expect(publicView.virtualFollowerDefense).toHaveLength(1);
    expect(publicView.virtualFollowerDefense[0]).toMatchObject({ source: 'virtual', levels: [4, 4, 4], hp: 1, moraleRequired: false });
    expect(publicView.virtualFollowerDefense[0]).not.toHaveProperty('cardInstanceId');
    expect(JSON.stringify(publicView)).not.toContain('c2-p03-r2c2');
  } else expect(publicView.virtualFollowerDefense).toEqual([]);
  f.until(game => !game.windows?.length);
  expect(f.game.players.B!.damage).toBe(selected ? 15 : 18);
  expect(f.game.players.B!.followers).toEqual([]);
  expect(f.game.rolls?.filter(roll => roll.purpose === 'follower-morale') ?? []).toEqual([]);
  expect(viewFor(f.game, 'B').virtualFollowerDefense).toEqual([]);
});
it('Fate cancels actual guard creation and resumes the unchanged three-hit attack', () => {
  const f = source('entry-arnes-cancel'); f.until(game => atEntry(game, 'B'));
  const offer = option(f.game, 'B', guard); f.act('B', { type: 'USE_ABILITY', abilityId: guard, targetEventId: offer.targetEventId });
  f.until(game => viewFor(game, 'C').activeWindow?.pendingActorId === 'C' && !!viewFor(game, 'C').reactionTargetAbilityId);
  f.act('C', { type: 'PLAY_REACTION', cardInstanceId: 'a2-p02-r2c3', mode: 'cancel-ability', targetAbilityId: viewFor(f.game, 'C').reactionTargetAbilityId! });
  f.until(game => !game.windows?.length);
  expect(f.game.players.B!.damage).toBe(18); expect(f.game.discard).toContain('a2-p02-r2c3');
  expect(viewFor(f.game, 'A').virtualFollowerDefense).toEqual([]);
});
it.each([false, true])('Lester separates physical human invalidity and revealed=%s virtual suppression', revealed => {
  const f = source(revealed ? 'entry-lester-revealed' : 'entry-lester-hidden');
  const physicalBefore = f.game.players.B!.followers.map(card => card.cardInstanceId);
  const offer = option(f.game, 'A', illusion);
  f.act('A', { type: 'USE_ABILITY', abilityId: illusion, targetEventId: offer.targetEventId, abilityEffectIds: ['human-invalidation', 'arnes-suppression'] });
  f.until(game => viewFor(game, 'B').activeWindow?.kind === 'normal-defense');
  f.act('B', { type: 'START_FOLLOWERS', dedicatedCardInstanceIds: ['a2-p21-r2c2'] });
  f.until(game => atEntry(game, 'B'));
  const offered = viewFor(f.game, 'B').abilityOptions.find(option => option.abilityId === guard);
  if (offered) f.act('B', { type: 'USE_ABILITY', abilityId: guard, targetEventId: offered.targetEventId });
  else expect(revealed).toBe(true);
  f.until(game => viewFor(game, 'B').activeWindow?.kind === 'follower-start');
  expect(viewFor(f.game, 'A').virtualFollowerDefense).toHaveLength(revealed ? 0 : 1);
  f.until(game => !game.windows?.length);
  expect(f.game.players.B!.damage).toBe(revealed ? 7 : 6);
  expect(f.game.players.B!.followers.map(card => card.cardInstanceId)).toEqual(physicalBefore);
  expect(f.game.rolls?.filter(roll => roll.purpose === 'follower-morale') ?? []).toEqual([]);
});
it('Lester adds spirit without changing warrior school and Wood Golem passes it without being consumed', () => {
  const f = source('entry-lester-spirit'); const offer = option(f.game, 'A', illusion);
  f.act('A', { type: 'USE_ABILITY', abilityId: illusion, targetEventId: offer.targetEventId, abilityEffectIds: ['spirit-conversion'] });
  f.until(game => viewFor(game, 'B').activeWindow?.kind === 'normal-defense');
  expect(viewFor(f.game, 'B').currentAction).toMatchObject({ source: 'card', technique: { school: 'warrior', attributes: expect.arrayContaining(['剣', '精']), effectLevel: 5, damage: 7 } });
  f.until(game => !game.windows?.length);
  expect(f.game.players.B!.damage).toBe(7); expect(f.game.players.B!.followers.map(card => card.cardInstanceId)).toContain('a2-p19-r2c3');
});
it('Tia pays separately at each target, virtual ignore cancellation protects B while C beasts are bypassed', () => {
  const f = source('entry-tia'); const distances = structuredClone(f.game.distances);
  f.until(game => atEntry(game, 'A'));
  const first = option(f.game, 'A', surprise);
  f.act('A', { type: 'USE_ABILITY', abilityId: surprise, targetEventId: first.targetEventId, costCardInstanceId: 'a2-p23-r1c2' });
  f.until(game => atEntry(game, 'B'));
  const protect = option(f.game, 'B', guard); f.act('B', { type: 'USE_ABILITY', abilityId: guard, targetEventId: protect.targetEventId });
  f.until(game => atEntry(game, 'A', 'C'));
  const second = option(f.game, 'A', surprise); expect(second.targetEventId).not.toBe(first.targetEventId);
  f.act('A', { type: 'USE_ABILITY', abilityId: surprise, targetEventId: second.targetEventId, costCardInstanceId: 'a2-p23-r1c3' });
  f.until(game => !game.windows?.length);
  expect(f.game.players.B!.damage).toBe(5); expect(f.game.players.C!.damage).toBe(7);
  expect(f.game.players.C!.followers.map(card => card.cardInstanceId)).toEqual(['a2-p20-r3c1']);
  expect(f.game.discard).toEqual(expect.arrayContaining(['a2-p23-r1c2', 'a2-p23-r1c3']));
  expect(f.game.distances).toEqual(distances);
});
it('S29 real DO restores a selected virtual guard and its frozen snapshot without duplicate activation or physical cards', async () => {
  const room = await openTestRoom('entry-arnes'); let sequence = 0;
  async function advance(done: (game: GameState) => boolean) {
    for (let i = 0; i < 500; i++) {
      const saved = await room.stored(); const game = saved.state.game!;
      if (done(game)) return;
      const window = game.windows?.at(-1); expect(window).toBeTruthy();
      expect(await room.command(window!.participants[window!.cursor]!, { protocolVersion: 1, commandId: `entry-pass-${sequence++}`, expectedRevision: saved.revision, ...activeWindowRef(game), command: { type: 'PASS' } })).toMatchObject({ type: 'ack' });
    }
    throw Error('DO_ENTRY_NOT_REACHED');
  }
  await advance(game => atEntry(game, 'B'));
  const before = await room.stored(); const offer = option(before.state.game!, 'B', guard);
  const envelope = { protocolVersion: 1 as const, commandId: 'virtual-guard', expectedRevision: before.revision, ...activeWindowRef(before.state.game!), command: { type: 'USE_ABILITY' as const, abilityId: guard, targetEventId: offer.targetEventId } };
  const ack = await room.command('B', envelope); expect(ack).toMatchObject({ type: 'ack' }); const accepted = await room.stored();
  expect(JSON.stringify((await room.snapshotFor('A')).game)).not.toContain('c2-p03-r2c2');
  await room.restart(); expect(await room.command('B', envelope)).toEqual(ack); expect(await room.stored()).toEqual(accepted);
  await advance(game => viewFor(game, 'A').virtualFollowerDefense.length === 1);
  const frozen = await room.stored(); const shown = (await room.snapshotFor('A')).game!.virtualFollowerDefense;
  await room.restart(); expect((await room.snapshotFor('A')).game!.virtualFollowerDefense).toEqual(shown);
  expect(await room.command('B', envelope)).toEqual(ack); expect(await room.stored()).toEqual(frozen);
  expect(allCardInstanceIds(frozen.state.game!)).toHaveLength(220); expect(new Set(allCardInstanceIds(frozen.state.game!)).size).toBe(220);
  const virtualId=shown[0]!.sourceId;
  await advance(game=>!game.windows?.length);
  const completed=await room.stored(),final=completed.state.game!;
  expect(final.players.B!.damage).toBe(15);expect(viewFor(final,'A').virtualFollowerDefense).toEqual([]);
  expect(allCardInstanceIds(final)).toHaveLength(220);expect(new Set(allCardInstanceIds(final)).size).toBe(220);expect(allCardInstanceIds(final)).not.toContain(virtualId);
  expect(final.reclaimDecisions?.some(d=>d.cardInstanceId===virtualId)??false).toBe(false);for(const p of Object.values(final.players))expect(p.hand).not.toContain(virtualId);
  await room.restart();expect(await room.command('B',envelope)).toEqual(ack);expect(await room.stored()).toEqual(completed);
});
it('real DO restores selected illusion branches through a Fate child and retains both receipts', async () => {
  const room = await openTestRoom('entry-lester-hidden'); let sequence = 0;
  const before = await room.stored(); const offer = option(before.state.game!, 'A', illusion);
  const use = { protocolVersion: 1 as const, commandId: 'illusion-branches', expectedRevision: before.revision, ...activeWindowRef(before.state.game!),
    command: { type: 'USE_ABILITY' as const, abilityId: illusion, targetEventId: offer.targetEventId, abilityEffectIds: ['human-invalidation' as const, 'arnes-suppression' as const] } };
  const ack = await room.command('A', use); expect(ack).toMatchObject({ type: 'ack' });
  const selected = await room.stored();
  expect((await room.snapshotFor('A')).game!.currentAction).toMatchObject({ source: 'ability', abilityEffectIds: ['human-invalidation', 'arnes-suppression'] });
  expect((await room.snapshotFor('B')).game!.currentAction).not.toHaveProperty('abilityEffectIds');
  await room.restart(); expect(await room.command('A', use)).toEqual(ack); expect(await room.stored()).toEqual(selected);
  for (let i = 0; i < 20; i++) {
    const saved = await room.stored(); const game = saved.state.game!; const window = game.windows!.at(-1)!;
    if (window.participants[window.cursor] === 'C') break;
    expect(await room.command(window.participants[window.cursor]!, { protocolVersion: 1, commandId: `illusion-pass-${sequence++}`, expectedRevision: saved.revision, ...activeWindowRef(game), command: { type: 'PASS' } })).toMatchObject({ type: 'ack' });
  }
  const ready = await room.stored(); const target = (await room.snapshotFor('C')).game!.reactionTargetAbilityId; expect(target).toBeTruthy();
  const cancel = { protocolVersion: 1 as const, commandId: 'cancel-illusion', expectedRevision: ready.revision, ...activeWindowRef(ready.state.game!),
    command: { type: 'PLAY_REACTION' as const, cardInstanceId: 'a2-p02-r2c3', mode: 'cancel-ability' as const, targetAbilityId: target! } };
  const cancellation = await room.command('C', cancel); expect(cancellation).toMatchObject({ type: 'ack' }); const pending = await room.stored();
  await room.restart(); expect(await room.command('C', cancel)).toEqual(cancellation); expect(await room.command('A', use)).toEqual(ack); expect(await room.stored()).toEqual(pending);
  for (let i = 0; i < 100; i++) {
    const saved = await room.stored(); const game = saved.state.game!; const window = game.windows?.at(-1);
    if (window?.kind === 'normal-defense') break;
    expect(window).toBeTruthy();
    expect(await room.command(window!.participants[window!.cursor]!, { protocolVersion: 1, commandId: `cancel-pass-${sequence++}`, expectedRevision: saved.revision, ...activeWindowRef(game), command: { type: 'PASS' } })).toMatchObject({ type: 'ack' });
  }
  const resumed = await room.stored(); expect(viewFor(resumed.state.game!, 'B').activeWindow?.kind).toBe('normal-defense');
  expect(viewFor(resumed.state.game!, 'B').currentAction).toMatchObject({ source: 'card', technique: { attributes: expect.not.arrayContaining(['精']) } });
  expect(resumed.state.game!.discard).toContain('a2-p02-r2c3');
  for (let i = 0; i < 240; i++) {
    const saved = await room.stored(); const game = saved.state.game!; const window = game.windows?.at(-1);
    if (!window) break;
    expect(await room.command(window.participants[window.cursor]!, { protocolVersion: 1, commandId: `resume-pass-${sequence++}`, expectedRevision: saved.revision, ...activeWindowRef(game), command: { type: 'PASS' } })).toMatchObject({ type: 'ack' });
  }
  const completed = await room.stored(); expect(completed.state.game!.windows).toHaveLength(0);
  expect(completed.state.game!.players.B!.damage).toBe(0); // Physical human defense still works after cancellation.
  expect(allCardInstanceIds(completed.state.game!)).toHaveLength(220); expect(new Set(allCardInstanceIds(completed.state.game!)).size).toBe(220);
  expect(allCardInstanceIds(resumed.state.game!)).toHaveLength(220); expect(new Set(allCardInstanceIds(resumed.state.game!)).size).toBe(220);
});
