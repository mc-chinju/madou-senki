import {expect,it} from 'vitest';
import {allCardInstanceIds,gameStats,transition,viewFor,type GameCommand,type GameState, discardIds } from '../src/index.js';
import {entropy} from './fixtures.js';
import {makeRitualPhysicalScenario,ritualCard} from './fixtures/ritual-physical-scenarios.js';

it.each([false,true,'conspiracy'] as const)('actual ritual then chanted Dragon Spear commits one terminal result with subordinates %s',subordinates=>{
 let s=makeRitualPhysicalScenario(subordinates?'ritual-terminal-subordinates':'ritual-terminal',(subordinates?['A','B','C','D','E','F']:['A','B','C','D']).map(id=>({id,name:id})),false,true);
 const spear='a2-p11-r1c1';
 function send(actorId:string,command:GameCommand){
  const input={actorId,command},e=entropy(),result=transition(s,input,e);
  expect(result).toEqual(transition(JSON.parse(JSON.stringify(s)),input,e));
  if(!result.ok)throw Error(`${command.type}: ${result.code}`);
  s=result.state;expect(allCardInstanceIds(s)).toHaveLength(220);expect(new Set(allCardInstanceIds(s)).size).toBe(220);
 }
 function step(){
  const w=s.windows?.at(-1),id=s.seatOrder[s.turnSeat]!;
  if(w)send(w.participants[w.cursor]!,{type:'PASS'});
  else if(s.phase==='action')send(id,{type:'PASS_ACTION'});
  else if(s.phase==='withdrawal')send(id,{type:'PASS_WITHDRAWAL'});
  else if(s.phase==='hand-adjustment')send(id,{type:'END_TURN',discardIds:s.players[id]!.hand.filter(x=>x!==spear).slice(0,Math.max(0,s.players[id]!.hand.length-gameStats(s,id).handLimit))});
  else if(s.phase==='turn-start')send(id,{type:'START_TURN'});
  else if(s.phase==='draw')send(id,{type:'CHOOSE_DRAW',draw:false});
  else throw Error(`TERMINAL_PHASE_${s.phase}`);
 }
 function until(done:(s:GameState)=>boolean){for(let n=0;n<600;n++){if(done(s))return;expect(s.outcome).toBeUndefined();step();}throw Error('TERMINAL_LIMIT');}
 send('A',{type:'USE_REVIVAL_RITUAL'});
 until(s=>s.windows?.at(-1)?.kind==='lifecycle-boundary');
 expect(s.players.A).toMatchObject({characterId:'c2-p07-r1c2',damage:0,faction:'ヴァンミール'});
 expect(gameStats(s,'A').endurance).toBe(25);
 if(subordinates)send('A',{type:'USE_LIFECYCLE_ABILITY',ability:'vanmil-subordinates'});
 if(subordinates==='conspiracy'){
  until(s=>s.windows?.at(-1)?.kind==='lifecycle-boundary'&&s.windows.at(-1)!.participants[s.windows.at(-1)!.cursor]==='F');
  send('F',{type:'REVEAL_CHARACTER'});
  until(s=>s.windows?.at(-1)?.kind==='lifecycle-boundary'&&s.windows.at(-1)!.participants[s.windows.at(-1)!.cursor]==='F');
  send('F',{type:'USE_LIFECYCLE_ABILITY',ability:'arseil-conspiracy'});
 }
 until(s=>!s.windows?.length&&s.phase==='action'&&s.seatOrder[s.turnSeat]==='C');
 if(subordinates==='conspiracy'){expect(s.players.F!.presence).toBe('exited');expect(s.individualResults).toEqual({F:'won'});expect(s.outcome).toBeUndefined();}
 for(const id of ['B','D'])expect(s.players[id]!.faction).toBe(subordinates?'ヴァンミール':'EVIL');
 send('C',{type:'CHANT',cardInstanceId:spear,dedicated:true});
 until(s=>!s.windows?.length&&s.phase==='action'&&s.seatOrder[s.turnSeat]==='C');
 send('C',{type:'ATTACK',cardInstanceId:spear,targetIds:['A'],dedicated:true});
 until(s=>s.players.A!.presence==='pending-death');
 expect(s.outcome).toBeUndefined();
 for(const id of s.seatOrder)expect(viewFor(s,id).outcome).toBeNull();
 // The accepted death and all root responses must settle before C13.
 for(let n=0;n<600&&!s.outcome;n++)step();
 expect(s.players.A!.presence).toBe('dead');
 expect(s.outcome).toMatchObject({reason:'vanmil-death',winnerIds:subordinates==='conspiracy'?['F','C','E']:subordinates?['C','E','F']:['B','C','D']});
 if(subordinates==='conspiracy'){expect(s.players.F!.presence).toBe('exited');expect(s.individualResults).toEqual({F:'won'});expect(s.outcome!.results.F).toBe('won');}
 expect(s.events.filter(e=>e.type==='GAME_COMPLETED')).toHaveLength(1);
 expect(s.events.filter(e=>e.type==='PLAYER_DIED'&&e.actorId==='A')).toHaveLength(1);
 expect(s.windows??[]).toEqual([]);expect(s.resolution).toEqual([]);expect(s.reclaimReservations).toEqual([]);
 for(const card of [ritualCard,spear])expect(discardIds(s).filter(id=>id===card)).toHaveLength(1);
 for(const id of s.seatOrder)expect(viewFor(JSON.parse(JSON.stringify(s)),id).outcome).toEqual(s.outcome);
});
