import { reset } from 'cloudflare:test';
import { afterEach, expect, it, vi } from 'vitest';
import { activeWindowRef, allCardInstanceIds, viewFor, type GameState } from '@madou/engine';
import type { ClientEnvelope, GameCommand } from '@madou/protocol';
import { openTestRoom } from './fixtures/recovery-room.js';

const BAN = 'c2-p07-r1c2-ab03', BLESS = 'c2-p03-r1c2-ab04';
afterEach(async () => { vi.restoreAllMocks(); await reset(); });
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
async function toLiaTurn(room: Room, actors=['A','B'], next='C') {
  for (const actor of actors) {
    let state = await game(room);
    if (state.phase === 'turn-start') { await send(room, actor, `start-${actor}`, { type: 'START_TURN' }); await settle(room, `start-pass-${actor}`); await send(room, actor, `draw-${actor}`, { type: 'CHOOSE_DRAW', draw: false }); await settle(room, `draw-pass-${actor}`); }
    state = await game(room);
    if (state.phase === 'action') await send(room, actor, `action-${actor}`, { type: 'PASS_ACTION' });
    if ((await game(room)).phase === 'withdrawal') await send(room, actor, `withdraw-${actor}`, { type: 'PASS_WITHDRAWAL' });
    state = await game(room);
    await send(room, actor, `end-${actor}`, { type: 'END_TURN', discardIds: state.players[actor]!.hand.slice(0, Math.max(0, state.players[actor]!.hand.length - 5)) });
    await settle(room, `end-pass-${actor}`);
  }
  await send(room, next, `start-${next}`, { type: 'START_TURN' }); await settle(room, `start-pass-${next}`);
  await send(room, next, `draw-${next}`, { type: 'CHOOSE_DRAW', draw: false }); await settle(room, `draw-pass-${next}`);
}
async function cancelWithFate(room: Room, prefix: string) {
  await until(room, state => state.windows?.at(-1)?.participants[state.windows!.at(-1)!.cursor] === 'D', `${prefix}-to-D`);
  const targetAbilityId = viewFor(await game(room), 'D').reactionTargetAbilityId;
  expect(targetAbilityId).toBeTruthy();
  return send(room, 'D', `${prefix}-fate`, { type: 'PLAY_REACTION', cardInstanceId: 'a2-p02-r2c3', mode: 'cancel-ability', targetAbilityId: targetAbilityId! });
}

it('actual exempt and ordinary Blessing share saved checks leases attempts and outside transcripts',async()=>{
 vi.spyOn(Date,'now').mockReturnValue(1000);
 vi.spyOn(crypto,'getRandomValues').mockImplementation(<T extends ArrayBufferView|null>(array:T):T=>{if(array instanceof Uint32Array)array.fill(0);return array;});
 const rooms=[await openTestRoom('suppression-blessing-paired'),await openTestRoom('suppression-blessing-exempt')];
 async function same(){for(const actor of ['A','C','D'])expect((await rooms[1]!.snapshotFor(actor)).game).toEqual((await rooms[0]!.snapshotFor(actor)).game);}
 async function paired(actor:string,id:string,command:GameCommand){const first=await send(rooms[0]!,actor,id,command),second=await send(rooms[1]!,actor,id,command);expect(second.envelope).toEqual(first.envelope);expect(second.ack).toEqual(first.ack);await same();}
 async function finish(prefix:string){for(let n=0;n<150;n++){const w=(await game(rooms[0]!)).windows?.at(-1);if(!w)return;await paired(w.participants[w.cursor]!,`${prefix}-${n}`,{type:'PASS'});}throw Error('PAIRED_BLESSING_LIMIT');}
 await same();const ban=viewFor(await game(rooms[0]!),'A').abilityOptions.find(o=>o.abilityId===BAN)!;
 await paired('A','ban',{type:'USE_ABILITY',abilityId:BAN,targetEventId:ban.targetEventId,targetIds:['B']});await finish('ban');
 for(const room of rooms)await toLiaTurn(room);await same();
 expect((await rooms[0]!.snapshotFor('B')).game!.suppressionTargets[0]!.applicability).toBe('suppressed');expect((await rooms[1]!.snapshotFor('B')).game!.suppressionTargets[0]!.applicability).toBe('exempt');
 const option=viewFor(await game(rooms[0]!),'C').abilityOptions.find(o=>o.abilityId===BLESS)!;expect(option.targetIds).toEqual(['B']);
 await paired('C','bless',{type:'USE_ABILITY',abilityId:BLESS,targetEventId:option.targetEventId,targetId:'B'});await finish('bless');
 const states=await Promise.all(rooms.map(room=>game(room)));expect(states[1]!.blessingLeases).toEqual(states[0]!.blessingLeases);expect(states[0]!.blessingLeases).toHaveLength(1);
 for(const [i,room] of rooms.entries()){const state=states[i]!;expect(state.rolls!.find(r=>r.rollerId==='C')).toMatchObject({formula:'2d6',modifier:-5,faces:[1,1],success:true});expect(viewFor(state,'C').abilityOptions.some(o=>o.abilityId===BLESS)).toBe(false);expect(viewFor(state,'C').legalChoices).toContain('PASS_ACTION');await room.restart();for(const actor of state.seatOrder)expect((await room.snapshotFor(actor)).game).toEqual(viewFor(state,actor));}await same();
});
