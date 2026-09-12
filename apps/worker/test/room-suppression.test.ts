import { reset } from 'cloudflare:test';
import { afterEach, expect, it } from 'vitest';
import { activeWindowRef, allCardInstanceIds, viewFor, type GameState } from '@madou/engine';
import type { ClientEnvelope, GameCommand } from '@madou/protocol';
import { openTestRoom } from './fixtures/recovery-room.js';

const BAN = 'c2-p07-r1c2-ab03', BLESS = 'c2-p03-r1c2-ab04';
afterEach(async () => { await reset(); });
type Room = Awaited<ReturnType<typeof openTestRoom>>;
async function game(room: Room) { return (await room.stored()).state.game!; }
async function request(room: Room, id: string, command: GameCommand): Promise<ClientEnvelope> {
  const stored = await room.stored();
  return { protocolVersion: 1, commandId: id, expectedRevision: stored.revision, ...activeWindowRef(stored.state.game!)!, command };
}
async function send(room: Room, actor: string, id: string, command: GameCommand) {
  const envelope = await request(room, id, command); const ack = await room.command(actor, envelope);
  expect(ack).toMatchObject({ type: 'ack' });
  const ids = allCardInstanceIds(await game(room)); expect(ids).toHaveLength(220); expect(new Set(ids).size).toBe(220);
  const saved=await room.stored();await room.restart();expect(await room.command(actor,envelope)).toEqual(ack);expect(await room.stored()).toEqual(saved);
  return { actor, envelope, ack };
}
async function replay(room: Room, accepted: Awaited<ReturnType<typeof send>>) {
  const before = await room.stored(); await room.restart();
  expect(await room.command(accepted.actor, accepted.envelope)).toEqual(accepted.ack);
  expect(await room.stored()).toEqual(before);
}
async function until(room: Room, done: (state: GameState) => boolean, prefix: string) {
  let last: Awaited<ReturnType<typeof send>> | undefined;
  for (let i = 0; i < 150; i++) {
    const state = await game(room); if (done(state)) return last;
    const window = state.windows?.at(-1); expect(window, `${prefix} needs a legal window`).toBeDefined();
    last = await send(room, window!.participants[window!.cursor]!, `${prefix}-${i}`, { type: 'PASS' });
  }
  throw Error(`SUPPRESSION_TEST_LIMIT_${prefix}`);
}
const settle = (room: Room, prefix: string) => until(room, state => !state.windows?.length, prefix);
async function declare(room: Room, actor: string, id: string, abilityId: typeof BAN | typeof BLESS, targets: string[]) {
  const option = viewFor(await game(room), actor).abilityOptions.find(option => option.abilityId === abilityId);
  expect(option).toBeDefined();
  return send(room, actor, id, { type: 'USE_ABILITY', abilityId, targetEventId: option!.targetEventId,
    ...(abilityId === BAN ? { targetIds: targets } : { targetId: targets[0]! }) });
}
async function toLiaTurn(room: Room) {
  for (const actor of ['A', 'B']) {
    let state = await game(room);
    if (state.phase === 'turn-start') { await send(room, actor, `start-${actor}`, { type: 'START_TURN' }); await settle(room, `start-pass-${actor}`); await send(room, actor, `draw-${actor}`, { type: 'CHOOSE_DRAW', draw: false }); await settle(room, `draw-pass-${actor}`); }
    state = await game(room);
    if (state.phase === 'action') await send(room, actor, `action-${actor}`, { type: 'PASS_ACTION' });
    if ((await game(room)).phase === 'withdrawal') await send(room, actor, `withdraw-${actor}`, { type: 'PASS_WITHDRAWAL' });
    state = await game(room);
    await send(room, actor, `end-${actor}`, { type: 'END_TURN', discardIds: state.players[actor]!.hand.slice(0, Math.max(0, state.players[actor]!.hand.length - 5)) });
    await settle(room, `end-pass-${actor}`);
  }
  await send(room, 'C', 'start-C', { type: 'START_TURN' }); await settle(room, 'start-pass-C');
  await send(room, 'C', 'draw-C', { type: 'CHOOSE_DRAW', draw: false }); await settle(room, 'draw-pass-C');
}
async function cancelWithFate(room: Room, prefix: string) {
  await until(room, state => state.windows?.at(-1)?.participants[state.windows!.at(-1)!.cursor] === 'D', `${prefix}-to-D`);
  const targetAbilityId = viewFor(await game(room), 'D').reactionTargetAbilityId;
  expect(targetAbilityId).toBeTruthy();
  return send(room, 'D', `${prefix}-fate`, { type: 'PLAY_REACTION', cardInstanceId: 'a2-p02-r2c3', mode: 'cancel-ability', targetAbilityId: targetAbilityId! });
}

it('real ritual supplies Vanmil and actual multi-target ban survives declaration and result eviction', async () => {
  const room = await openTestRoom('suppression-blessing');
  expect(room.initial.players.A).toMatchObject({ characterId: 'c2-p07-r1c2', revealed: true, damage: 0 });
  expect(room.initial.players.A!.abilityCharacterIds).not.toContain('c2-p05-r1c1');
  expect(room.initial.suppressionDesignations ?? []).toEqual([]);
  const initial = await room.stored(); await room.restart(); expect(await room.stored()).toEqual(initial);
  expect(viewFor(await game(room),'A').abilityOptions.find(o=>o.abilityId===BAN)!.targetIds).toEqual(['A','B','C','D']);
  await send(room,'C','reveal-public-exemption',{type:'REVEAL_CHARACTER'});await settle(room,'reveal-public');
  expect(viewFor(await game(room),'A').abilityOptions.find(o=>o.abilityId===BAN)!.targetIds).toEqual(['A','B','D']);
  const declaration = await declare(room, 'A', 'ban', BAN, ['B', 'D']); await replay(room, declaration);
  expect((await game(room)).suppressionDesignations ?? []).toEqual([]);
  const result = await settle(room, 'ban-resolve'); expect(result).toBeDefined(); await replay(room, result!);
  expect((await game(room)).suppressionDesignations?.map(value => value.targetId)).toEqual(['B', 'D']);
  expect((await room.snapshotFor('A')).game!.suppressionTargets).toEqual([
    { targetId: 'B', designated: true, applicability: 'private' }, { targetId: 'D', designated: true, applicability: 'private' },
  ]);
});

it('hidden Lia and hidden ordinary target have the same outside WS and ACK transcripts before and after ban', async () => {
  const ordinary = await openTestRoom('suppression-hidden-ordinary'); const exempt = await openTestRoom('suppression-hidden-lia');
  async function same() {
    for (const actor of ['A', 'C', 'D']) expect((await exempt.snapshotFor(actor)).game).toEqual((await ordinary.snapshotFor(actor)).game);
  }
  await same();
  const first = await declare(ordinary, 'A', 'paired-ban', BAN, ['B']); const second = await declare(exempt, 'A', 'paired-ban', BAN, ['B']);
  expect(second.envelope).toEqual(first.envelope); expect(second.ack).toEqual(first.ack); await same();
  for (let i = 0; i < 150; i++) {
    const state = await game(ordinary); if (!state.windows?.length) break;
    const window = state.windows.at(-1)!; const actor = window.participants[window.cursor]!;
    const left = await send(ordinary, actor, `paired-pass-${i}`, { type: 'PASS' });
    const right = await send(exempt, actor, `paired-pass-${i}`, { type: 'PASS' });
    expect(right.ack).toEqual(left.ack); await same();
  }
  expect((await game(ordinary)).windows).toEqual([]); expect((await game(exempt)).windows).toEqual([]);
  expect((await exempt.snapshotFor('B')).game!.suppressionTargets[0]?.applicability).toBe('exempt');
  expect((await ordinary.snapshotFor('B')).game!.suppressionTargets[0]?.applicability).toBe('suppressed');
  await ordinary.restart(); await exempt.restart(); await same();
});

it('public exempt, stale opportunity, fake target and repeated no-change ban reject without durable mutation', async () => {
  const room = await openTestRoom('suppression-blessing');
  await send(room, 'C', 'reveal-lia', { type: 'REVEAL_CHARACTER' }); await settle(room, 'reveal-pass');
  const option = viewFor(await game(room), 'A').abilityOptions.find(value => value.abilityId === BAN)!;
  expect(option.targetIds).not.toContain('C');
  const staleRevision = await request(room, 'stale-revision', { type: 'USE_ABILITY', abilityId: BAN, targetIds: ['B'], targetEventId: option.targetEventId });
  staleRevision.expectedRevision--;
  const beforeStale = await room.stored();
  expect(await room.command('A', staleRevision)).toMatchObject({ type: 'error', code: 'STALE_REVISION' });
  expect(await room.stored()).toEqual(beforeStale);
  for (const [id, targetIds, targetEventId] of [['public-exempt', ['C'], option.targetEventId], ['fake', ['missing'], option.targetEventId], ['stale-event', ['B'], 'old-opportunity']] as const) {
    const before = await room.stored();
    expect(await room.command('A', await request(room, id, { type: 'USE_ABILITY', abilityId: BAN, targetIds: [...targetIds], targetEventId }))).toMatchObject({ type: 'error' });
    expect(await room.stored()).toEqual(before);
  }
  await declare(room, 'A', 'ban-once', BAN, ['B']); await settle(room, 'once-pass');
  // A receives a genuinely new public response opportunity in C's Blessing declaration.
  await toLiaTurn(room);
  await declare(room, 'C', 'open-second-window', BLESS, ['B']);
  await until(room, state => state.windows?.at(-1)?.participants[state.windows!.at(-1)!.cursor] === 'A', 'repeat-to-A');
  // No-change cannot succeed even if forged with the current offered event; refusal remains atomic.
  const before = await room.stored(); const current = viewFor(before.state.game!, 'A').abilityOptions.find(value => value.abilityId === BAN);
  expect(current).toBeDefined();
  expect(await room.command('A', await request(room, 'repeat-ban', { type: 'USE_ABILITY', abilityId: BAN, targetIds: ['B'], targetEventId: current?.targetEventId ?? option.targetEventId }))).toMatchObject({ type: 'error' });
  expect(await room.stored()).toEqual(before);
});

it('canceled actual ban retains payment and attempt through eviction without making a designation', async () => {
  const room = await openTestRoom('suppression-blessing');
  const first = await declare(room, 'A', 'cancel-ban', BAN, ['B']);
  const reaction = await cancelWithFate(room, 'cancel'); await replay(room, reaction);
  const result = await settle(room, 'cancel-finish'); if (result) await replay(room, result);
  const state = await game(room);
  expect(state.suppressionDesignations ?? []).toEqual([]);
  expect(state.players.D!.hand).not.toContain('a2-p02-r2c3'); expect(state.discard).toContain('a2-p02-r2c3');
  expect(viewFor(state, 'A').abilityOptions.some(value => value.abilityId === BAN && value.targetEventId === (first.envelope.command as Extract<GameCommand, { type: 'USE_ABILITY' }>).targetEventId)).toBe(false);
});

it.each(['suppression-blessing', 'suppression-blessing-fail'] as const)('%s persists actual spirit-minus-five roll and spends the attempt on either result', async scenario => {
  const room = await openTestRoom(scenario);
  await declare(room, 'A', 'pre-blessing-ban', BAN, ['B']); await settle(room, 'pre-blessing-pass'); await toLiaTurn(room);
  const declaration = await declare(room, 'C', 'blessing', BLESS, ['B']); await replay(room, declaration);
  const resultCommand = await until(room, state => state.rolls?.some(roll => roll.rollerId === 'C' && roll.stage === 'after-roll') ?? false, 'bless-to-roll');
  expect(resultCommand).toBeDefined(); await replay(room, resultCommand!);
  const rolled = (await game(room)).rolls!.at(-1)!;
  expect(rolled.formula).toBe('2d6'); expect(rolled.modifier).toBe(-5); expect(rolled.faces).toHaveLength(2);
  // No exact dice claim: the initial spirit correction makes all possible 2d6 totals pass/fail.
  const success = scenario === 'suppression-blessing'; expect(rolled.success).toBe(success);
  const last = await settle(room, 'bless-finish'); if (last) await replay(room, last);
  expect((await game(room)).blessingLeases?.length ?? 0).toBe(success ? 1 : 0);
  expect(viewFor(await game(room), 'C').abilityOptions.some(value => value.abilityId === BLESS)).toBe(false);
  expect(viewFor(await game(room), 'C').legalChoices).toContain('PASS_ACTION');
});

it('canceling Blessing returns neither the own-turn attempt nor a lease after DO reload', async () => {
  const room = await openTestRoom('suppression-blessing');
  await declare(room, 'A', 'ban-for-cancel-bless', BAN, ['B']); await settle(room, 'ban-for-cancel-pass'); await toLiaTurn(room);
  await declare(room, 'C', 'cancel-bless', BLESS, ['B']);
  const reaction = await cancelWithFate(room, 'bless-cancel'); await replay(room, reaction); await settle(room, 'bless-cancel-finish');
  expect((await game(room)).blessingLeases ?? []).toEqual([]);
  expect((await game(room)).rolls?.some(roll => roll.rollerId === 'C') ?? false).toBe(false);
  expect(viewFor(await game(room), 'C').abilityOptions.some(value => value.abilityId === BLESS)).toBe(false);
});

it('actual next-turn Vanmil ban preserves the unused main action through every restart and replay',async()=>{
  const room=await openTestRoom('suppression-next-action');
  expect((await game(room)).phase).toBe('action');expect(viewFor(await game(room),'A').legalChoices).toContain('PASS_ACTION');
  const receipt=await declare(room,'A','next-turn-ban',BAN,['B']);await settle(room,'next-turn-ban-settle');await replay(room,receipt);
  expect((await game(room)).suppressionDesignations?.map(d=>d.targetId)).toEqual(['B']);
  expect((await game(room)).phase).toBe('action');expect(viewFor(await game(room),'A').legalChoices).toContain('PASS_ACTION');
  await send(room,'A','end-retained-action',{type:'PASS_ACTION'});expect((await game(room)).phase).toBe('hand-adjustment');
});
