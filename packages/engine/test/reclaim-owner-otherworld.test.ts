import {expect,it} from 'vitest';
import {getAction} from '@madou/catalog';
import {gameStats,transition,viewFor} from '../src/index.js';
import {act,pass,ready} from './combat-helpers.js';
import {character,entropy,handCard} from './fixtures.js';

it('Reservation owner actual Rift banishment preserves its life and returns prayer once after the root',()=>{
 let s=ready();
 character(s,'A','白魔術師シェリム');character(s,'B','リーア姫');
 s.players.A!.permanent={endurance:100,magic_level:20};
 s.players.B!.permanent={endurance:100};
 const rift=handCard(s,'A',getAction('a2-p14-r2c2')!.name),prayer=handCard(s,'B','必勝の祈り');
 const life=s.players.B!.lifeId??'initial-life:B';
 s=act(s,'A',{type:'CHANT',cardInstanceId:rift});
 for(let n=0;n<200;n++){
  const actor=s.seatOrder[s.turnSeat]!;
  if(s.windows?.length)s=pass(s);
  else if(s.phase==='action'){if(actor==='A')break;s=act(s,actor,{type:'PASS_ACTION'});}
  else if(s.phase==='withdrawal')s=act(s,actor,{type:'PASS_WITHDRAWAL'});
  else if(s.phase==='hand-adjustment')s=act(s,actor,{type:'END_TURN',discardIds:s.players[actor]!.hand.filter(id=>id!==prayer).slice(0,Math.max(0,s.players[actor]!.hand.length-gameStats(s,actor).handLimit))});
  else if(s.phase==='turn-start')s=act(s,actor,{type:'START_TURN'});
  else if(s.phase==='draw')s=act(s,actor,{type:'CHOOSE_DRAW',draw:false});
  else throw Error(`UNEXPECTED_PHASE_${s.phase}`);
 }
 s=act(s,'A',{type:'ATTACK',cardInstanceId:rift,targetIds:['B'],dedicated:false});
 for(let n=0;n<200;n++){
  const w=s.windows?.at(-1);
  if(w?.kind==='effect-level'&&w.participants[w.cursor]==='B')break;
  s=pass(s);
 }
 const action=Object.values(s.actions!).find(a=>a.cardInstanceId===rift)!;
 s=act(s,'B',{type:'PLAY_REACTION',cardInstanceId:prayer,mode:'effect-plus',targetActionId:action.id,dedicated:true});
 for(let n=0;!s.reclaimReservations.includes(prayer)&&n<200;n++)s=pass(s);
 expect(s.reclaimReservations).toContain(prayer);
 expect(s.reclaim![prayer]).toMatchObject({ownerId:'B',ownerLifeId:life,eventId:action.eventId});
 let sawBanishment=false;const riftRespondents:string[]=[];
 for(let n=0;s.windows?.length&&n<400;n++){
  expect(s.players.B!.lifeId??'initial-life:B').toBe(life);
  if(s.reclaimReservations.includes(prayer)){
   expect(s.deck).not.toContain(prayer);expect(s.discard).not.toContain(prayer);
   for(const p of Object.values(s.players))expect(p.hand).not.toContain(prayer);
  }
  const recovery=viewFor(s,'A').reclaim;
  if(s.windows?.at(-1)?.kind==='reclaim'&&recovery?.cardInstanceId===rift){
   expect(s.players.B!.presence).toBe('otherworld');
   expect(s.windows!.at(-1)!.participants).toEqual(['A','C','D']);
   riftRespondents.push(recovery.pendingActorId);
   for(const id of s.seatOrder)expect(viewFor(s,id).reclaim!.pendingActorId).toBe(recovery.pendingActorId);
   expect(viewFor(s,'B').reclaim).toMatchObject({canDecline:false,claims:[]});
   const before=JSON.stringify(s),views=s.seatOrder.map(id=>viewFor(s,id));
   expect(transition(s,{actorId:'B',command:{type:'PASS'}},entropy()).ok).toBe(false);
   expect(JSON.stringify(s)).toBe(before);expect(s.seatOrder.map(id=>viewFor(s,id))).toEqual(views);
  }
  const saved=JSON.parse(JSON.stringify(s));
  expect(s.seatOrder.map(id=>viewFor(saved,id))).toEqual(s.seatOrder.map(id=>viewFor(s,id)));
  const roll=s.rolls?.at(-1);
  s=pass(saved,Array(30).fill(roll?.purpose==='status-resistance'?6:1));
  if(s.players.B!.presence==='otherworld'&&!sawBanishment){
   sawBanishment=true;
   expect(s.reclaimReservations).toContain(prayer);
   expect(s.players.B!.hand).not.toContain(prayer);
  }
 }
 expect(riftRespondents).toEqual(['A','C','D']);
 expect(sawBanishment).toBe(true);expect(s.players.B!.presence).toBe('otherworld');
 expect(s.players.B!.lifeId??'initial-life:B').toBe(life);expect(s.windows??[]).toEqual([]);
 expect(s.players.B!.hand.filter(id=>id===prayer)).toHaveLength(1);
 expect(s.reclaimReservations).toEqual([]);expect(s.reclaim?.[prayer]).toBeUndefined();
 expect(Object.keys(s.actions??{})).toEqual([]);expect(Object.keys(s.groups??{})).toEqual([]);
 expect(s.lifecycle??[]).toEqual([]);expect(s.reclaimDecisions?.filter(d=>d.stage!=='closed')??[]).toEqual([]);
 expect(s.discard.filter(id=>id===rift)).toHaveLength(1);
 expect(s.used).toContain(`${action.eventId}:B:${prayer}`);
});
