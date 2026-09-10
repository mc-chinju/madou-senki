import {reset} from 'cloudflare:test';
import {afterEach,expect,it,vi} from 'vitest';
import {openTestRoom} from './fixtures/recovery-room.js';
afterEach(async()=>{vi.restoreAllMocks();await reset();});
import {activeWindowRef,allCardInstanceIds,gameStats,viewFor,type GameCommand,type GameState} from '@madou/engine';
import {ritualCard} from './fixtures/ritual-physical-scenarios.js';
it('actual dead Gaina and wandering Arseil win at ritual terminal under every DO eviction and receipt replay',async()=>{
 vi.spyOn(crypto,'getRandomValues').mockImplementation(<T extends ArrayBufferView|null>(array:T):T=>{if(array instanceof Uint32Array)array.fill(0);return array;});
 const room=await openTestRoom('ritual-terminal-subordinates',['A','B','C','D','E','F']);let seq=0,s=(await room.stored()).state.game!;
 const spear='a2-p11-r1c1';
 async function send(actorId:string,command:GameCommand){
  const before=await room.stored(),envelope={protocolVersion:1 as const,commandId:`absent-terminal-${seq++}`,expectedRevision:before.revision,...activeWindowRef(before.state.game!),command},ack=await room.command(actorId,envelope);
  expect(ack).toMatchObject({type:'ack'});const saved=await room.stored();s=saved.state.game!;expect(allCardInstanceIds(s)).toHaveLength(220);expect(new Set(allCardInstanceIds(s)).size).toBe(220);
  await room.restart();expect(await room.command(actorId,envelope)).toEqual(ack);expect(await room.stored()).toEqual(saved);
  for(const id of s.seatOrder)expect((await room.snapshotFor(id)).game).toEqual(viewFor(s,id));
 }
 async function step(){const w=s.windows?.at(-1),id=s.seatOrder[s.turnSeat]!;
  if(w)await send(w.participants[w.cursor]!,{type:'PASS'});
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
 await send('C',{type:'CHANT',cardInstanceId:spear,dedicated:true});await until(ownAction);
 await send('C',{type:'ATTACK',cardInstanceId:spear,targetIds:['E'],dedicated:true});
 await until(s=>s.windows?.at(-1)?.kind==='reclaim'&&viewFor(s,'C').reclaim?.pendingActorId==='C'&&viewFor(s,'C').reclaim?.cardInstanceId===spear);
 const reclaim=viewFor(s,'C').reclaim!,base=reclaim.claims.find(c=>c.right==='base');expect(base).toBeDefined();
 await send('C',{type:'CHOOSE_RECLAIM',decisionId:reclaim.decisionId,choice:'take',claimId:base!.claimId});
 await until(s=>!s.windows?.length);
 expect(s.players.E!.presence).toBe('dead');expect(s.players.F!.presence).toBe('wandering');expect(s.players.C!.hand.filter(id=>id===spear)).toHaveLength(1);expect(s.outcome).toBeUndefined();
 const deaths=s.events.filter(e=>e.type==='PLAYER_DIED'&&e.actorId==='E');expect(deaths).toHaveLength(1);
 expect(s.events.filter(e=>e.type==='PLAYER_WANDERING'&&e.actorId==='F')).toHaveLength(1);
 await until(ownAction);await send('C',{type:'CHANT',cardInstanceId:spear,dedicated:true});await until(ownAction);
 await send('C',{type:'ATTACK',cardInstanceId:spear,targetIds:['A'],dedicated:true});
 await until(s=>s.players.A!.presence==='pending-death');expect(s.players.E!.presence).toBe('dead');expect(s.players.F!.presence).toBe('wandering');
 for(const id of s.seatOrder)expect(viewFor(s,id).outcome).toBeNull();
 await until(s=>!!s.outcome);
 expect(s.outcome).toMatchObject({reason:'vanmil-death',winnerIds:['B','C','D','E','F'],results:{A:'lost',E:'won',F:'won'}});
 expect(s.players.E!.presence).toBe('dead');expect(s.players.F!.presence).toBe('wandering');expect(s.events.filter(e=>e.type==='GAME_COMPLETED')).toHaveLength(1);
 expect(s.events.filter(e=>e.type==='PLAYER_DIED'&&e.actorId==='A')).toHaveLength(1);expect(s.events.filter(e=>e.type==='PLAYER_DIED'&&e.actorId==='E')).toEqual(deaths);
 expect(s.windows??[]).toEqual([]);expect(s.resolution).toEqual([]);expect(s.reclaimReservations).toEqual([]);
 for(const card of [ritualCard,spear])expect(s.discard.filter(id=>id===card)).toHaveLength(1);
 for(const id of s.seatOrder)expect(viewFor(JSON.parse(JSON.stringify(s)),id).outcome).toEqual(s.outcome);
},30000);
