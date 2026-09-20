import { reset } from 'cloudflare:test';
import { afterEach, expect, it, vi } from 'vitest';
import { activeWindowRef, allCardInstanceIds, viewFor, type GameState, discardIds } from '@madou/engine';
import type { ClientEnvelope, GameCommand } from '@madou/protocol';
import { openTestRoom } from './fixtures/recovery-room.js';

/** What each participant may see of a shared game, held across eviction and duplicate receipts. */
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

it.each(['canonical-S15-before','canonical-S15-after','canonical-S16'] as const)('%s real hit and reveal boundary survives every restart and duplicate receipt',async scenario=>{
 const room=await openTestRoom(scenario),zero=scenario==='canonical-S16';let seq=0;const state=async()=>(await room.stored()).state.game!;
 async function step(actorId:string,command:GameCommand){const before=await room.stored(),envelope={protocolVersion:1 as const,commandId:`reveal-${seq++}`,expectedRevision:before.revision,...activeWindowRef(before.state.game!),command},ack=await room.command(actorId,envelope);expect(ack).toMatchObject({type:'ack'});const saved=await room.stored(),ids=allCardInstanceIds(saved.state.game!);expect(ids).toHaveLength(220);expect(new Set(ids).size).toBe(220);await room.restart();expect(await room.command(actorId,envelope)).toEqual(ack);expect(await room.stored()).toEqual(saved);}
 expect((await state()).players.B!.revealed).toBe(false);
 if(zero){const group=Object.values((await state()).groups!)[0]!;expect(group.technique.damage).toBe(0);expect(group.targets[0]!.hits[0]!.damage).toBe(0);}else await step('B',{type:'REVEAL_CHARACTER'});
 for(let n=0;n<300;n++){const s=await state(),w=s.windows?.at(-1);if(!w)break;await step(w.participants[w.cursor]!,{type:'PASS'});}
 const final=await state();expect(final.windows??[]).toEqual([]);expect(final.players.B!.revealed).toBe(true);expect(final.players.B!.damage).toBe(scenario==='canonical-S15-after'?4:0);expect(discardIds(final).filter(id=>id===(zero?'a2-p08-r3c3':'a2-p24-r1c2'))).toHaveLength(1);
});

it('S21 White Light6 hidden alternate worlds keep foreign snapshots equal until hit through restart and duplicate receipt',async()=>{
 const rooms=[await openTestRoom('r6-s21'),await openTestRoom('r6-s21-control')];
 expect((await rooms[0]!.snapshotFor('B')).game!.abilityOptions.some(o=>o.abilityId==='c2-p01-r1c1-ab01')).toBe(true);
 for(let n=0;n<300;n++){
  const states=await Promise.all(rooms.map(async r=>(await r.stored()).state.game!));
  expect(states[0]!.players.B!.revealed).toBe(states[1]!.players.B!.revealed);
  if(!states[0]!.players.B!.revealed)for(const actor of ['A','C','D']){
   const views=await Promise.all(rooms.map(r=>r.snapshotFor(actor)));
   // Separate rooms commit at different wall-clock times; the public record's content must still match.
   const [left,right]=views.map(v=>({...v.game!,logs:v.game!.logs.map(log=>({...log,at:0}))}));expect(left).toEqual(right);
   expect(JSON.stringify(views[0]!.game)).not.toContain('c2-p01-r1c1');
  }
  const w=states[0]!.windows?.at(-1);if(!w)break;
  expect(states[1]!.windows?.at(-1)).toEqual(w);
  for(const room of rooms){const before=await room.stored(),envelope={protocolVersion:1 as const,commandId:`s21-${n}`,expectedRevision:before.revision,...activeWindowRef(before.state.game!),command:{type:'PASS' as const}};
   const ack=await room.command(w.participants[w.cursor]!,envelope);expect(ack).toMatchObject({type:'ack'});const saved=await room.stored(),ids=allCardInstanceIds(saved.state.game!);expect(ids).toHaveLength(220);expect(new Set(ids).size).toBe(220);await room.restart();expect(await room.command(w.participants[w.cursor]!,envelope)).toEqual(ack);expect(await room.stored()).toEqual(saved);
  }
 }
 for(const room of rooms){const s=(await room.stored()).state.game!;expect(s.windows??[]).toEqual([]);expect(s.players.B).toMatchObject({damage:6,revealed:true});expect(discardIds(s).filter(id=>id==='a2-p14-r1c2')).toHaveLength(1);for(const actor of ['A','C','D'])expect(JSON.stringify((await room.snapshotFor(actor)).game)).not.toContain('c2-p01-r1c1-ab01');}
});

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

it.each([false, true])('G09 optional critical use %s survives eviction and replay without exposing identity', async use => {
  const room = await openTestRoom('ability-critical');
  const abilityId = 'c2-p04-r2c2-ab03';
  const before = await room.stored();
  let sequence = 0;
  async function privateViews() {
    for (const actor of ['B', 'C', 'D']) {
      const view = (await room.snapshotFor(actor)).game!;
      expect(view.players.A).not.toHaveProperty('characterId');
      expect(JSON.stringify(view)).not.toContain('c2-p04-r2c2');
      expect(view.abilityOptions.some(option => option.abilityId === abilityId)).toBe(false);
    }
  }
  async function step(actor: string, command: GameCommand) {
    const stored = await room.stored();
    const envelope: ClientEnvelope = { protocolVersion: 1, commandId: `optional-${sequence++}`,
      expectedRevision: stored.revision, ...activeWindowRef(stored.state.game!)!, command };
    const reply = await room.command(actor, envelope);
    expect(reply).toMatchObject({ type: 'ack' });
    const committed = await room.stored();
    const views = await Promise.all(['A', 'B', 'C', 'D'].map(async id => (await room.snapshotFor(id)).game));
    await room.restart();
    expect(await room.command(actor, envelope)).toEqual(reply);
    expect(await room.stored()).toEqual(committed);
    expect(await Promise.all(['A', 'B', 'C', 'D'].map(async id => (await room.snapshotFor(id)).game))).toEqual(views);
    expect(allCardInstanceIds(committed.state.game!)).toHaveLength(220);
    expect(new Set(allCardInstanceIds(committed.state.game!)).size).toBe(220);
    await privateViews();
  }
  await privateViews();
  await room.restart();
  expect(await room.stored()).toEqual(before);
  if (use) {
    const option = (await room.snapshotFor('A')).game!.abilityOptions.find(option => option.abilityId === abilityId)!;
    await step('A', { type: 'USE_ABILITY', abilityId, targetEventId: option.targetEventId });
    expect((await room.snapshotFor('B')).game!.currentAction).toMatchObject({ source: 'ability', label: '特殊能力' });
  }
  for (let n = 0; n < 300; n++) {
    const state = (await room.stored()).state.game!;
    const window = state.windows?.at(-1);
    if (!window) break;
    await step(window.participants[window.cursor]!, { type: 'PASS' });
  }
  const done = (await room.stored()).state.game!;
  expect(done.windows ?? []).toEqual([]);
  expect(done.players.A!.revealed).toBe(false);
  expect(done.used?.filter(key => key.includes(abilityId)) ?? []).toHaveLength(use ? 1 : 0);
  const rolls = done.rolls?.filter(roll => roll.purpose === 'ability-value') ?? [];
  expect(rolls).toHaveLength(use ? 1 : 0);
  if (use) {
    const faces = rolls[0]!.faces;
    expect(faces).toHaveLength(2);
    if (faces[0] === faces[1]) expect(done.players.B!.presence).toBe('dead');
    else expect(done.players.B!.damage).toBe(Math.abs(faces[0]! - faces[1]!) === 1 ? 8 : 4);
  } else {
    expect(done.players.B!.damage).toBe(4);
    expect(done.used).toEqual(before.state.game!.used);
  }
  await privateViews();
});
