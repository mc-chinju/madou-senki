import { reset } from 'cloudflare:test';
import { afterEach, expect, it } from 'vitest';
import { activeWindowRef, allCardInstanceIds, transition, viewFor, type GameCommand, type GameState } from '@madou/engine';
import { beastCaptureScenarioNames, makeBeastCaptureScenario, type BeastCaptureScenarioName } from './fixtures/beast-capture-scenarios.js';
import { entropy } from './fixtures/scenario-tools.js';
import { openTestRoom } from './fixtures/recovery-room.js';

afterEach(async () => { await reset(); });
const beastAbility = 'c2-p05-r1c2-ab03';
const beasts = ['a2-p20-r3c1', 'a2-p22-r3c1'];
function expectBeastsHidden(view: unknown) {
  const json = JSON.stringify(view);
  for (const value of [...beasts, 'グリフォン', '飛竜']) expect(json).not.toContain(value);
}
function assertNoBeastCapture(game: GameState) {
  if (game.windows?.at(-1)?.kind === 'beast-capture') throw Error('UNEXPECTED_BEAST_CAPTURE');
  for (const actor of ['A', 'B', 'C', 'D']) {
    if (viewFor(game, actor).beastCapture !== null) throw Error('UNEXPECTED_BEAST_CAPTURE');
  }
}
function fixture(name: BeastCaptureScenarioName = 'beast-capture') {
  let game = makeBeastCaptureScenario(name, ['A', 'B', 'C', 'D'].map(id => ({ id, name: id })));
  function act(actorId: string, command: GameCommand) {
    const input = { actorId, command }; const random = entropy();
    const result = transition(game, input, random); expect(result.ok).toBe(true); if (!result.ok) throw Error(result.code);
    expect(transition(JSON.parse(JSON.stringify(game)), input, random)).toEqual(result); game = result.state;
    const ids = allCardInstanceIds(game); expect(ids).toHaveLength(220); expect(new Set(ids).size).toBe(220);
  }
  function until(done: (state: GameState) => boolean) {
    for (let i = 0; i < 500; i++) {
      if (done(game)) return;
      const window = game.windows?.at(-1); if (!window) throw Error('BEAST_WINDOW_MISSING');
      act(window.participants[window.cursor]!, { type: 'PASS' });
    }
    throw Error('BEAST_WINDOW_NOT_REACHED');
  }
  function untilWithoutCapture(done: (state: GameState) => boolean) {
    for (let i = 0; i < 500; i++) {
      assertNoBeastCapture(game);
      if (done(game)) return;
      const window = game.windows?.at(-1); if (!window) throw Error('BEAST_WINDOW_MISSING');
      act(window.participants[window.cursor]!, { type: 'PASS' });
    }
    throw Error('BEAST_WINDOW_NOT_REACHED');
  }
  function use() {
    const option = viewFor(game, 'A').abilityOptions.find(option => option.abilityId === beastAbility)!;
    act('A', { type: 'USE_ABILITY', abilityId: beastAbility, targetEventId: option.targetEventId });
    return option.targetEventId;
  }
  return { get game() { return game; }, act, until, untilWithoutCapture, use };
}
it.each(beastCaptureScenarioNames)('%s offers an unselected optional ability without inspecting hidden beasts', name => {
  const game = makeBeastCaptureScenario(name, ['A', 'B', 'C', 'D'].map(id => ({ id, name: id })));
  expect(Object.values(game.abilities ?? {})).toEqual([]);
  const own = viewFor(game, 'A');
  expect(own.abilityOptions).toContainEqual(expect.objectContaining({ abilityId: 'c2-p05-r1c2-ab03', name: '獣共感' }));
  const other = viewFor(game, 'C');
  expect(JSON.stringify(other)).not.toContain('獣共感'); expect(JSON.stringify(other)).not.toContain('c2-p05-r1c2-ab03');
  for (const follower of game.players.B!.followers) expect(JSON.stringify(own)).not.toContain(follower.cardInstanceId);
});
it('declining ignore keeps the base attack and never earns a capture choice', () => {
  const f = fixture(); f.untilWithoutCapture(game => game.windows?.at(-1)?.kind === 'normal-defense');
  expect(viewFor(f.game, 'A').currentAttack!.targets[0]!.hits[0]!.technique).toMatchObject({ damage: 7, beastIgnore: false });
  f.untilWithoutCapture(game => viewFor(game, 'A').followerDefenseResults.length > 0);
  expect(viewFor(f.game, 'A').followerDefenseResults).toMatchObject([{ cardInstanceId: beasts[0], hits: [{ outcome: 'equal-destroyed' }] }]);
  f.untilWithoutCapture(game => !game.windows?.length);
  expect(f.game.players.B!.damage).toBe(0); expect(f.game.players.B!.followers).toEqual([{ cardInstanceId: beasts[1], revealed: false }]);
  expect(viewFor(f.game, 'A').beastCapture).toBeNull(); expect(f.game.players.A!.hand).not.toEqual(expect.arrayContaining(beasts));
});
it('negative-path advancement rejects a real capture window before it can be declined', () => {
  const f = fixture(); f.use();
  expect(() => f.untilWithoutCapture(game => !game.windows?.length)).toThrowError('UNEXPECTED_BEAST_CAPTURE');
});
for (const selection of [beasts, [beasts[1]!], [], null]) it('earns one private subset choice and captures ' + JSON.stringify(selection), () => {
  const f = fixture(); const eventId = f.use();
  expect(viewFor(f.game, 'A').currentAction).toMatchObject({ source: 'ability', label: '獣共感', abilityId: beastAbility, abilityName: '獣共感' });
  const hidden = viewFor(f.game, 'C'); expect(hidden.currentAction).toMatchObject({ source: 'ability', label: '特殊能力' });
  expect(JSON.stringify(hidden)).not.toContain('獣共感'); expect(JSON.stringify(hidden)).not.toContain(beastAbility);
  f.until(game => game.windows?.at(-1)?.kind === 'normal-defense');
  expect(viewFor(f.game, 'C').currentAttack!.targets[0]!.hits[0]!.technique).toMatchObject({ damage: 7, beastIgnore: true });
  expectBeastsHidden(viewFor(f.game, 'A'));
  f.until(game => viewFor(game, 'A').followerDefenseResults.length === 2);
  expect(viewFor(f.game, 'A').followerDefenseResults).toEqual([0, 1].map(position => ({ targetId: 'B', source: 'physical', position, hits: [{ hitIndex: 0, outcome: 'passed-through', hpReduction: 0 }] })));
  const late = structuredClone(f.game);
  expect(transition(f.game, { actorId: 'A', command: { type: 'USE_ABILITY', abilityId: beastAbility, targetEventId: eventId } }, entropy())).toMatchObject({ ok: false, code: 'ABILITY_DISABLED' });
  expect(f.game).toEqual(late);
  f.until(game => game.windows?.at(-1)?.kind === 'beast-capture');
  const own = viewFor(f.game, 'A'); const choice = own.beastCapture!;
  expect(choice.candidates).toEqual([
    { cardInstanceId: beasts[0], name: 'グリフォン', targetId: 'B', position: 0 },
    { cardInstanceId: beasts[1], name: '飛竜', targetId: 'B', position: 1 },
  ]);
  expect(f.game.players.B!.damage).toBe(7); expect(Object.values(f.game.groups ?? {})).toEqual([]);
  for (const actor of ['B', 'C', 'D']) {
    const other = viewFor(f.game, actor); expect(other.beastCapture).toBeNull(); expect(other.lifecycleDecision).toBeNull();
    expect(other.legalChoices).not.toContain('CHOOSE_BEAST_CAPTURE');
    if (actor !== 'B') expectBeastsHidden(other);
  }
  const beforeHand = [...f.game.players.A!.hand];
  f.act('A', selection ? { type: 'CHOOSE_BEAST_CAPTURE', groupId: choice.groupId, windowId: choice.windowId, cardInstanceIds: selection } : { type: 'PASS' });
  const taken = selection ?? [];
  expect(f.game.players.A!.hand).toEqual([...beforeHand, ...taken]);
  expect(f.game.players.B!.followers).toEqual(beasts.filter(id => !taken.includes(id)).map(cardInstanceId => ({ cardInstanceId, revealed: false })));
  expect(viewFor(f.game, 'A').beastCapture).toBeNull(); expect(f.game.players.B!.damage).toBe(7);
  expect(viewFor(f.game, 'C').logs.filter(event => event.type === 'BEAST_CAPTURED')).toEqual(taken.length ? [expect.objectContaining({ actorId: 'A', targetId: 'B', count: taken.length })] : []);
  for (const actor of ['A', 'B']) expect(viewFor(f.game, actor).privateLogs.filter(event => event.type === 'BEAST_CAPTURED').map(event => event.cardInstanceId)).toEqual(taken);
  for (const actor of ['C', 'D']) expectBeastsHidden(viewFor(f.game, actor));
});
it.each(['beast-capture-no-beasts', 'beast-capture-guard', 'beast-capture-blocked'] as const)('%s creates no entitlement through the actual follower path', name => {
  const f = fixture(name); f.use();
  if (name === 'beast-capture-blocked') {
    f.untilWithoutCapture(game => viewFor(game, 'A').followerDefenseResults.length > 0);
    expect(viewFor(f.game, 'A').followerDefenseResults).toMatchObject([{ cardInstanceId: 'a2-p22-r1c1', hits: [{ outcome: 'blocked' }] }]);
    for (const actor of ['A', 'C', 'D']) {
      const json = JSON.stringify(viewFor(f.game, actor));
      expect(json).not.toContain(beasts[1]); expect(json).not.toContain('飛竜');
    }
  }
  f.untilWithoutCapture(game => !game.windows?.length);
  expect(f.game.players.B!.damage).toBe(0); expect(viewFor(f.game, 'A').beastCapture).toBeNull();
  expect(f.game.events.some(event => event.type === 'BEAST_CAPTURED')).toBe(false);
  if (name === 'beast-capture-blocked') {
    expect(f.game.players.B!.followers).toEqual([{ cardInstanceId: 'a2-p22-r1c1', revealed: true }, { cardInstanceId: beasts[1], revealed: false }]);
    for (const actor of ['A', 'C', 'D']) {
      const json = JSON.stringify(viewFor(f.game, actor));
      expect(json).not.toContain(beasts[1]); expect(json).not.toContain('飛竜');
    }
  }
});
it('Fate cancels ignore without refunding the attempt or creating capture rights', () => {
  const f = fixture(); f.use();
  f.untilWithoutCapture(game => viewFor(game, 'C').activeWindow?.pendingActorId === 'C' && !!viewFor(game, 'C').reactionTargetAbilityId);
  f.act('C', { type: 'PLAY_REACTION', cardInstanceId: 'a2-p02-r2c3', mode: 'cancel-ability', targetAbilityId: viewFor(f.game, 'C').reactionTargetAbilityId! });
  f.untilWithoutCapture(game => game.windows?.at(-1)?.kind === 'attack-abilities');
  expect(viewFor(f.game, 'A').abilityOptions.map(option => option.abilityId)).not.toContain(beastAbility);
  f.untilWithoutCapture(game => game.windows?.at(-1)?.kind === 'normal-defense');
  expect(viewFor(f.game, 'A').currentAttack!.targets[0]!.hits[0]!.technique).toMatchObject({ damage: 7, beastIgnore: false });
  f.untilWithoutCapture(game => !game.windows?.length);
  expect(f.game.players.B!.damage).toBe(0); expect(viewFor(f.game, 'A').beastCapture).toBeNull();
  expect(f.game.discard).toContain('a2-p02-r2c3'); expect(f.game.players.B!.followers).toEqual([{ cardInstanceId: beasts[1], revealed: false }]);
});
it('capture rejects wrong actors, stale saved choices, forged and duplicate cards atomically', () => {
  const f = fixture(); f.use(); f.until(game => game.windows?.at(-1)?.kind === 'beast-capture');
  const choice = viewFor(f.game, 'A').beastCapture!;
  const command: GameCommand = { type: 'CHOOSE_BEAST_CAPTURE', groupId: choice.groupId, windowId: choice.windowId, cardInstanceIds: [beasts[0]!] };
  const before = structuredClone(f.game);
  for (const [actorId, request, code] of [
    ['B', command, 'NOT_PRIORITY'], ['A', { ...command, groupId: 'old-group' }, 'INVALID_TARGET'],
    ['A', { ...command, windowId: 'old-window' }, 'INVALID_TARGET'], ['A', { ...command, cardInstanceIds: [beasts[0]!, beasts[0]!] }, 'INVALID_TARGET'],
    ['A', { ...command, cardInstanceIds: ['a2-p18-r3c3'] }, 'INVALID_TARGET'],
  ] as [string, GameCommand, string][]) {
    expect(transition(f.game, { actorId, command: request }, entropy())).toMatchObject({ ok: false, code }); expect(f.game).toEqual(before);
  }
  f.act('A', command);
  const finished = structuredClone(f.game);
  expect(transition(f.game, { actorId: 'A', command }, entropy())).toMatchObject({ ok: false, code: 'WRONG_PHASE' }); expect(f.game).toEqual(finished);
});

async function savedRoom(name: BeastCaptureScenarioName = 'beast-capture') {
  const room = await openTestRoom(name); let sequence = 0;
  async function send(actorId: string, command: GameCommand) {
    const before = await room.stored();
    const envelope = { protocolVersion: 1 as const, commandId: `beast-${sequence++}`, expectedRevision: before.revision, ...activeWindowRef(before.state.game!), command };
    const ack = await room.command(actorId, envelope); expect(ack).toMatchObject({ type: 'ack' });
    const ids = allCardInstanceIds((await room.stored()).state.game!); expect(ids).toHaveLength(220); expect(new Set(ids).size).toBe(220);
    return { actorId, envelope, ack };
  }
  async function advance(done: (game: GameState) => boolean) {
    let last: Awaited<ReturnType<typeof send>> | undefined;
    for (let i = 0; i < 500; i++) {
      const game = (await room.stored()).state.game!; if (done(game)) return last;
      const window = game.windows?.at(-1); if (!window) throw Error('BEAST_DO_WINDOW_MISSING');
      last = await send(window.participants[window.cursor]!, { type: 'PASS' });
    }
    throw Error('BEAST_DO_WINDOW_NOT_REACHED');
  }
  async function use() {
    const game = (await room.stored()).state.game!;
    const option = viewFor(game, 'A').abilityOptions.find(option => option.abilityId === beastAbility)!;
    return send('A', { type: 'USE_ABILITY', abilityId: beastAbility, targetEventId: option.targetEventId });
  }
  async function replay(receipt: Awaited<ReturnType<typeof send>>) {
    const before = await room.stored(); await room.restart();
    expect(await room.command(receipt.actorId, receipt.envelope)).toEqual(receipt.ack);
    expect(await room.stored()).toEqual(before);
  }
  return { ...room, send, advance, use, replay };
}
it('DO restores ignore, earned private choice and transferred subset without replaying a physical acquisition', async () => {
  const room = await savedRoom(); const selected = await room.use(); await room.replay(selected);
  const frozenReceipt = await room.advance(game => game.windows?.at(-1)?.kind === 'follower-start');
  expect(frozenReceipt).toBeDefined(); await room.replay(frozenReceipt!);
  const frozen = (await room.snapshotFor('A')).game!;
  expect(frozen.beastCapture).toBeNull(); expect(frozen.currentAttack!.targets[0]!.hits[0]!.technique!.beastIgnore).toBe(true);
  expectBeastsHidden(frozen);
  const earnedReceipt = await room.advance(game => game.windows?.at(-1)?.kind === 'beast-capture');
  expect(earnedReceipt).toBeDefined(); await room.replay(earnedReceipt!);
  const earned = (await room.snapshotFor('A')).game!; const choice = earned.beastCapture!;
  expect(earned.players.B!.damage).toBe(7); expect(earned.lifecycleDecision).toBeNull();
  expect(choice.candidates.map(candidate => candidate.cardInstanceId)).toEqual(beasts);
  const other = (await room.snapshotFor('C')).game!; expect(other.beastCapture).toBeNull();
  expectBeastsHidden(other);
  const transferred = await room.send('A', { type: 'CHOOSE_BEAST_CAPTURE', groupId: choice.groupId, windowId: choice.windowId, cardInstanceIds: [beasts[1]!] });
  await room.replay(transferred); await room.replay(selected); await room.replay(earnedReceipt!);
  const done = (await room.stored()).state.game!;
  expect(done.players.A!.hand.filter(id => id === beasts[1])).toHaveLength(1);
  expect(done.players.B!.followers).toEqual([{ cardInstanceId: beasts[0], revealed: false }]);
  expect(done.discard).not.toContain(beasts[1]); expect(viewFor(done, 'A').beastCapture).toBeNull();
  expect(done.players.B!.damage).toBe(7); expect(done.phase).toBe('withdrawal');
});
it('DO captures before lethal target gifting and disposal, then replays old receipts after the saved result', async () => {
  const room = await savedRoom('beast-capture-lethal'); await room.use();
  const earnedReceipt = await room.advance(game => game.windows?.at(-1)?.kind === 'beast-capture');
  expect(earnedReceipt).toBeDefined(); await room.replay(earnedReceipt!);
  const earned = (await room.snapshotFor('A')).game!; const choice = earned.beastCapture!;
  expect(earned.players.B!.presence).toBe('pending-death'); expect(earned.outcome).toBeNull();
  expect(earned.players.B!.followers).toHaveLength(2); expect(earned.lifecycleDecision).toBeNull();
  const transfer = await room.send('A', { type: 'CHOOSE_BEAST_CAPTURE', groupId: choice.groupId, windowId: choice.windowId, cardInstanceIds: [beasts[0]!] });
  await room.replay(transfer);
  const death = (await room.snapshotFor('B')).game!;
  expect(death.activeWindow?.kind).toBe('death-gift'); expect(death.beastCapture).toBeNull();
  expect(death.self.followers.map(card => card.cardInstanceId)).toEqual([beasts[1]]);
  const gift = await room.send('B', { type: 'PLAY_DEATH_GIFT', cardInstanceId: 'a2-p02-r3c3', giftCardInstanceId: 'a2-p05-r2c3', targetId: 'D' });
  await room.replay(gift); await room.advance(game => !game.windows?.length);
  const complete = await room.stored(); const game = complete.state.game!;
  expect(game.players.B!.presence).toBe('dead'); expect(game.players.A!.hand.filter(id => id === beasts[0])).toHaveLength(1);
  expect(game.discard).not.toContain(beasts[0]); expect(game.discard.filter(id => id === beasts[1])).toHaveLength(1);
  expect(game.players.D!.hand).toContain('a2-p05-r2c3'); expect(game.discard).not.toContain('a2-p05-r2c3');
  expect(game.outcome).toMatchObject({ kind: 'victory' }); expect(complete.state.status).toBe('finished');
  await room.replay(transfer); await room.replay(gift); await room.replay(earnedReceipt!);
  expect(await room.stored()).toEqual(complete);
});
