import { reset } from 'cloudflare:test';
import { afterEach, expect, it } from 'vitest';
import { activeWindowRef, allCardInstanceIds, transition, viewFor, type GameCommand, type GameState } from '@madou/engine';
import type { ClientEnvelope } from '@madou/protocol';
import { openTestRoom } from './fixtures/recovery-room.js';
import { followerGroupScenarioNames, makeFollowerGroupScenario } from './fixtures/follower-group-scenarios.js';
import { entropy } from './fixtures/scenario-tools.js';

afterEach(async () => { await reset(); });
function command(game: GameState): GameCommand {
  const option = viewFor(game, 'A').followerBundleOptions[0]!;
  expect(option).toBeTruthy();
  const ids = game.players.A!.characterId === 'c2-p06-r1c2' && game.players.A!.hand.includes('a2-p21-r3c3')
    ? ['a2-p21-r3c3']
    : game.players.A!.characterId === 'c2-p06-r1c2'
    ? [game.players.A!.followers[0]!.cardInstanceId, game.players.A!.hand.includes('a2-p21-r3c3') ? 'a2-p21-r3c3' : 'a2-p21-r2c1']
    : ['a2-p20-r3c1', game.players.A!.hand.includes('a2-p23-r1c1') ? 'a2-p23-r1c1' : 'a2-p22-r2c2'];
  return { type: 'USE_FOLLOWER_ATTACK', abilityId: option.abilityId, targetEventId: option.targetEventId, sources: ids.map(id => {
    const source = option.sources.find(source => source.cardInstanceId === id && source.dedicated === (id === 'a2-p20-r3c1'))!;
    expect(source).toBeTruthy();
    return { cardInstanceId: id, dedicated: source.dedicated, targetIds: source.targetMode === 'mandatory-all' ? source.legalTargetIds : ['B'] };
  }) };
}
it.each(followerGroupScenarioNames)('uses actual selected sources and one persisted group in %s', name => {
  let game = makeFollowerGroupScenario(name, ['A', 'B', 'C', 'D'].map(id => ({ id, name: id })));
  const selected = command(game); const groups = new Set<string>();
  let fairyLevelRollId: string | undefined; let fairyLevelSavedBeforeExcess = false; let fairyDamageSaved = false;
  if (name === 'follower-group-fairy') expect(selected).toEqual({
    type: 'USE_FOLLOWER_ATTACK', abilityId: 'c2-p06-r1c2-ab04', targetEventId: expect.any(String),
    sources: [{ cardInstanceId: 'a2-p21-r3c3', dedicated: false, targetIds: ['B'] }],
  });
  function act(actorId: string, command: GameCommand) {
    const input = { actorId, command }; const result = transition(game, input, entropy());
    expect(result.ok).toBe(true); if (!result.ok) throw Error(result.code);
    expect(transition(JSON.parse(JSON.stringify(game)), input, entropy())).toEqual(result); game = result.state;
    expect(allCardInstanceIds(game)).toHaveLength(220); expect(new Set(allCardInstanceIds(game)).size).toBe(220);
    for (const group of Object.values(game.groups ?? {})) if (group.attackerId === 'A') groups.add(group.id);
  }
  act('A', selected);
  if (name === 'follower-group-fairy') expect(game.players.A!.followers).toEqual([{ cardInstanceId: 'a2-p20-r1c3', revealed: false }]);
  else expect(game.players.A!.followers).toHaveLength(0);
  for (let step = 0; game.windows?.length && step < 500; step++) {
    if (name === 'follower-group-fairy') {
      const view = viewFor(game, 'A'); const source = view.followerBundle?.sources[0];
      if (view.currentRoll?.purpose === 'excess-level') {
        const saved = view.recentRolls.find(roll => roll.rollId === source?.effectLevelRollId);
        expect(saved).toMatchObject({ purpose: 'technique-value', stage: 'applied', faces: [1], total: 1 });
        expect(source?.technique).toMatchObject({ useLevel: 4, effectLevel: 4 });
        fairyLevelRollId = source!.effectLevelRollId; fairyLevelSavedBeforeExcess = true;
      }
      if (view.activeWindow?.kind === 'normal-defense') {
        const saved = view.recentRolls.find(roll => roll.rollId === source?.damageRollId);
        expect(saved).toMatchObject({ purpose: 'attack-damage', stage: 'applied', faces: [1], total: 1 });
        expect(source?.damageRollId).toBeTruthy(); expect(source?.damageRollId).not.toBe(fairyLevelRollId);
        expect(source?.technique).toMatchObject({ useLevel: 4, effectLevel: 4, damage: 5, hitCount: 1 });
        expect(JSON.parse(JSON.stringify(viewFor(game, 'A')))).toEqual(view);
        fairyDamageSaved = true;
      }
    }
    const window = game.windows.at(-1)!; act(window.participants[window.cursor]!, { type: 'PASS' });
  }
  expect(game.windows).toHaveLength(0); expect(groups.size).toBe(1);
  expect(viewFor(game, 'A').followerBundle).toBeNull();
  const expectedDamage = { 'follower-group-upa': 6, 'follower-group-dia': 8, 'follower-group-grant-cancel': 28, 'follower-group-source-cancel': 28, 'follower-group-reflect': 0, 'follower-group-water': 21, 'follower-group-fairy': 5 };
  expect(game.players.B!.damage).toBe(expectedDamage[name]);
  if (selected.type === 'USE_FOLLOWER_ATTACK') for (const source of selected.sources) expect(game.discard).toContain(source.cardInstanceId);
  if (name === 'follower-group-upa') expect(game.players.B!.damage).toBe(6);
  if (name === 'follower-group-water') expect(viewFor(game, 'B').players.B!.statuses).toContainEqual(expect.objectContaining({ kind: 'stopped', timing: 'source-turn', sourceActorId: 'A' }));
  if (name === 'follower-group-fairy') {
    expect(fairyLevelSavedBeforeExcess).toBe(true); expect(fairyDamageSaved).toBe(true);
    expect(game.players.D!.damage).toBe(0); expect(game.players.A!.followers).toContainEqual(expect.objectContaining({ cardInstanceId: 'a2-p20-r1c3' }));
  }
});
it('evicts after atomic reservation and between constituent preparation without replaying costs or leaking private options', async () => {
  const room = await openTestRoom('follower-group-upa'); const before = await room.stored();
  const selected = command(before.state.game!);
  const own = (await room.snapshotFor('A')).game!; const other = (await room.snapshotFor('B')).game!;
  expect(own.followerBundleOptions).toHaveLength(1); expect(own.legalChoices).toContain('USE_FOLLOWER_ATTACK');
  expect(other.followerBundleOptions).toEqual([]); expect(other.legalChoices).not.toContain('USE_FOLLOWER_ATTACK');
  expect(JSON.stringify(other)).not.toContain('a2-p20-r3c1'); expect(JSON.stringify(other)).not.toContain('a2-p22-r2c2');
  const envelope: ClientEnvelope = { protocolVersion: 1, commandId: 'bundle-costs', expectedRevision: before.revision, ...activeWindowRef(before.state.game!), command: selected };
  const ack = await room.command('A', envelope); expect(ack).toMatchObject({ type: 'ack' });
  const paid = await room.stored(); expect(paid.state.game!.players.A!.followers).toEqual([]);
  for (const id of ['a2-p20-r3c1', 'a2-p22-r2c2']) expect(paid.state.game!.resolution.filter(card => card === id)).toHaveLength(1);
  expect((await room.snapshotFor('B')).game!.followerBundle?.sources.map(source => source.cardInstanceId)).toEqual(['a2-p20-r3c1', 'a2-p22-r2c2']);
  await room.restart(); expect(await room.command('A', envelope)).toEqual(ack); expect(await room.stored()).toEqual(paid);
  let reachedSecond = false;
  for (let i = 0; i < 180; i++) {
    const saved = await room.stored(); const game = saved.state.game!;
    const bundle = viewFor(game, 'A').followerBundle;
    if (bundle?.stage === 'prepare' && bundle.currentSourceIndex === 1) { reachedSecond = true; break; }
    const window = game.windows?.at(-1); expect(window).toBeTruthy();
    const response = await room.command(window!.participants[window!.cursor]!, { protocolVersion: 1, commandId: `bundle-pass-${i}`, expectedRevision: saved.revision, ...activeWindowRef(game), command: { type: 'PASS' } });
    expect(response).toMatchObject({ type: 'ack' });
  }
  expect(reachedSecond).toBe(true);
  const intermediate = await room.stored(); const shown = (await room.snapshotFor('A')).game!.followerBundle;
  expect(shown?.sources[0]?.stage).toBe('resolve');
  await room.restart(); expect((await room.snapshotFor('A')).game!.followerBundle).toEqual(shown);
  expect(await room.command('A', envelope)).toEqual(ack); expect(await room.stored()).toEqual(intermediate);
  expect(new Set(allCardInstanceIds(intermediate.state.game!)).size).toBe(220);
});
