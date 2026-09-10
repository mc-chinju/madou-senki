import {expect,it} from 'vitest';
import {allCardInstanceIds,gameStats,transition,viewFor,type GameCommand,type GameState} from '../src/index.js';
import {entropy} from './fixtures.js';
import {makeRitualPhysicalScenario,ritualCard} from '../../../apps/worker/test/fixtures/ritual-physical-scenarios.js';
it.each(['ritual-disabled','ritual-stopped'] as const)('%s actual mental attack distinguishes character ability disable from inability to perform the ritual',scenario=>{
 let s=makeRitualPhysicalScenario(scenario,['A','B','C','D'].map(id=>({id,name:id})));
 function send(actorId:string,command:GameCommand){const input={actorId,command},e={...entropy(),dice:Array(100).fill(6)},r=transition(s,input,e);expect(r).toEqual(transition(JSON.parse(JSON.stringify(s)),input,e));if(!r.ok)throw Error(`${command.type}: ${r.code}`);s=r.state;expect(allCardInstanceIds(s)).toHaveLength(220);expect(new Set(allCardInstanceIds(s)).size).toBe(220);}
 function step(){const w=s.windows?.at(-1),id=s.seatOrder[s.turnSeat]!;
  if(w)send(w.participants[w.cursor]!,{type:'PASS'});
  else if(s.phase==='action')send(id,{type:'PASS_ACTION'});
  else if(s.phase==='withdrawal')send(id,{type:'PASS_WITHDRAWAL'});
  else if(s.phase==='hand-adjustment')send(id,{type:'END_TURN',discardIds:s.players[id]!.hand.filter(x=>x!==ritualCard).slice(0,Math.max(0,s.players[id]!.hand.length-gameStats(s,id).handLimit))});
  else if(s.phase==='turn-start')send(id,{type:'START_TURN'});
  else if(s.phase==='draw')send(id,{type:'CHOOSE_DRAW',draw:false});
  else throw Error(`RITUAL_DISABLED_PHASE_${s.phase}`);
 }
 function until(done:(s:GameState)=>boolean){for(let n=0;n<600;n++){if(done(s))return;expect(s.outcome).toBeUndefined();step();}throw Error('RITUAL_DISABLED_LIMIT');}
 send('D',{type:'ATTACK',cardInstanceId:scenario==='ritual-disabled'?'a2-p13-r1c2':'a2-p13-r2c1',targetIds:['A'],dedicated:false});
 if(scenario==='ritual-stopped'){
  until(s=>!s.windows?.length&&s.phase==='turn-start'&&s.seatOrder[s.turnSeat]==='A');
  send('A',{type:'START_TURN'});
  until(s=>!s.windows?.length&&s.phase==='turn-start'&&s.seatOrder[s.turnSeat]==='B');
 }else until(s=>!s.windows?.length&&s.phase==='action'&&s.seatOrder[s.turnSeat]==='A');
 const before=structuredClone(s),kind=scenario==='ritual-disabled'?'ability-disabled':'stopped';expect(s.players.A!.statuses?.some(x=>x.kind===kind)).toBe(true);
 if(scenario==='ritual-stopped'){
  const views=s.seatOrder.map(id=>viewFor(s,id));expect(transition(s,{actorId:'A',command:{type:'USE_REVIVAL_RITUAL'}},entropy())).toEqual({ok:false,code:'WRONG_PHASE'});expect(s).toEqual(before);expect(s.seatOrder.map(id=>viewFor(s,id))).toEqual(views);expect(s.players.A!.hand).toContain(ritualCard);return;
 }
 expect(viewFor(s,'A').abilityOptions.some(o=>o.abilityId==='c2-p05-r1c1-ab01')).toBe(false);
 send('A',{type:'USE_REVIVAL_RITUAL'});until(s=>s.windows?.at(-1)?.kind==='lifecycle-boundary');expect(s.players.A).toMatchObject({characterId:'c2-p07-r1c2',damage:0,abilityCharacterIds:['c2-p07-r1c2']});expect(gameStats(s,'A').endurance).toBe(25);expect(s.players.A!.statuses).toEqual(before.players.A!.statuses);
 until(s=>!s.windows?.length);expect(s.discard.filter(id=>id===ritualCard)).toHaveLength(1);expect(s.players.A!.hand).toEqual(before.players.A!.hand.filter(id=>id!==ritualCard));expect(s.outcome).toBeUndefined();
});
