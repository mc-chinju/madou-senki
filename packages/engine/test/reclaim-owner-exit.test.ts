import {absentRecoveryResponse} from './reclaim-public-absence-helpers.js';
import {expect,it} from 'vitest';
import {actionCards,getAction} from '@madou/catalog';
import {allCardInstanceIds,viewFor, discardIds } from '../src/index.js';
import {act,pass,ready} from './combat-helpers.js';
import {assignCharacter,takeCard,trimHand} from './fixtures/scenario-tools.js';

it('Actual Vanmil awakening lets the reserved Fate owner exit without return or refunded history',()=>{
 let s=ready();
 assignCharacter(s,'A','邪祭ウーノス');assignCharacter(s,'B','占星術師のアルセイル');assignCharacter(s,'C','侍大将のシン');assignCharacter(s,'D','魔導王ガイナス');
 for(const p of Object.values(s.players))p.permanent={endurance:100,warrior_level:20,magic_level:20,spirit:20};
 const ritual=takeCard(s,'A','a2-p05-r1c1'),fate=takeCard(s,'B','命運凶変');
 for(const id of s.seatOrder)trimHand(s,id,ritual,fate);
 s.deck=[...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];
 s=act(s,'B',{type:'REVEAL_CHARACTER'});
 s=act(s,'A',{type:'USE_REVIVAL_RITUAL'});
 const root=Object.values(s.actions!).find(a=>a.cardInstanceId===ritual)!;
 for(let n=0;s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!=='B'&&n<200;n++)s=pass(s);
 s=act(s,'B',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel',targetActionId:root.id});
 const paid=Object.values(s.actions!).find(a=>a.cardInstanceId===fate)!;
 for(let n=0;s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!=='B'&&n<200;n++)s=pass(s);
 s=act(s,'B',{type:'CANCEL_REACTION',targetActionId:paid.id});
 expect(s.actions![paid.id]!.canceled).toBe(true);
 for(let n=0;n<300;n++){
  const claim=viewFor(s,'B').reclaim;
  if(claim?.cardInstanceId===fate&&claim.claims.length){s=act(s,'B',{type:'CHOOSE_RECLAIM',decisionId:claim.decisionId,choice:'take',claimId:claim.claims[0]!.claimId});break;}
  s=pass(s);
 }
 expect(s.reclaimReservations).toContain(fate);const usage=structuredClone(s.players.B!.reclaimUsage);
 expect(usage?.['命運凶変']?.baseSpent).toBe(true);
 for(let n=0;n<400;n++){
  if(viewFor(s,'B').lifecycleAbilities.includes('arseil-conspiracy'))break;
  expect(s.players.B!.hand,JSON.stringify({root:root.eventId,character:s.players.A!.characterId,rolls:s.rolls,windows:s.windows,lifecycle:s.lifecycle,reclaim:s.reclaim})).not.toContain(fate);expect(s.reclaimReservations).toContain(fate);
  s=pass(JSON.parse(JSON.stringify(s)));
 }
 expect(s.players.A!.characterId).toBe('c2-p07-r1c2');
 expect(s.reclaimReservations).toContain(fate);
 s=act(s,'B',{type:'USE_LIFECYCLE_ABILITY',ability:'arseil-conspiracy'});
 let exited=false;const responses:string[]=[];
 for(let n=0;s.windows?.length&&n<400;n++){
  if(s.players.B!.presence==='exited'){const actor=absentRecoveryResponse(s,ritual,['B'],['A','C','D']);if(actor)responses.push(actor);}
  const saved=JSON.parse(JSON.stringify(s));
  expect(s.seatOrder.map(id=>viewFor(saved,id))).toEqual(s.seatOrder.map(id=>viewFor(s,id)));
  if(s.reclaimReservations.includes(fate)){
   expect(s.deck).not.toContain(fate);expect(discardIds(s)).not.toContain(fate);
   for(const p of Object.values(s.players))expect(p.hand).not.toContain(fate);
  }
  s=pass(saved);if(s.players.B!.presence==='exited'){exited=true;expect(s.players.B!.hand).not.toContain(fate);}
 }
 expect(responses).toEqual(['A','C','D']);
 expect(exited).toBe(true);expect(s.players.B!.presence).toBe('exited');expect(s.individualResults?.B).toBe('won');
 expect(s.players.B!.hand).not.toContain(fate);expect(discardIds(s).filter(id=>id===fate)).toHaveLength(1);
 expect(s.players.B!.reclaimUsage).toEqual(usage);expect(s.reclaimReservations).toEqual([]);expect(s.reclaim?.[fate]).toBeUndefined();
 expect(s.windows??[]).toEqual([]);expect(s.lifecycle??[]).toEqual([]);expect(Object.keys(s.actions??{})).toEqual([]);expect(Object.keys(s.groups??{})).toEqual([]);
 expect(allCardInstanceIds(s).sort()).toEqual(actionCards.map(c=>c.id).sort());
 expect(s.events.filter(e=>e.type==='PLAYER_EXITED'&&e.actorId==='B')).toHaveLength(1);
});
