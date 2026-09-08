import { reset } from 'cloudflare:test';
import { afterEach, expect, it } from 'vitest';
import { activeWindowRef, allCardInstanceIds, transition, viewFor, type GameCommand, type GameState } from '@madou/engine';
import { getAction } from '@madou/catalog';
import { entropy } from './fixtures/scenario-tools.js';
import { openTestRoom } from './fixtures/recovery-room.js';
import { attackPropertyScenarioNames, makeAttackPropertyScenario, type AttackPropertyScenarioName } from './fixtures/attack-property-scenarios.js';

afterEach(async () => { await reset(); });
const lancaster = 'c2-p02-r2c1-ab01'; const arnes = 'c2-p03-r2c2-ab03';
function maaiCards(game: GameState, actor: string) { return game.players[actor]!.hand.filter(id => getAction(id)?.modes?.some(mode => mode.playMode === 'distance')); }
function fixture(name: AttackPropertyScenarioName) {
  let game = makeAttackPropertyScenario(name, ['A', 'B', 'C', 'D'].map(id => ({ id, name: id })));
  function act(actorId: string, command: GameCommand) {
    const input = { actorId, command }; const random = entropy(); const result = transition(game, input, random);
    expect(result.ok).toBe(true); if (!result.ok) throw Error(result.code);
    expect(transition(JSON.parse(JSON.stringify(game)), input, random)).toEqual(result); game = result.state;
    expect(allCardInstanceIds(game)).toHaveLength(220); expect(new Set(allCardInstanceIds(game)).size).toBe(220);
  }
  function until(done: (game: GameState) => boolean) {
    for (let i = 0; i < 500; i++) {
      if (done(game)) return;
      const window = game.windows?.at(-1); if (!window) throw Error('PROPERTY_WINDOW_MISSING');
      act(window.participants[window.cursor]!, { type: 'PASS' });
    }
    throw Error('PROPERTY_WINDOW_NOT_REACHED');
  }
  function use() {
    const abilityId = name === 'property-arnes' ? arnes : lancaster;
    const option = viewFor(game, 'A').abilityOptions.find(option => option.abilityId === abilityId)!;
    act('A', { type: 'USE_ABILITY', abilityId, targetEventId: option.targetEventId }); return option.targetEventId;
  }
  return { get game() { return game; }, act, until, use };
}
function publicProgress(game: GameState) {
  const expected = viewFor(game, 'A').maaiDefense;
  for (const actor of ['B', 'C', 'D']) expect(viewFor(game, actor).maaiDefense).toEqual(expected);
  return expected!;
}
it.each(attackPropertyScenarioNames)('%s offers its unselected ability without exposing the source to other seats', name => {
  const game = makeAttackPropertyScenario(name, ['A', 'B', 'C', 'D'].map(id => ({ id, name: id })));
  const abilityId = name === 'property-arnes' ? 'c2-p03-r2c2-ab03' : 'c2-p02-r2c1-ab01';
  const abilityName = name === 'property-arnes' ? '黒弓' : '瞬風';
  expect(Object.values(game.abilities ?? {})).toEqual([]);
  expect(viewFor(game, 'A').abilityOptions).toContainEqual(expect.objectContaining({ abilityId, name: abilityName }));
  for (const actor of ['B', 'C', 'D']) {
    const json = JSON.stringify(viewFor(game, actor));
    expect(json).not.toContain(abilityId); expect(json).not.toContain(abilityName);
  }
});

for (const selected of [false, true]) it(`Lancaster selected=${selected} adds to the native two-card requirement and pays only actual cards`, () => {
  const f = fixture('property-lancaster'); const cards = maaiCards(f.game, 'B'); const distance = structuredClone(f.game.distances);
  const event = selected ? f.use() : viewFor(f.game, 'A').abilityOptions.find(option => option.abilityId === lancaster)!.targetEventId;
  f.until(game => game.windows?.at(-1)?.kind === 'normal-defense');
  const required = selected ? 3 : 2;
  expect(publicProgress(f.game).targets[0]).toMatchObject({ actorId: 'B', required, carried: 0, submitted: 0, effective: 0, remaining: required });
  expect(viewFor(f.game, 'A').currentAttack!.technique).toMatchObject({ effectLevel: 5, damage: 7 });
  const before = structuredClone(f.game);
  expect(transition(f.game, { actorId: 'A', command: { type: 'USE_ABILITY', abilityId: lancaster, targetEventId: event } }, entropy())).toMatchObject({ ok: false, code: 'ABILITY_DISABLED' });
  expect(f.game).toEqual(before);
  for (let i = 0; i < required; i++) {
    f.act('B', { type: 'PLAY_MAAI', cardInstanceId: cards[i]! });
    expect(publicProgress(f.game).targets[0]).toMatchObject({ submitted: i + 1, effective: i + 1, remaining: required - i - 1 });
    expect(viewFor(f.game, 'A').activeWindow?.kind).toBe(i + 1 === required ? 'defense-advance' : 'normal-defense');
  }
  expect(publicProgress(f.game).responding).toBe(true);
  f.act('A', { type: 'PASS' }); f.until(game => !game.windows?.length);
  expect(f.game.players.B!.damage).toBe(0); expect(viewFor(f.game, 'A').maaiDefense).toBeNull(); expect(f.game.distances).toEqual(distance);
  for (const card of cards.slice(0, required)) expect(f.game.discard.filter(id => id === card)).toHaveLength(1);
  expect(f.game.players.B!.hand).toContain(cards[required]);
});

for (const selected of [false, true]) it(`Black Bow selected=${selected} keeps the whole package and validates actual evasion before spending`, () => {
  const f = fixture('property-arnes'); const evade = f.game.players.B!.hand.find(id => getAction(id)?.name === '見切る')!;
  const event = selected ? f.use() : viewFor(f.game, 'A').abilityOptions.find(option => option.abilityId === arnes)!.targetEventId;
  if (selected) for (const actor of ['B', 'C', 'D']) {
    const view = viewFor(f.game, actor); expect(view.currentAction).toMatchObject({ source: 'ability', label: '特殊能力' });
    expect(JSON.stringify(view)).not.toContain('黒弓'); expect(JSON.stringify(view)).not.toContain(arnes);
  }
  f.until(game => game.windows?.at(-1)?.kind === 'normal-defense');
  const view = viewFor(f.game, 'B');
  expect(view.currentAttack!.technique).toMatchObject({ effectLevel: selected ? 6 : 5, damage: selected ? 12 : 10 });
  expect(view.currentAttack!.defenseRestrictions.evadeProhibited).toBe(selected);
  const before = structuredClone(f.game);
  expect(transition(f.game, { actorId: 'A', command: { type: 'USE_ABILITY', abilityId: arnes, targetEventId: event } }, entropy())).toMatchObject({ ok: false, code: 'ABILITY_DISABLED' });
  expect(f.game).toEqual(before);
  const command: GameCommand = { type: 'PLAY_DEFENSE', cardInstanceId: evade, dedicated: false };
  if (selected) {
    expect(transition(f.game, { actorId: 'B', command }, entropy())).toMatchObject({ ok: false, code: 'ILLEGAL_DEFENSE' }); expect(f.game).toEqual(before);
  } else f.act('B', command);
  f.until(game => !game.windows?.length);
  expect(f.game.players.B!.damage).toBe(selected ? 12 : 0);
  if (selected) expect(f.game.players.B!.hand).toContain(evade); else expect(f.game.discard.filter(id => id === evade)).toHaveLength(1);
});

it.each(['property-lancaster', 'property-arnes'] as const)('%s cancellation spends the attempt and retains the original defense path', name => {
  const f = fixture(name); const abilityId = name === 'property-arnes' ? arnes : lancaster; f.use();
  f.until(game => viewFor(game, 'C').activeWindow?.pendingActorId === 'C' && !!viewFor(game, 'C').reactionTargetAbilityId);
  f.act('C', { type: 'PLAY_REACTION', cardInstanceId: 'a2-p02-r2c3', mode: 'cancel-ability', targetAbilityId: viewFor(f.game, 'C').reactionTargetAbilityId! });
  f.until(game => game.windows?.at(-1)?.kind === (name === 'property-arnes' ? 'effect-level' : 'attack-abilities'));
  expect(viewFor(f.game, 'A').abilityOptions.some(option => option.abilityId === abilityId)).toBe(false);
  f.until(game => game.windows?.at(-1)?.kind === 'normal-defense');
  expect(viewFor(f.game, 'A').currentAttack!.technique).toMatchObject({ effectLevel: 5, damage: name === 'property-arnes' ? 10 : 7 });
  if (name === 'property-arnes') {
    expect(viewFor(f.game, 'B').currentAttack!.defenseRestrictions.evadeProhibited).toBe(false);
    f.act('B', { type: 'PLAY_DEFENSE', cardInstanceId: f.game.players.B!.hand.find(id => getAction(id)?.name === '見切る')!, dedicated: false });
  } else {
    expect(publicProgress(f.game).targets[0]!.required).toBe(2);
    const cards = maaiCards(f.game, 'B');
    for (const card of cards.slice(0, 2)) f.act('B', { type: 'PLAY_MAAI', cardInstanceId: card });
    expect(viewFor(f.game, 'A').activeWindow?.kind).toBe('defense-advance'); f.act('A', { type: 'PASS' });
  }
  f.until(game => !game.windows?.length);
  expect(f.game.players.B!.damage).toBe(0); expect(f.game.discard.filter(id => id === 'a2-p02-r2c3')).toHaveLength(1);
});

async function savedRoom(name: AttackPropertyScenarioName) {
  const room = await openTestRoom(name); let sequence = 0;
  async function send(actorId: string, command: GameCommand) {
    const before = await room.stored();
    const envelope = { protocolVersion: 1 as const, commandId: `property-${sequence++}`, expectedRevision: before.revision, ...activeWindowRef(before.state.game!), command };
    const ack = await room.command(actorId, envelope); expect(ack).toMatchObject({ type: 'ack' });
    const ids = allCardInstanceIds((await room.stored()).state.game!); expect(ids).toHaveLength(220); expect(new Set(ids).size).toBe(220);
    return { actorId, envelope, ack };
  }
  async function advance(done: (game: GameState) => boolean) {
    for (let i = 0; i < 500; i++) {
      const game = (await room.stored()).state.game!; if (done(game)) return;
      const window = game.windows?.at(-1); if (!window) throw Error('PROPERTY_DO_WINDOW_MISSING');
      await send(window.participants[window.cursor]!, { type: 'PASS' });
    }
    throw Error('PROPERTY_DO_WINDOW_NOT_REACHED');
  }
  async function replay(receipt: Awaited<ReturnType<typeof send>>) {
    const before = await room.stored(); await room.restart();
    expect(await room.command(receipt.actorId, receipt.envelope)).toEqual(receipt.ack); expect(await room.stored()).toEqual(before);
  }
  const option = (await room.snapshotFor('A')).game!.abilityOptions.find(option => option.abilityId === lancaster)!;
  const selected = await send('A', { type: 'USE_ABILITY', abilityId: lancaster, targetEventId: option.targetEventId });
  await replay(selected); await advance(game => game.windows?.at(-1)?.kind === 'normal-defense');
  return { ...room, send, advance, replay };
}
it('DO restores each partial maai payment and the shared advance without duplicating a card or old receipt', async () => {
  const room = await savedRoom('property-lancaster'); const initial = (await room.stored()).state.game!;
  const cards = maaiCards(initial, 'B'); const distances = structuredClone(initial.distances);
  const first = await room.send('B', { type: 'PLAY_MAAI', cardInstanceId: cards[0]! }); await room.replay(first);
  expect((await room.snapshotFor('B')).game!.maaiDefense!.targets[0]).toMatchObject({ required: 3, submitted: 1, effective: 1, remaining: 2 });
  const second = await room.send('B', { type: 'PLAY_MAAI', cardInstanceId: cards[1]! }); await room.replay(second);
  expect((await room.snapshotFor('B')).game!.maaiDefense!.targets[0]).toMatchObject({ submitted: 2, remaining: 1 });
  await room.send('B', { type: 'PLAY_MAAI', cardInstanceId: cards[2]! });
  const push = initial.players.A!.hand.find(id => getAction(id)?.name === '踏み込み／殴る')!;
  const pushed = await room.send('A', { type: 'PLAY_ADVANCE', cardInstanceId: push }); await room.replay(pushed);
  expect((await room.snapshotFor('B')).game!.maaiDefense).toMatchObject({ responding: true, sharedAdvances: 1, targets: [{ submitted: 3, effective: 2, remaining: 1 }] });
  await room.send('A', { type: 'PASS' });
  expect((await room.snapshotFor('B')).game!.maaiDefense!.targets[0]).toMatchObject({ carried: 2, submitted: 0, effective: 2, remaining: 1 });
  await room.send('B', { type: 'PLAY_MAAI', cardInstanceId: cards[3]! }); await room.send('A', { type: 'PASS' });
  await room.advance(game => !game.windows?.length); await room.replay(first); await room.replay(second); await room.replay(pushed);
  const done = (await room.stored()).state.game!;
  expect(done.players.B!.damage).toBe(0); expect(done.distances).toEqual(distances); expect(viewFor(done, 'A').maaiDefense).toBeNull();
  for (const card of [...cards, push]) expect(done.discard.filter(id => id === card)).toHaveLength(1);
});
it('DO carries independent progress for both real spear targets after one paid shared advance', async () => {
  const room = await savedRoom('property-lancaster-shared'); const initial = (await room.stored()).state.game!;
  const b = maaiCards(initial, 'B'); const c = maaiCards(initial, 'C'); const distances = structuredClone(initial.distances);
  expect(publicProgress(initial).targets.map(target => target.required)).toEqual([2, 2]);
  for (const [actor, cards] of [['B', b], ['C', c]] as const) for (const card of cards.slice(0, 2)) await room.send(actor, { type: 'PLAY_MAAI', cardInstanceId: card });
  const push = initial.players.A!.hand.find(id => getAction(id)?.name === '踏み込み／殴る')!;
  const pushed = await room.send('A', { type: 'PLAY_ADVANCE', cardInstanceId: push }); await room.replay(pushed);
  const waiting = (await room.snapshotFor('A')).game!.maaiDefense!;
  expect(waiting.sharedAdvances).toBe(1); expect(waiting.targets.map(target => [target.actorId, target.effective, target.remaining])).toEqual([['B', 1, 1], ['C', 1, 1]]);
  await room.send('A', { type: 'PASS' }); await room.restart();
  const resumed = (await room.snapshotFor('B')).game!.maaiDefense!;
  expect(resumed.targetId).toBe('B'); expect(resumed.targets.map(target => [target.carried, target.submitted, target.remaining])).toEqual([[1, 0, 1], [1, 0, 1]]);
  await room.send('B', { type: 'PLAY_MAAI', cardInstanceId: b[2]! }); await room.send('C', { type: 'PLAY_MAAI', cardInstanceId: c[2]! }); await room.send('A', { type: 'PASS' });
  await room.advance(game => !game.windows?.length); await room.replay(pushed);
  const done = (await room.stored()).state.game!;
  expect(done.players.B!.damage).toBe(0); expect(done.players.C!.damage).toBe(0); expect(done.distances).toEqual(distances);
  for (const card of [...b, ...c, push]) expect(done.discard.filter(id => id === card)).toHaveLength(1);
});
