import {reset} from 'cloudflare:test';
import {afterEach,expect,it,vi} from 'vitest';
import {activeWindowRef,allCardInstanceIds,viewFor,gameStats,type GameCommand,type GameState} from '@madou/engine';
import {openTestRoom} from './fixtures/recovery-room.js';
afterEach(async()=>{vi.restoreAllMocks();await reset();});
it.each([false,true,'conspiracy'] as const)('actual ritual to Vanmil death persists one terminal result with subordinates %s through every eviction and replay',async subordinates=>{
 vi.spyOn(crypto,'getRandomValues').mockImplementation(<T extends ArrayBufferView|null>(array:T):T=>{if(array instanceof Uint32Array)array.fill(0);return array;});
 const actors=subordinates?['A','B','C','D','E','F']:['A','B','C','D'];
 const room=await openTestRoom(subordinates?'ritual-terminal-subordinates':'ritual-terminal',actors);let seq=0;const state=async()=>(await room.stored()).state.game!,spear='a2-p11-r1c1';
 async function send(actorId:string,command:GameCommand){
  const before=await room.stored(),envelope={protocolVersion:1 as const,commandId:`ritual-terminal-${seq++}`,expectedRevision:before.revision,...activeWindowRef(before.state.game!),command},ack=await room.command(actorId,envelope);
  expect(ack).toMatchObject({type:'ack'});const saved=await room.stored(),ids=allCardInstanceIds(saved.state.game!);expect(ids).toHaveLength(220);expect(new Set(ids).size).toBe(220);
  await room.restart();expect(await room.command(actorId,envelope)).toEqual(ack);expect(await room.stored()).toEqual(saved);
  for(const id of saved.state.game!.seatOrder)expect((await room.snapshotFor(id)).game).toEqual(viewFor(saved.state.game!,id));
 }
 async function step(){const s=await state(),w=s.windows?.at(-1),id=s.seatOrder[s.turnSeat]!;
  if(w)await send(w.participants[w.cursor]!,{type:'PASS'});
  else if(s.phase==='action')await send(id,{type:'PASS_ACTION'});
  else if(s.phase==='withdrawal')await send(id,{type:'PASS_WITHDRAWAL'});
  else if(s.phase==='hand-adjustment')await send(id,{type:'END_TURN',discardIds:s.players[id]!.hand.filter(x=>x!==spear).slice(0,Math.max(0,s.players[id]!.hand.length-gameStats(s,id).handLimit))});
  else if(s.phase==='turn-start')await send(id,{type:'START_TURN'});
  else if(s.phase==='draw')await send(id,{type:'CHOOSE_DRAW',draw:false});
  else throw Error(`RITUAL_TERMINAL_PHASE_${s.phase}`);
 }
 async function until(done:(s:GameState)=>boolean){for(let n=0;n<600;n++){const s=await state();if(done(s))return;expect(s.outcome).toBeUndefined();await step();}throw Error('RITUAL_TERMINAL_LIMIT');}
 await send('A',{type:'USE_REVIVAL_RITUAL'});await until(s=>s.windows?.at(-1)?.kind==='lifecycle-boundary');
 expect((await state()).players.A).toMatchObject({characterId:'c2-p07-r1c2',damage:0,faction:'ヴァンミール'});expect(gameStats(await state(),'A').endurance).toBe(25);
 if(subordinates)await send('A',{type:'USE_LIFECYCLE_ABILITY',ability:'vanmil-subordinates'});
 if(subordinates==='conspiracy'){
  await until(s=>s.windows?.at(-1)?.kind==='lifecycle-boundary'&&s.windows.at(-1)!.participants[s.windows.at(-1)!.cursor]==='F');
  await send('F',{type:'REVEAL_CHARACTER'});
  await until(s=>s.windows?.at(-1)?.kind==='lifecycle-boundary'&&s.windows.at(-1)!.participants[s.windows.at(-1)!.cursor]==='F');
  await send('F',{type:'USE_LIFECYCLE_ABILITY',ability:'arseil-conspiracy'});
 }
 await until(s=>!s.windows?.length&&s.phase==='action'&&s.seatOrder[s.turnSeat]==='C');
 if(subordinates==='conspiracy'){expect((await state()).players.F!.presence).toBe('exited');expect((await state()).individualResults).toEqual({F:'won'});expect((await state()).outcome).toBeUndefined();}
 await send('C',{type:'CHANT',cardInstanceId:spear,dedicated:true});
 await until(s=>!s.windows?.length&&s.phase==='action'&&s.seatOrder[s.turnSeat]==='C');
 await send('C',{type:'ATTACK',cardInstanceId:spear,targetIds:['A'],dedicated:true});await until(s=>s.players.A!.presence==='pending-death');
 expect((await state()).outcome).toBeUndefined();for(const id of actors)expect((await room.snapshotFor(id)).game!.outcome).toBeNull();
 await until(s=>!!s.outcome);const done=await state();
 expect(done.players.A!.presence).toBe('dead');expect(done.outcome).toMatchObject({reason:'vanmil-death',winnerIds:subordinates==='conspiracy'?['F','C','E']:subordinates?['C','E','F']:['B','C','D']});
 if(subordinates==='conspiracy'){expect(done.players.F!.presence).toBe('exited');expect(done.individualResults).toEqual({F:'won'});expect(done.outcome!.results.F).toBe('won');}
 expect(done.events.filter(e=>e.type==='GAME_COMPLETED')).toHaveLength(1);expect(done.events.filter(e=>e.type==='PLAYER_DIED'&&e.actorId==='A')).toHaveLength(1);
 expect(done.windows??[]).toEqual([]);expect(done.resolution).toEqual([]);expect(done.reclaimReservations).toEqual([]);
 for(const id of ['a2-p05-r1c1',spear])expect(done.discard.filter(x=>x===id)).toHaveLength(1);
},30000);
