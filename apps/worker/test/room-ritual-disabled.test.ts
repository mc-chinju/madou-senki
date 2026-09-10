import {reset,runInDurableObject} from 'cloudflare:test';
import {afterEach,expect,it} from 'vitest';
import {openTestRoom} from './fixtures/recovery-room.js';
import type {CanonicalRoom} from './fixtures/canonical-room.js';
afterEach(async()=>{await reset();});
import {activeWindowRef,allCardInstanceIds,gameStats,viewFor,type GameCommand,type GameState} from '@madou/engine';
import {entropy} from './fixtures/scenario-tools.js';
import {ritualCard} from './fixtures/ritual-physical-scenarios.js';
it.each(['ritual-disabled','ritual-stopped'] as const)('%s actual mental attack and ritual boundary persist under every DO eviction and replay',async scenario=>{
 const room=await openTestRoom(scenario);let seq=0,s=(await room.stored()).state.game!;
 async function send(actorId:string,command:GameCommand){
  const before=await room.stored(),envelope={protocolVersion:1 as const,commandId:`disabled-${seq++}`,expectedRevision:before.revision,...activeWindowRef(before.state.game!),command};
  await runInDurableObject(room.room,instance=>{(instance as CanonicalRoom).setNextEntropy({...entropy(),dice:Array(100).fill(6)});});
  const ack=await room.command(actorId,envelope);expect(ack).toMatchObject({type:'ack'});const saved=await room.stored();s=saved.state.game!;expect(allCardInstanceIds(s)).toHaveLength(220);expect(new Set(allCardInstanceIds(s)).size).toBe(220);
  await room.restart();expect(await room.command(actorId,envelope)).toEqual(ack);expect(await room.stored()).toEqual(saved);
  for(const id of s.seatOrder)expect((await room.snapshotFor(id)).game).toEqual(viewFor(s,id));
 }
 async function step(){const w=s.windows?.at(-1),id=s.seatOrder[s.turnSeat]!;
  if(w)await send(w.participants[w.cursor]!,{type:'PASS'});
  else if(s.phase==='action')await send(id,{type:'PASS_ACTION'});
  else if(s.phase==='withdrawal')await send(id,{type:'PASS_WITHDRAWAL'});
  else if(s.phase==='hand-adjustment')await send(id,{type:'END_TURN',discardIds:s.players[id]!.hand.filter(x=>x!==ritualCard).slice(0,Math.max(0,s.players[id]!.hand.length-gameStats(s,id).handLimit))});
  else if(s.phase==='turn-start')await send(id,{type:'START_TURN'});
  else if(s.phase==='draw')await send(id,{type:'CHOOSE_DRAW',draw:false});
  else throw Error(`RITUAL_DISABLED_PHASE_${s.phase}`);
 }
 async function until(done:(s:GameState)=>boolean){for(let n=0;n<600;n++){if(done(s))return;expect(s.outcome).toBeUndefined();await step();}throw Error('RITUAL_DISABLED_LIMIT');}
 await send('D',{type:'ATTACK',cardInstanceId:scenario==='ritual-disabled'?'a2-p13-r1c2':'a2-p13-r2c1',targetIds:['A'],dedicated:false});
 if(scenario==='ritual-stopped'){
  await until(s=>!s.windows?.length&&s.phase==='turn-start'&&s.seatOrder[s.turnSeat]==='A');
  await send('A',{type:'START_TURN'});
  await until(s=>!s.windows?.length&&s.phase==='turn-start'&&s.seatOrder[s.turnSeat]==='B');
 }else await until(s=>!s.windows?.length&&s.phase==='action'&&s.seatOrder[s.turnSeat]==='A');
 const before=structuredClone(s),kind=scenario==='ritual-disabled'?'ability-disabled':'stopped';expect(s.players.A!.statuses?.some(x=>x.kind===kind)).toBe(true);
 if(scenario==='ritual-stopped'){
  const stored=await room.stored(),envelope={protocolVersion:1 as const,commandId:'stopped-ritual',expectedRevision:stored.revision,...activeWindowRef(s),command:{type:'USE_REVIVAL_RITUAL' as const}},error=await room.command('A',envelope);
  expect(error).toMatchObject({type:'error',code:'INVALID_ACTION'});expect((await room.stored()).state.game).toEqual(before);await room.restart();expect(await room.command('A',envelope)).toEqual(error);expect((await room.stored()).state.game).toEqual(before);
  for(const id of s.seatOrder)expect((await room.snapshotFor(id)).game).toEqual(viewFor(before,id));expect(s.players.A!.hand).toContain(ritualCard);return;
 }
 expect(viewFor(s,'A').abilityOptions.some(o=>o.abilityId==='c2-p05-r1c1-ab01')).toBe(false);
 await send('A',{type:'USE_REVIVAL_RITUAL'});await until(s=>s.windows?.at(-1)?.kind==='lifecycle-boundary');expect(s.players.A).toMatchObject({characterId:'c2-p07-r1c2',damage:0,abilityCharacterIds:['c2-p07-r1c2']});expect(gameStats(s,'A').endurance).toBe(25);expect(s.players.A!.statuses).toEqual(before.players.A!.statuses);
 await until(s=>!s.windows?.length);expect(s.discard.filter(id=>id===ritualCard)).toHaveLength(1);expect(s.players.A!.hand).toEqual(before.players.A!.hand.filter(id=>id!==ritualCard));expect(s.outcome).toBeUndefined();
},30000);
