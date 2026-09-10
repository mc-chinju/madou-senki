import {expect,it} from 'vitest';
import {allCardInstanceIds,gameStats,transition,viewFor,type GameCommand,type GameState} from '../src/index.js';
import {entropy} from './fixtures.js';
import {makeRitualPhysicalScenario,ritualCard} from '../../../apps/worker/test/fixtures/ritual-physical-scenarios.js';
it('actual Gaina death and Arseil wandering remain winners after later ritual Vanmil death',()=>{
 let s=makeRitualPhysicalScenario('ritual-terminal-subordinates',['A','B','C','D','E','F'].map(id=>({id,name:id})));
 const spear='a2-p11-r1c1';
 function send(actorId:string,command:GameCommand){const input={actorId,command},e=entropy(),r=transition(s,input,e);expect(r).toEqual(transition(JSON.parse(JSON.stringify(s)),input,e));if(!r.ok)throw Error(`${command.type}: ${r.code}`);s=r.state;expect(allCardInstanceIds(s)).toHaveLength(220);expect(new Set(allCardInstanceIds(s)).size).toBe(220);}
 function step(){const w=s.windows?.at(-1),id=s.seatOrder[s.turnSeat]!;
  if(w)send(w.participants[w.cursor]!,{type:'PASS'});
  else if(s.phase==='action')send(id,{type:'PASS_ACTION'});
  else if(s.phase==='withdrawal')send(id,{type:'PASS_WITHDRAWAL'});
  else if(s.phase==='hand-adjustment')send(id,{type:'END_TURN',discardIds:s.players[id]!.hand.filter(x=>x!==spear).slice(0,Math.max(0,s.players[id]!.hand.length-gameStats(s,id).handLimit))});
  else if(s.phase==='turn-start')send(id,{type:'START_TURN'});
  else if(s.phase==='draw')send(id,{type:'CHOOSE_DRAW',draw:false});
  else throw Error(`ABSENT_PHASE_${s.phase}`);
 }
 function until(done:(s:GameState)=>boolean){for(let n=0;n<600;n++){if(done(s))return;expect(s.outcome).toBeUndefined();step();}throw Error('ABSENT_LIMIT');}
 const ownAction=(s:GameState)=>!s.windows?.length&&s.phase==='action'&&s.seatOrder[s.turnSeat]==='C';
 send('A',{type:'USE_REVIVAL_RITUAL'});until(s=>s.windows?.at(-1)?.kind==='lifecycle-boundary');
 expect(s.players.A).toMatchObject({characterId:'c2-p07-r1c2',damage:0,faction:'ヴァンミール'});expect(gameStats(s,'A').endurance).toBe(25);
 until(ownAction);for(const id of ['B','D'])expect(s.players[id]!.faction).toBe('EVIL');
 send('C',{type:'CHANT',cardInstanceId:spear,dedicated:true});until(ownAction);
 send('C',{type:'ATTACK',cardInstanceId:spear,targetIds:['E'],dedicated:true});
 until(s=>s.windows?.at(-1)?.kind==='reclaim'&&viewFor(s,'C').reclaim?.pendingActorId==='C'&&viewFor(s,'C').reclaim?.cardInstanceId===spear);
 const reclaim=viewFor(s,'C').reclaim!,base=reclaim.claims.find(c=>c.right==='base');expect(base).toBeDefined();
 send('C',{type:'CHOOSE_RECLAIM',decisionId:reclaim.decisionId,choice:'take',claimId:base!.claimId});
 until(s=>!s.windows?.length);
 expect(s.players.E!.presence).toBe('dead');expect(s.players.F!.presence).toBe('wandering');expect(s.players.C!.hand.filter(id=>id===spear)).toHaveLength(1);expect(s.outcome).toBeUndefined();
 const deaths=s.events.filter(e=>e.type==='PLAYER_DIED'&&e.actorId==='E');expect(deaths).toHaveLength(1);
 expect(s.events.filter(e=>e.type==='PLAYER_WANDERING'&&e.actorId==='F')).toHaveLength(1);
 until(ownAction);send('C',{type:'CHANT',cardInstanceId:spear,dedicated:true});until(ownAction);
 send('C',{type:'ATTACK',cardInstanceId:spear,targetIds:['A'],dedicated:true});
 until(s=>s.players.A!.presence==='pending-death');expect(s.players.E!.presence).toBe('dead');expect(s.players.F!.presence).toBe('wandering');
 for(const id of s.seatOrder)expect(viewFor(s,id).outcome).toBeNull();
 until(s=>!!s.outcome);
 expect(s.outcome).toMatchObject({reason:'vanmil-death',winnerIds:['B','C','D','E','F'],results:{A:'lost',E:'won',F:'won'}});
 expect(s.players.E!.presence).toBe('dead');expect(s.players.F!.presence).toBe('wandering');expect(s.events.filter(e=>e.type==='GAME_COMPLETED')).toHaveLength(1);
 expect(s.events.filter(e=>e.type==='PLAYER_DIED'&&e.actorId==='A')).toHaveLength(1);expect(s.events.filter(e=>e.type==='PLAYER_DIED'&&e.actorId==='E')).toEqual(deaths);
 expect(s.windows??[]).toEqual([]);expect(s.resolution).toEqual([]);expect(s.reclaimReservations).toEqual([]);
 for(const card of [ritualCard,spear])expect(s.discard.filter(id=>id===card)).toHaveLength(1);
 for(const id of s.seatOrder)expect(viewFor(JSON.parse(JSON.stringify(s)),id).outcome).toEqual(s.outcome);
});
