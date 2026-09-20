import {assignCharacter} from './fixtures/scenario-tools.js';
import {handCard} from './fixtures.js';
import {absentRecoveryResponse} from './reclaim-public-absence-helpers.js';
import {expect,it} from 'vitest';
import {actionCards,getCharacter} from '@madou/catalog';
import {allCardInstanceIds,gameStats,viewFor, discardIds } from '../src/index.js';
import {act,finish,pass,until} from './combat-helpers.js';
import {makeReclaimWandering} from './fixtures/reclaim-wandering-scenario.js';

it('Actual protected Lia death makes the counter reservation owner wander before one final return',()=>{
 let s=makeReclaimWandering(['A','B','C','D','E','F'].map(id=>({id,name:id})));
 // Keep both factions present after Lia dies so a subsequent real turn remains legal.
 assignCharacter(s,'E',getCharacter('c2-p04-r1c1')!.name);assignCharacter(s,'F',getCharacter('c2-p06-r2c1')!.name);
 s.players.E!.faction='GOOD';s.players.E!.currentObjective={kind:'extinction',enemyFactions:['EVIL']};s.players.F!.faction='EVIL';s.players.F!.currentObjective={kind:'extinction',enemyFactions:['GOOD']};
 const counter=actionCards.find(c=>c.name==='妖撃破山剣')!.id,life=s.players.B!.lifeId??'initial-life:B';
 const root=Object.values(s.actions!).find(a=>a.cardInstanceId==='a2-p07-r3c3')!;
 s=act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:counter,dedicated:true});
 for(let n=0;n<300;n++){
  const claim=viewFor(s,'B').reclaim;
  if(claim?.cardInstanceId===counter&&claim.claims.length){s=act(s,'B',{type:'CHOOSE_RECLAIM',decisionId:claim.decisionId,choice:'take',claimId:claim.claims[0]!.claimId});break;}
  s=pass(s);
 }
 expect(s.reclaimReservations).toContain(counter);
 const used=structuredClone(s.players.B!.reclaimUsage);
 expect(used).toBeDefined();expect(s.players.C!.presence??'active').toBe('active');
 let wandered=false;
 for(let n=0;s.windows?.length&&n<500;n++){
  expect(s.players.B!.lifeId??'initial-life:B').toBe(life);
  if(s.reclaimReservations.includes(counter)){
   expect(s.deck).not.toContain(counter);expect(discardIds(s)).not.toContain(counter);
   for(const p of Object.values(s.players))expect(p.hand).not.toContain(counter);
  }
  const saved=JSON.parse(JSON.stringify(s));
  expect(s.seatOrder.map(id=>viewFor(saved,id))).toEqual(s.seatOrder.map(id=>viewFor(s,id)));
  s=pass(saved);
  if(s.players.B!.presence==='wandering')wandered=true;
 }
 expect(wandered).toBe(true);expect(s.players.C!.presence).toBe('dead');
 expect(s.players.B!.presence).toBe('wandering');expect(s.players.B!.lifeId??'initial-life:B').toBe(life);
 expect(s.players.B!.hand.filter(id=>id===counter)).toHaveLength(1);
 expect(s.players.B!.reclaimUsage).toEqual(used);expect(s.reclaimReservations).toEqual([]);
 expect(s.reclaim?.[counter]).toBeUndefined();expect(s.deck).not.toContain(counter);expect(discardIds(s)).not.toContain(counter);
 expect(s.windows??[]).toEqual([]);expect(s.lifecycle??[]).toEqual([]);expect(Object.keys(s.actions??{})).toEqual([]);expect(Object.keys(s.groups??{})).toEqual([]);
 expect(allCardInstanceIds(s).sort()).toEqual(actionCards.map(c=>c.id).sort());
 expect(s.events.filter(e=>e.type==='PLAYER_WANDERING'&&e.actorId==='B')).toHaveLength(1);
 expect(s.events.find(e=>e.type==='PLAYER_DIED'&&e.actorId==='C')?.death?.eventId).toBe(root.eventId);
 // The original bow disposition precedes the protected death; open the next actual use after both absences.
 const heal=handCard(s,'D','封傷');
 if(s.phase==='withdrawal')s=act(s,'A',{type:'PASS_WITHDRAWAL'});
 s=finish(act(s,'A',{type:'END_TURN',discardIds:s.players.A!.hand.slice(0,Math.max(0,s.players.A!.hand.length-gameStats(s,'A').handLimit))}));
 expect(s.seatOrder[s.turnSeat]).toBe('D');
 s=act(s,'D',{type:'START_TURN'});s=act(s,'D',{type:'CHOOSE_DRAW',draw:false});
 s=until(act(s,'D',{type:'PLAY_TURN_TECHNIQUE',cardInstanceId:heal,targetIds:['D'],dedicated:false}),'reclaim');
 const responses:string[]=[];
 for(let n=0;n<4;n++){
  expect(s.players.B!.presence).toBe('wandering');expect(s.players.C!.presence).toBe('dead');
  const actor=absentRecoveryResponse(s,heal,['B','C'],['D','E','F','A']);expect(actor).not.toBeNull();responses.push(actor!);
  s=pass(JSON.parse(JSON.stringify(s)));
 }
 expect(responses).toEqual(['D','E','F','A']);expect(discardIds(s).filter(id=>id===heal)).toHaveLength(1);

});
