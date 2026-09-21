import {expect,it} from 'vitest';
import {allCardInstanceIds,gameStats,transition,viewFor,type GameCommand,type GameState, discardIds } from '../src/index.js';
import {entropy} from './fixtures.js';
import {makeRitualPhysicalScenario,ritualCard} from './fixtures/ritual-physical-scenarios.js';
it('actual Uonos approach and once-per-game Curse recovery survive the ritual transformation',()=>{
 let s=makeRitualPhysicalScenario('ritual-history',['A','B','C','D'].map(id=>({id,name:id})));
 const spear='a2-p13-r3c2';
 function send(actorId:string,command:GameCommand){const input={actorId,command},e=entropy(),r=transition(s,input,e);expect(r).toEqual(transition(JSON.parse(JSON.stringify(s)),input,e));if(!r.ok)throw Error(`${command.type}: ${r.code}`);s=r.state;expect(allCardInstanceIds(s)).toHaveLength(220);expect(new Set(allCardInstanceIds(s)).size).toBe(220);}
 function step(){const w=s.windows?.at(-1),id=s.seatOrder[s.turnSeat]!;
  if(w)send(w.participants[w.cursor]!,{type:'PASS'});
  else if(s.phase==='action')send(id,{type:'PASS_ACTION'});
  else if(s.phase==='withdrawal')send(id,{type:'PASS_WITHDRAWAL'});
  else if(s.phase==='hand-adjustment')send(id,{type:'END_TURN',discardIds:s.players[id]!.hand.filter(x=>![spear,ritualCard].includes(x)).slice(0,Math.max(0,s.players[id]!.hand.length-gameStats(s,id).handLimit))});
  else if(s.phase==='turn-start')send(id,{type:'START_TURN'});
  else if(s.phase==='draw')send(id,{type:'CHOOSE_DRAW',draw:false});
  else throw Error(`ABSENT_PHASE_${s.phase}`);
 }
 function until(done:(s:GameState)=>boolean){for(let n=0;n<600;n++){if(done(s))return;expect(s.outcome).toBeUndefined();step();}throw Error('ABSENT_LIMIT');}
 const ownAction=(s:GameState)=>!s.windows?.length&&s.phase==='action'&&s.seatOrder[s.turnSeat]==='A';
 const initialDistances=structuredClone(s.distances);
 send('A',{type:'APPROACH',cardInstanceId:'a2-p24-r1c1',targetId:'B'});until(ownAction);
 expect(s.distances).not.toEqual(initialDistances);
 send('A',{type:'CHANT',cardInstanceId:spear});until(ownAction);
 send('A',{type:'ATTACK',cardInstanceId:spear,targetIds:['C'],dedicated:false});
 until(s=>s.windows?.at(-1)?.kind==='reclaim'&&viewFor(s,'A').reclaim?.pendingActorId==='A'&&viewFor(s,'A').reclaim?.cardInstanceId===spear);
 const reclaim=viewFor(s,'A').reclaim!,base=reclaim.claims.find(c=>c.right==='base');expect(base).toBeDefined();
 send('A',{type:'CHOOSE_RECLAIM',decisionId:reclaim.decisionId,choice:'take',claimId:base!.claimId});until(ownAction);
 expect(s.players.A!.reclaimUsage?.['呪殺']?.baseSpent).toBe(true);expect(s.players.A!.hand.filter(id=>id===spear)).toHaveLength(1);
 const before=structuredClone(s.players.A!),distances=structuredClone(s.distances),used=structuredClone(s.used);
 expect(distances).not.toEqual(initialDistances);
 send('A',{type:'USE_REVIVAL_RITUAL'});until(s=>s.windows?.at(-1)?.kind==='lifecycle-boundary');
 expect(s.players.A).toMatchObject({characterId:'c2-p07-r1c2',damage:0,abilityCharacterIds:['c2-p07-r1c2']});
 expect(s.players.A!.lifeId).toBe(before.lifeId);expect(s.players.A!.reclaimUsage).toEqual(before.reclaimUsage);expect(s.distances).toEqual(distances);expect(s.used).toEqual(used);
 for(const key of ['followers','attachments','chants','open','permanent'] as const)expect(s.players.A![key]).toEqual(before[key]);
 expect(s.players.A!.hand).toEqual(before.hand.filter(id=>id!==ritualCard));
 until(s=>!s.windows?.length);expect(s.players.A!.reclaimUsage?.['呪殺']?.baseSpent).toBe(true);expect(s.distances).toEqual(distances);
 expect(discardIds(s).filter(id=>id===ritualCard)).toHaveLength(1);expect(s.players.A!.hand.filter(id=>id===spear)).toHaveLength(1);expect(s.outcome).toBeUndefined();
});
