import { reset } from 'cloudflare:test';
import { getAction } from '@madou/catalog';
import { activeWindowRef, allCardInstanceIds, transition, viewFor, type GameCommand, type GameState } from '@madou/engine';
import { afterEach, expect, it } from 'vitest';
import { makeTurnInformationScenario, turnInformationScenarioSpecs, type TurnInformationScenarioName } from './fixtures/turn-information-scenarios.js';
import { entropy } from './fixtures/scenario-tools.js';
import { openTestRoom } from './fixtures/recovery-room.js';

afterEach(async () => { await reset(); });

function fixture(name: TurnInformationScenarioName) {
  let game = makeTurnInformationScenario(name, ['A', 'B', 'C', 'D'].map(id => ({ id, name: id })));
  const spec = turnInformationScenarioSpecs[name];
  const owner = 'ownerSeat' in spec ? 'B' : 'A';
  function act(actorId: string, command: GameCommand, dice = Array(100).fill(1)) {
    const input = { actorId, command }; const random = { ...entropy(), dice };
    const result = transition(game, input, random);
    expect(result.ok, JSON.stringify({ input, code: result.ok ? 'ok' : result.code })).toBe(true);
    if (!result.ok) throw Error(result.code);
    expect(transition(JSON.parse(JSON.stringify(game)), input, random)).toEqual(result);
    game = result.state;
    const ids = allCardInstanceIds(game); expect(ids).toHaveLength(220); expect(new Set(ids).size).toBe(220);
  }
  function until(done: (state: GameState) => boolean, dice?: number[]) {
    for (let step = 0; step < 1000; step++) {
      if (done(game)) return;
      const window = game.windows?.at(-1);
      if (!window) throw Error(`INFORMATION_TEST_NO_WINDOW_${name}`);
      act(window.participants[window.cursor]!, { type: 'PASS' }, dice);
    }
    throw Error('INFORMATION_TEST_NOT_READY');
  }
  function use(abilityId: string, targetId?: string) {
    const option = viewFor(game, owner).abilityOptions.find(option => option.abilityId === abilityId);
    expect(option).toBeTruthy();
    act(owner, { type: 'USE_ABILITY', abilityId, targetEventId: option!.targetEventId, ...(targetId ? { targetId } : {}) });
  }
  return { get game() { return game; }, owner, act, until, use };
}
const inspections = [
  { scenario: 'info-cham-followers', abilityId: 'c2-p01-r2c2-ab03', zone: 'followers', discardMode: 'none' },
  { scenario: 'info-lia-chants', abilityId: 'c2-p03-r1c2-ab02', zone: 'chants', discardMode: 'all' },
  { scenario: 'info-lester-rumor', abilityId: 'c2-p03-r2c1-ab03', zone: 'character', discardMode: 'none' },
  { scenario: 'info-alseil-hand', abilityId: 'c2-p04-r2c1-ab02', zone: 'hand', discardMode: 'one' },
] as const;
it.each(inspections)('$scenario privately inspects the exact original zone and explicitly finishes without changing it', entry => {
  const f = fixture(entry.scenario);
  const before = structuredClone(f.game.players.B!);
  f.use(entry.abilityId, 'B');
  f.until(state => viewFor(state, f.owner).activeWindow?.kind === 'private-inspection');
  const decision = viewFor(f.game, f.owner).inspection!;
  expect(decision).toMatchObject({ actorId: f.owner, targetId: 'B', zone: entry.zone, discardMode: entry.discardMode });
  if (entry.zone === 'character') expect(decision.characterId).toBe(before.characterId);
  else {
    const ids = entry.zone === 'hand' ? before.hand : before[entry.zone].map(card => card.cardInstanceId);
    expect(decision.cards.map(card => card.cardInstanceId)).toEqual(ids);
    if (entry.zone === 'chants') expect(ids).toHaveLength(2);
    for (const id of ['C', 'D']) for (const cardId of ids) expect(JSON.stringify(viewFor(f.game, id))).not.toContain(cardId);
  }
  for (const id of ['B', 'C', 'D']) expect(viewFor(f.game, id).inspection).toBeNull();
  f.act(f.owner, { type: 'CHOOSE_INSPECTION', decisionId: decision.decisionId, choice: 'finish' });
  f.until(state => !state.windows?.length);
  expect(f.game.players.B).toEqual(before);
  expect(f.game.phase).toBe('action');
  expect(viewFor(f.game, f.owner).abilityOptions.some(option => option.abilityId === entry.abilityId)).toBe(false);
});
it.each(inspections.filter(entry => entry.discardMode !== 'none'))('$scenario discards only its saved offered cards and preserves their physical identity', entry => {
  const f = fixture(entry.scenario); f.use(entry.abilityId, 'B');
  f.until(state => viewFor(state, f.owner).activeWindow?.kind === 'private-inspection');
  const decision = viewFor(f.game, f.owner).inspection!;
  const selected = decision.cards[0]!.cardInstanceId;
  f.act(f.owner, entry.discardMode === 'one' ? { type: 'CHOOSE_INSPECTION', decisionId: decision.decisionId, choice: 'discard-one', cardInstanceId: selected }
    : { type: 'CHOOSE_INSPECTION', decisionId: decision.decisionId, choice: 'discard-all' });
  f.until(state => !state.windows?.length);
  const discarded = entry.discardMode === 'one' ? [selected] : decision.cards.map(card => card.cardInstanceId);
  for (const id of discarded) expect(f.game.discard.filter(card => card === id)).toHaveLength(1);
  expect(entry.discardMode === 'one' ? f.game.players.B!.hand : f.game.players.B!.chants.map(card => card.cardInstanceId)).not.toContain(selected);
  expect(f.game.phase).toBe('action');
});
it.each([
  { scenario: 'info-aiel-twins', abilityId: 'c2-p04-r1c1-ab04' },
  { scenario: 'info-flaiard-twins', abilityId: 'c2-p06-r2c1-ab04' },
] as const)('$scenario atomically swaps unequal current hands with its public counterpart', entry => {
  const f = fixture(entry.scenario); const a = [...f.game.players.A!.hand]; const b = [...f.game.players.B!.hand];
  expect(a.length).not.toBe(b.length);
  f.use(entry.abilityId, 'B'); f.until(state => !state.windows?.length);
  expect(f.game.players.A!.hand).toEqual(b); expect(f.game.players.B!.hand).toEqual(a);
  expect(f.game.phase).toBe('hand-adjustment');
  for (const id of ['C', 'D']) for (const cardId of [...a, ...b]) expect(JSON.stringify(viewFor(f.game, id))).not.toContain(cardId);
});
it('Lancaster discards printed magic techniques including Magic Song, without discarding a magic follower', () => {
  const f = fixture('info-lancaster-discard');
  const before = [...f.game.players.A!.hand];
  const magic = before.filter(id => ['白光', '魔詩'].includes(getAction(id)!.name));
  expect(magic).toHaveLength(2);
  f.use('c2-p02-r2c1-ab04'); f.until(state => !state.windows?.length);
  expect(f.game.players.A!.hand).toEqual(before.filter(id => !magic.includes(id)));
  expect(f.game.players.A!.hand.map(id => getAction(id)!.name)).toContain('天使');
  for (const id of magic) expect(f.game.discard.filter(card => card === id)).toHaveLength(1);
  expect(f.game.phase).toBe('hand-adjustment');
});
it('Shadow conceals the real public Alseil after its own saved check without spending the main action', () => {
  const f = fixture('info-alseil-shadow'); expect(f.game.players.A!.revealed).toBe(true);
  f.use('c2-p04-r2c1-ab01'); f.until(state => !state.windows?.length);
  expect(f.game.players.A!.revealed).toBe(false); expect(f.game.phase).toBe('action');
});
it('Uonos forces a real hidden Alseil public without granting voluntary TruePower', () => {
  const f = fixture('info-uonos-reveal'); expect(f.game.players.B!.revealed).toBe(false);
  const spirit = viewFor(f.game, 'B').self.stats.spirit;
  f.use('c2-p05-r1c1-ab01', 'B'); f.until(state => !state.windows?.length);
  expect(f.game.players.B!.revealed).toBe(true); expect(viewFor(f.game, 'B').spiritExpiry).toBeNull();
  expect(viewFor(f.game, 'B').self.stats.spirit).toBe(spirit); expect(f.game.phase).toBe('action');
});
it.each([
  { scenario: 'info-cham-draw', abilityId: 'c2-p01-r2c2-ab02' },
  { scenario: 'info-lancelot-growth', abilityId: 'c2-p07-r1c1-ab03' },
] as const)('$scenario explicitly replaces the actual normal draw with two cards', entry => {
  const f = fixture(entry.scenario); const before = f.game.players.A!.hand.length;
  expect(viewFor(f.game, 'A').drawAbilityOptions.map(option => option.abilityId)).toContain(entry.abilityId);
  if (entry.scenario === 'info-lancelot-growth') expect(f.game.players.A!.characterId).toBe('c2-p07-r1c1');
  f.act('A', { type: 'CHOOSE_DRAW', draw: true, abilityId: entry.abilityId }); f.until(state => !state.windows?.length);
  expect(f.game.players.A!.hand).toHaveLength(before + 2); expect(f.game.phase).toBe('action');
});
it.each(['info-alseil-truepower', 'info-alseil-reveal-setup', 'info-alseil-reveal-attack', 'info-alseil-reveal-otherturn'] as const)('%s keeps voluntary base12 and its exact saved end-of-turn actor', name => {
  const f = fixture(name); const before = viewFor(f.game, f.owner).self.stats.spirit;
  f.act(f.owner, { type: 'REVEAL_CHARACTER', abilityId: 'c2-p04-r2c1-ab03' });
  f.until(state => !!viewFor(state, f.owner).spiritExpiry);
  const own = viewFor(f.game, f.owner);
  expect(own.self.stats.spirit).toBe(before + 6); // Actual Alseil printed base6 -> replacement12.
  expect(own.spiritExpiry).toMatchObject({ expiresOnActorId: 'A', timing: 'turn-end', active: true });
  expect(f.game.players[f.owner]!.revealed).toBe(true);
  for (const id of ['A', 'B', 'C', 'D'].filter(id => id !== f.owner)) expect(viewFor(f.game, id).spiritExpiry).toBeNull();
});

const cancellable = [
  ...inspections.map(entry => ({ ...entry, targetId: 'B', main: false })),
  { scenario: 'info-lancaster-discard', abilityId: 'c2-p02-r2c1-ab04', main: true },
  { scenario: 'info-aiel-twins', abilityId: 'c2-p04-r1c1-ab04', targetId: 'B', main: true },
  { scenario: 'info-flaiard-twins', abilityId: 'c2-p06-r2c1-ab04', targetId: 'B', main: true },
  { scenario: 'info-alseil-shadow', abilityId: 'c2-p04-r2c1-ab01', main: false },
  { scenario: 'info-uonos-reveal', abilityId: 'c2-p05-r1c1-ab01', targetId: 'B', main: false },
] as const;
it.each(cancellable)('$scenario cancellation preserves both original players and spends only the declared attempt/action', entry => {
  const f = fixture(entry.scenario);
  const before = structuredClone([f.game.players.A, f.game.players.B]);
  f.use(entry.abilityId, 'targetId' in entry ? entry.targetId : undefined);
  f.until(state => viewFor(state, 'D').activeWindow?.pendingActorId === 'D');
  f.act('D', { type: 'PLAY_REACTION', cardInstanceId: 'a2-p02-r2c3', mode: 'cancel-ability', targetAbilityId: viewFor(f.game, 'D').reactionTargetAbilityId! });
  f.until(state => !state.windows?.length);
  expect([f.game.players.A, f.game.players.B]).toEqual(before);
  expect(f.game.phase).toBe(entry.main ? 'hand-adjustment' : 'action');
  expect(viewFor(f.game, 'A').abilityOptions.map(option => option.abilityId)).not.toContain(entry.abilityId);
  expect(f.game.discard.filter(card => card === 'a2-p02-r2c3')).toHaveLength(1);
});
it.each([
  { scenario: 'info-cham-draw', abilityId: 'c2-p01-r2c2-ab02' },
  { scenario: 'info-lancelot-growth', abilityId: 'c2-p07-r1c1-ab03' },
] as const)('$scenario canceled replacement draws exactly the ordinary one card', entry => {
  const f = fixture(entry.scenario); const before = f.game.players.A!.hand.length;
  f.act('A', { type: 'CHOOSE_DRAW', draw: true, abilityId: entry.abilityId });
  f.until(state => viewFor(state, 'D').activeWindow?.pendingActorId === 'D');
  f.act('D', { type: 'PLAY_REACTION', cardInstanceId: 'a2-p02-r2c3', mode: 'cancel-ability', targetAbilityId: viewFor(f.game, 'D').reactionTargetAbilityId! });
  f.until(state => !state.windows?.length);
  expect(f.game.players.A!.hand).toHaveLength(before + 1);
  expect(f.game.phase).toBe('action'); expect(viewFor(f.game, 'A').drawAbilityOptions).toEqual([]);
});
it('canceled TruePower retains the real voluntary reveal but does not grant a spirit replacement', () => {
  const f = fixture('info-alseil-truepower'); const before = viewFor(f.game, 'A').self.stats.spirit;
  f.act('A', { type: 'REVEAL_CHARACTER', abilityId: 'c2-p04-r2c1-ab03' });
  f.until(state => viewFor(state, 'D').activeWindow?.pendingActorId === 'D');
  f.act('D', { type: 'PLAY_REACTION', cardInstanceId: 'a2-p02-r2c3', mode: 'cancel-ability', targetAbilityId: viewFor(f.game, 'D').reactionTargetAbilityId! });
  f.until(state => !state.windows?.length);
  expect(f.game.players.A!.revealed).toBe(true);
  expect(viewFor(f.game, 'A').spiritExpiry).toBeNull(); expect(viewFor(f.game, 'A').self.stats.spirit).toBe(before);
});
it('own-attack inspection resumes the original attack, while Lia cannot inspect chants during an attack', () => {
  const f = fixture('info-alseil-attack');
  f.until(state => !!viewFor(state, 'A').currentAttack && viewFor(state, 'A').activeWindow?.pendingActorId === 'A');
  const source = viewFor(f.game, 'A').currentAttack!.actionId;
  f.use('c2-p04-r2c1-ab02', 'B');
  f.until(state => viewFor(state, 'A').activeWindow?.kind === 'private-inspection');
  f.act('A', { type: 'CHOOSE_INSPECTION', decisionId: viewFor(f.game, 'A').inspection!.decisionId, choice: 'finish' });
  expect(viewFor(f.game, 'A').currentAttack!.actionId).toBe(source);
  f.until(state => !state.windows?.length); expect(f.game.phase).toBe('withdrawal');
  const lia = fixture('info-lia-attack'); lia.until(state => viewFor(state, 'A').activeWindow?.pendingActorId === 'A');
  expect(viewFor(lia.game, 'A').abilityOptions.map(option => option.abilityId)).not.toContain('c2-p03-r1c2-ab02');
});
it('forced Lia reveal keeps the actual Lancelot transformation choice', () => {
  const f = fixture('info-uonos-lia'); f.use('c2-p05-r1c1-ab01', 'B');
  f.until(state => viewFor(state, 'C').lifecycleAbilities.includes('lancelot-transform'));
  expect(f.game.players.B!.revealed).toBe(true);
  f.act('C', { type: 'USE_LIFECYCLE_ABILITY', ability: 'lancelot-transform' });
  f.until(state => !state.windows?.length);
  expect(f.game.players.C!.characterId).toBe('c2-p07-r1c1');
  expect(f.game.players.C!.abilityCharacterIds).toContain('c2-p02-r2c2');
});
it('private inspection rejects foreign/stale decisions and unseen card IDs atomically', () => {
  const f = fixture('info-alseil-hand'); f.use('c2-p04-r2c1-ab02', 'B');
  f.until(state => viewFor(state, 'A').activeWindow?.kind === 'private-inspection');
  const decision = viewFor(f.game, 'A').inspection!;
  for (const [actorId, command] of [
    ['B', { type: 'CHOOSE_INSPECTION', decisionId: decision.decisionId, choice: 'finish' }],
    ['A', { type: 'CHOOSE_INSPECTION', decisionId: `${decision.decisionId}-stale`, choice: 'finish' }],
    ['A', { type: 'CHOOSE_INSPECTION', decisionId: decision.decisionId, choice: 'discard-one', cardInstanceId: f.game.players.D!.hand[0]! }],
  ] as const) {
    const before = structuredClone(f.game);
    expect(transition(f.game, { actorId, command }, entropy()).ok).toBe(false);
    expect(f.game).toEqual(before);
  }
  f.act('A', { type: 'PASS' }); f.until(state => !state.windows?.length);
  expect(viewFor(f.game, 'A').inspection).toBeNull();
});

async function savedRoom(scenario: TurnInformationScenarioName) {
  const room = await openTestRoom(scenario); let sequence = 0;
  async function send(actorId: string, command: GameCommand) {
    const before = await room.stored();
    const envelope = { protocolVersion: 1 as const, commandId: `information-${sequence++}`, expectedRevision: before.revision, ...activeWindowRef(before.state.game!), command };
    const ack = await room.command(actorId, envelope); expect(ack).toMatchObject({ type: 'ack' });
    const ids = allCardInstanceIds((await room.stored()).state.game!); expect(ids).toHaveLength(220); expect(new Set(ids).size).toBe(220);
    return { actorId, envelope, ack };
  }
  async function until(done: (state: GameState) => boolean) {
    for (let step = 0; step < 1000; step++) {
      const game = (await room.stored()).state.game!; if (done(game)) return;
      const window = game.windows?.at(-1); if (!window) throw Error('INFORMATION_DO_NO_WINDOW');
      await send(window.participants[window.cursor]!, { type: 'PASS' });
    }
    throw Error('INFORMATION_DO_NOT_READY');
  }
  async function use(abilityId: string, targetId?: string) {
    const option = (await room.snapshotFor('A')).game!.abilityOptions.find(option => option.abilityId === abilityId)!;
    return send('A', { type: 'USE_ABILITY', abilityId, targetEventId: option.targetEventId, ...(targetId ? { targetId } : {}) });
  }
  async function replay(receipt: Awaited<ReturnType<typeof send>>) {
    const before = await room.stored(); await room.restart();
    expect(await room.command(receipt.actorId, receipt.envelope)).toEqual(receipt.ack);
    expect(await room.stored()).toEqual(before);
  }
  return { ...room, send, until, use, replay };
}
it.each([
  { scenario: 'info-alseil-hand', abilityId: 'c2-p04-r2c1-ab02', choice: 'discard-one' },
  { scenario: 'info-lia-chants', abilityId: 'c2-p03-r1c2-ab02', choice: 'discard-all' },
] as const)('DO $scenario restores private snapshots and replays discard exactly once after eviction', async entry => {
  const room = await savedRoom(entry.scenario); const used = await room.use(entry.abilityId, 'B'); await room.replay(used);
  await room.until(state => viewFor(state, 'A').activeWindow?.kind === 'private-inspection');
  const decision = (await room.snapshotFor('A')).game!.inspection!;
  await room.restart(); expect((await room.snapshotFor('A')).game!.inspection).toEqual(decision);
  for (const id of ['C', 'D']) {
    const outsider = (await room.snapshotFor(id)).game!; expect(outsider.inspection).toBeNull();
    for (const card of decision.cards) expect(JSON.stringify(outsider)).not.toContain(card.cardInstanceId);
  }
  const discarded = entry.choice === 'discard-one' ? [decision.cards[0]!.cardInstanceId] : decision.cards.map(card => card.cardInstanceId);
  const receipt = await room.send('A', { type: 'CHOOSE_INSPECTION', decisionId: decision.decisionId, choice: entry.choice, ...(entry.choice === 'discard-one' ? { cardInstanceId: discarded[0]! } : {}) });
  await room.replay(receipt); await room.until(state => !state.windows?.length); await room.replay(receipt);
  const done = (await room.stored()).state.game!;
  for (const card of discarded) expect(done.discard.filter(id => id === card)).toHaveLength(1);
  expect(viewFor(done, 'A').inspection).toBeNull();
}, 15000);
it('DO twins exchanges actual whole hands once across duplicate receipt and eviction', async () => {
  const room = await savedRoom('info-aiel-twins'); const beforeA = [...room.initial.players.A!.hand]; const beforeB = [...room.initial.players.B!.hand];
  const receipt = await room.use('c2-p04-r1c1-ab04', 'B'); await room.replay(receipt);
  await room.until(state => !state.windows?.length); await room.replay(receipt);
  const done = (await room.stored()).state.game!;
  expect(done.players.A!.hand).toEqual(beforeB); expect(done.players.B!.hand).toEqual(beforeA);
}, 15000);
it('DO TruePower survives eviction until the actual saved actor ends its turn, then stays expired', async () => {
  const room = await savedRoom('info-alseil-truepower'); const base = viewFor(room.initial, 'A').self.stats.spirit;
  const receipt = await room.send('A', { type: 'REVEAL_CHARACTER', abilityId: 'c2-p04-r2c1-ab03' }); await room.replay(receipt);
  await room.until(state => !state.windows?.length); await room.replay(receipt);
  expect((await room.snapshotFor('A')).game!.self.stats.spirit).toBe(base + 6);
  await room.send('A', { type: 'PASS_ACTION' });
  const end = await room.send('A', { type: 'END_TURN', discardIds: [] }); await room.replay(end);
  const own = (await room.snapshotFor('A')).game!;
  expect(own.spiritExpiry).toBeNull(); expect(own.self.stats.spirit).toBe(base);
}, 15000);
