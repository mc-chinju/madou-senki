import {reset,runInDurableObject} from 'cloudflare:test';
import {afterEach,expect,it} from 'vitest';
import {openTestRoom} from './fixtures/recovery-room.js';
import type {CanonicalRoom} from './fixtures/canonical-room.js';
afterEach(async()=>{await reset();});
import {activeWindowRef,allCardInstanceIds,gameStats,viewFor,type GameCommand,type GameState} from '@madou/engine';
import {entropy} from './fixtures/scenario-tools.js';
import {ritualCard} from './fixtures/ritual-physical-scenarios.js';
it('actual ritual Vanmil otherworld absence does not trigger terminal after every DO eviction and replay',async()=>{
 const room=await openTestRoom('ritual-otherworld');let seq=0,s=(await room.stored()).state.game!;
 const spear='a2-p14-r2c2';
 async function send(actorId:string,command:GameCommand,face=1){
  const before=await room.stored(),envelope={protocolVersion:1 as const,commandId:`otherworld-${seq++}`,expectedRevision:before.revision,...activeWindowRef(before.state.game!),command};
  await runInDurableObject(room.room,instance=>{(instance as CanonicalRoom).setNextEntropy({...entropy(),dice:Array(100).fill(face)});});
  const ack=await room.command(actorId,envelope);expect(ack).toMatchObject({type:'ack'});const saved=await room.stored();s=saved.state.game!;expect(allCardInstanceIds(s)).toHaveLength(220);expect(new Set(allCardInstanceIds(s)).size).toBe(220);
  await room.restart();expect(await room.command(actorId,envelope)).toEqual(ack);expect(await room.stored()).toEqual(saved);
  for(const id of s.seatOrder)expect((await room.snapshotFor(id)).game).toEqual(viewFor(s,id));
 }
 async function step(){const w=s.windows?.at(-1),id=s.seatOrder[s.turnSeat]!;
  if(w){const roll=s.rolls?.at(-1);await send(w.participants[w.cursor]!,{type:'PASS'},roll?.purpose==='status-resistance'&&roll.stage==='before-roll'?6:1);}
  else if(s.phase==='action')await send(id,{type:'PASS_ACTION'});
  else if(s.phase==='withdrawal')await send(id,{type:'PASS_WITHDRAWAL'});
  else if(s.phase==='hand-adjustment')await send(id,{type:'END_TURN',discardIds:s.players[id]!.hand.filter(x=>x!==spear).slice(0,Math.max(0,s.players[id]!.hand.length-gameStats(s,id).handLimit))});
  else if(s.phase==='turn-start')await send(id,{type:'START_TURN'});
  else if(s.phase==='draw')await send(id,{type:'CHOOSE_DRAW',draw:false});
  else throw Error(`ABSENT_PHASE_${s.phase}`);
 }
 async function until(done:(s:GameState)=>boolean){for(let n=0;n<600;n++){if(done(s))return;expect(s.outcome).toBeUndefined();await step();}throw Error('ABSENT_LIMIT');}
 const ownAction=(s:GameState)=>!s.windows?.length&&s.phase==='action'&&s.seatOrder[s.turnSeat]==='C';
 await send('A',{type:'USE_REVIVAL_RITUAL'});await until(s=>s.windows?.at(-1)?.kind==='lifecycle-boundary');
 expect(s.players.A).toMatchObject({characterId:'c2-p07-r1c2',damage:0,faction:'ヴァンミール'});expect(gameStats(s,'A').endurance).toBe(25);
 await until(ownAction);for(const id of ['B','D'])expect(s.players[id]!.faction).toBe('EVIL');
 await send('C',{type:'CHANT',cardInstanceId:spear});await until(ownAction);
 await send('C',{type:'ATTACK',cardInstanceId:spear,targetIds:['A'],dedicated:false});await until(s=>!s.windows?.length);
 expect(s.players.A).toMatchObject({presence:'otherworld',characterId:'c2-p07-r1c2',damage:8});
 const away=structuredClone(s.players.A!);expect(s.rolls!.some(r=>r.purpose==='status-resistance'&&r.rollerId==='A'&&r.success===false)).toBe(true);
 expect(s.vanmilDeath).not.toBe(true);expect(s.outcome).toBeUndefined();
 await until(ownAction);expect(s.players.A).toEqual(away);
 expect(s.events.filter(e=>e.type==='PLAYER_DIED'&&e.actorId==='A')).toEqual([]);expect(s.events.filter(e=>e.type==='GAME_COMPLETED')).toEqual([]);expect(s.vanmilDeath).not.toBe(true);
 expect(s.windows??[]).toEqual([]);expect(s.resolution).toEqual([]);expect(s.reclaimReservations).toEqual([]);
 for(const card of [ritualCard,spear])expect(s.discard.filter(id=>id===card)).toHaveLength(1);
 for(const id of s.seatOrder){const v=viewFor(JSON.parse(JSON.stringify(s)),id);expect(v.outcome).toBeNull();expect(v.players.A!.presence).toBe('otherworld');}
},30000);
