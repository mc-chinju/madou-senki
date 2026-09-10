import {reset} from 'cloudflare:test';
import {afterEach,expect,it,vi} from 'vitest';
import {openTestRoom} from './fixtures/recovery-room.js';
afterEach(async()=>{vi.restoreAllMocks();await reset();});
import {activeWindowRef,allCardInstanceIds,gameStats,viewFor,type GameCommand,type GameState} from '@madou/engine';
import {ritualCard} from './fixtures/ritual-physical-scenarios.js';
it('actual approach and spent Curse recovery persist through ritual under every DO eviction and replay',async()=>{
 vi.spyOn(crypto,'getRandomValues').mockImplementation(<T extends ArrayBufferView|null>(array:T):T=>{if(array instanceof Uint32Array)array.fill(0);return array;});
 const room=await openTestRoom('ritual-history');let seq=0,s=(await room.stored()).state.game!;
 const curse='a2-p13-r3c2';
 async function send(actorId:string,command:GameCommand){
  const before=await room.stored(),envelope={protocolVersion:1 as const,commandId:`ritual-history-${seq++}`,expectedRevision:before.revision,...activeWindowRef(before.state.game!),command},ack=await room.command(actorId,envelope);
  expect(ack).toMatchObject({type:'ack'});const saved=await room.stored();s=saved.state.game!;expect(allCardInstanceIds(s)).toHaveLength(220);expect(new Set(allCardInstanceIds(s)).size).toBe(220);
  await room.restart();expect(await room.command(actorId,envelope)).toEqual(ack);expect(await room.stored()).toEqual(saved);
  for(const id of s.seatOrder)expect((await room.snapshotFor(id)).game).toEqual(viewFor(s,id));
 }
 async function step(){const w=s.windows?.at(-1),id=s.seatOrder[s.turnSeat]!;
  if(w)await send(w.participants[w.cursor]!,{type:'PASS'});
  else if(s.phase==='action')await send(id,{type:'PASS_ACTION'});
  else if(s.phase==='withdrawal')await send(id,{type:'PASS_WITHDRAWAL'});
  else if(s.phase==='hand-adjustment')await send(id,{type:'END_TURN',discardIds:s.players[id]!.hand.filter(x=>![curse,ritualCard].includes(x)).slice(0,Math.max(0,s.players[id]!.hand.length-gameStats(s,id).handLimit))});
  else if(s.phase==='turn-start')await send(id,{type:'START_TURN'});
  else if(s.phase==='draw')await send(id,{type:'CHOOSE_DRAW',draw:false});
  else throw Error(`RITUAL_HISTORY_PHASE_${s.phase}`);
 }
 async function until(done:(s:GameState)=>boolean){for(let n=0;n<600;n++){if(done(s))return;expect(s.outcome).toBeUndefined();await step();}throw Error('RITUAL_HISTORY_LIMIT');}
 const ownAction=(s:GameState)=>!s.windows?.length&&s.phase==='action'&&s.seatOrder[s.turnSeat]==='A';
 const initialDistances=structuredClone(s.distances);
 await send('A',{type:'APPROACH',cardInstanceId:'a2-p24-r1c1',targetId:'B'});await until(ownAction);
 expect(s.distances).not.toEqual(initialDistances);
 await send('A',{type:'CHANT',cardInstanceId:curse});await until(ownAction);
 await send('A',{type:'ATTACK',cardInstanceId:curse,targetIds:['C'],dedicated:false});
 await until(s=>s.windows?.at(-1)?.kind==='reclaim'&&viewFor(s,'A').reclaim?.pendingActorId==='A'&&viewFor(s,'A').reclaim?.cardInstanceId===curse);
 const reclaim=viewFor(s,'A').reclaim!,base=reclaim.claims.find(c=>c.right==='base');expect(base).toBeDefined();
 await send('A',{type:'CHOOSE_RECLAIM',decisionId:reclaim.decisionId,choice:'take',claimId:base!.claimId});await until(ownAction);
 expect(s.players.A!.reclaimUsage?.['呪殺']?.baseSpent).toBe(true);expect(s.players.A!.hand.filter(id=>id===curse)).toHaveLength(1);
 const before=structuredClone(s.players.A!),distances=structuredClone(s.distances),used=structuredClone(s.used);
 expect(distances).not.toEqual(initialDistances);
 await send('A',{type:'USE_REVIVAL_RITUAL'});await until(s=>s.windows?.at(-1)?.kind==='lifecycle-boundary');
 expect(s.players.A).toMatchObject({characterId:'c2-p07-r1c2',damage:0,abilityCharacterIds:['c2-p07-r1c2']});
 expect(s.players.A!.lifeId).toBe(before.lifeId);expect(s.players.A!.reclaimUsage).toEqual(before.reclaimUsage);expect(s.distances).toEqual(distances);expect(s.used).toEqual(used);
 for(const key of ['followers','attachments','chants','open','permanent'] as const)expect(s.players.A![key]).toEqual(before[key]);
 expect(s.players.A!.hand).toEqual(before.hand.filter(id=>id!==ritualCard));
 await until(s=>!s.windows?.length);expect(s.players.A!.reclaimUsage?.['呪殺']?.baseSpent).toBe(true);expect(s.distances).toEqual(distances);
 expect(s.discard.filter(id=>id===ritualCard)).toHaveLength(1);expect(s.players.A!.hand.filter(id=>id===curse)).toHaveLength(1);expect(s.outcome).toBeUndefined();
},30000);
