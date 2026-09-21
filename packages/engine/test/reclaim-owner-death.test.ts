import {absentRecoveryResponse} from './reclaim-public-absence-helpers.js';
import {expect,it} from 'vitest';
import {allCardInstanceIds,gameStats,viewFor, discardIds } from '../src/index.js';
import {act,finish,pass} from './combat-helpers.js';
import {makeLiaPrayerScenario} from './fixtures/lia-prayer-scenarios.js';

it('Reservation owner actual death discards its held prayer once after the root death boundary',()=>{
 let s=makeLiaPrayerScenario('lia-prayer-fatal',['A','B','C','D'].map(id=>({id,name:id})));
 const prayer='a2-p05-r2c3',action=s.actions![s.windows!.at(-1)!.continuation.id]!,life=s.players.B!.lifeId;
 expect(gameStats(s,'B').endurance-s.players.B!.damage).toBe(1);
 s=act(s,'B',{type:'PLAY_REACTION',cardInstanceId:prayer,mode:'effect-plus',targetActionId:action.id,dedicated:true});
 for(let n=0;!s.reclaimReservations.includes(prayer)&&n<100;n++)s=pass(s);
 expect(s.reclaimReservations).toContain(prayer);expect(s.players.B!.presence??'active').toBe('active');
 expect(s.reclaim![prayer]).toMatchObject({ownerId:'B',eventId:action.eventId});
 for(let n=0;s.players.B!.presence!=='pending-death'&&n<200;n++){
  expect(s.reclaimReservations).toContain(prayer);
  for(const p of Object.values(s.players))expect(p.hand).not.toContain(prayer);
  s=pass(s);
 }
 expect(s.players.B!.presence).toBe('pending-death');expect(s.players.B!.damage).toBeGreaterThanOrEqual(gameStats(s,'B').endurance);
 expect(s.lifecycle?.some(t=>t.rootEventIds?.includes(action.eventId))).toBe(true);
 expect(s.reclaimReservations).toContain(prayer);expect(s.outcome).toBeUndefined();
 const saved=JSON.parse(JSON.stringify(s)),expected=finish(saved),responses:string[]=[];
 for(let n=0;s.windows?.length&&n<400;n++){
  if(s.players.B!.presence==='dead'){const actor=absentRecoveryResponse(s,action.cardInstanceId!,['B'],['A','C','D']);if(actor)responses.push(actor);}
  s=pass(JSON.parse(JSON.stringify(s)));
 }
 expect(s).toEqual(expected);expect(responses).toEqual(['A','C','D']);
 expect(s.players.B!.presence).toBe('dead');expect(s.players.B!.lifeId).not.toBe(life);
 expect(s.reclaimReservations).toEqual([]);expect(s.reclaim![prayer]).toBeUndefined();
 expect(discardIds(s).filter(id=>id===prayer)).toHaveLength(1);
 for(const p of Object.values(s.players))expect(p.hand).not.toContain(prayer);
 expect(s.used).toContain(`${action.eventId}:B:${prayer}`);
 expect(new Set(allCardInstanceIds(s)).size).toBe(220);
 const before=JSON.stringify(s);for(const actor of s.seatOrder)viewFor(s,actor);expect(JSON.stringify(s)).toBe(before);
 expect(finish(s)).toEqual(s);
});
