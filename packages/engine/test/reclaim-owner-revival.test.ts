import {expect,it} from 'vitest';
import {getAction} from '@madou/catalog';
import {gameStats} from '../src/index.js';
import {act,pass} from './combat-helpers.js';
import {freshGame} from './fixtures.js';
import {assignCharacter,takeCard,trimHand} from './fixtures/scenario-tools.js';

it('Actual same-root death and FuSen revival do not give the old reserved prayer to the new life',()=>{
 let s=freshGame();
 assignCharacter(s,'A','侍大将のシン');assignCharacter(s,'B','リーア姫');assignCharacter(s,'C','魔導王ガイナス');assignCharacter(s,'D','黒騎士ガーウィン');
 for(const p of Object.values(s.players))p.permanent={endurance:100,warrior_level:20,spirit:20};
 for(const id of ['B','C'])s.players[id]!.damage=gameStats(s,id).endurance-1;
 const sword=takeCard(s,'A','天地百撃斬'),prayer=takeCard(s,'B','必勝の祈り'),gift=takeCard(s,'C','「これで勝ったと思うなよ」'),transfer=takeCard(s,'C','香具羅'),fate=takeCard(s,'A','命運凶変'),fusen=takeCard(s,'D','a2-p01-r1c1');
 s.players.D!.hand=s.players.D!.hand.filter(id=>id!==fusen);
 for(const id of s.seatOrder)trimHand(s,id,sword,prayer,gift,transfer,fate);
 s.deck=[...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];
 // A chant refill, D short-hand refill and B prayer refill precede the death-gift child.
 s.deck.splice(3,0,fusen);
 for(const id of s.seatOrder)s=act(s,id,{type:'PASS_SETUP'});
 s=act(s,'A',{type:'START_TURN'});s=act(s,'A',{type:'CHOOSE_DRAW',draw:false});s=act(s,'A',{type:'CHANT',cardInstanceId:sword});
 for(let n=0;n<200;n++){
  const id=s.seatOrder[s.turnSeat]!;
  if(s.windows?.length)s=pass(s);
  else if(s.phase==='action'){if(id==='A')break;s=act(s,id,{type:'PASS_ACTION'});}
  else if(s.phase==='withdrawal')s=act(s,id,{type:'PASS_WITHDRAWAL'});
  else if(s.phase==='hand-adjustment')s=act(s,id,{type:'END_TURN',discardIds:s.players[id]!.hand.filter(x=>![prayer,gift,transfer,fate].includes(x)).slice(0,Math.max(0,s.players[id]!.hand.length-gameStats(s,id).handLimit))});
  else if(s.phase==='turn-start')s=act(s,id,{type:'START_TURN'});
  else if(s.phase==='draw')s=act(s,id,{type:'CHOOSE_DRAW',draw:false});
  else throw Error(`REVIVAL_TURN_${s.phase}`);
 }
 s=act(s,'A',{type:'ATTACK',cardInstanceId:sword,targetIds:['B','C'],dedicated:true});
 for(let n=0;n<200;n++){const w=s.windows!.at(-1)!;if(w.kind==='effect-level'&&w.participants[w.cursor]==='B')break;s=pass(s);}
 const root=Object.values(s.actions!).find(a=>a.cardInstanceId===sword)!,life=s.players.B!.lifeId??'initial-life:B';
 s=act(s,'B',{type:'PLAY_REACTION',cardInstanceId:prayer,mode:'effect-plus',targetActionId:root.id,dedicated:true});
 let reserved=false,died=false,revived=false,giftPlayed=false,canceled=false;
 for(let n=0;n<600&&s.windows?.length;n++){
  const w=s.windows!.at(-1)!,actor=w.participants[w.cursor]!;
  if(s.reclaimReservations.includes(prayer))reserved=true;
  if(s.players.B!.presence==='dead'){died=true;expect(s.reclaimReservations).toContain(prayer);}
  if(w.kind==='death-gift'&&actor==='C'&&!giftPlayed){
   expect(died).toBe(true);giftPlayed=true;s=act(s,'C',{type:'PLAY_DEATH_GIFT',cardInstanceId:gift,giftCardInstanceId:transfer,targetId:'D'});
  }else if(w.kind==='revival'&&actor==='B'){
   expect(died).toBe(true);expect(s.reclaimReservations).toContain(prayer);
   expect(s.lifecycle?.some(t=>t.rootEventIds?.includes(root.eventId))).toBe(true);
   s=act(JSON.parse(JSON.stringify(s)),'B',{type:'CHOOSE_REVIVAL',revive:true});revived=true;
   expect(s.players.B!.lifeId).not.toBe(life);expect(s.players.B!.hand).not.toContain(prayer);
   expect(s.reclaim![prayer]).toMatchObject({ownerId:'B',ownerLifeId:life,eventId:root.eventId});
  }else if(w.kind==='re-setup')s=act(s,actor,{type:'PASS_SETUP'});
  else {
   const child=Object.values(s.actions??{}).find(a=>a.cardInstanceId===gift);
   if(child&&actor==='A'&&w.kind==='declaration'&&!canceled){canceled=true;s=act(s,'A',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel',targetActionId:child.id});}
   else s=pass(JSON.parse(JSON.stringify(s)));
  }
 }
 expect({reserved,died,revived,giftPlayed},JSON.stringify({canceled,events:s.events.filter(e=>e.id>30&&['OPEN','CARD_DRAWN','PLAYER_DIED','PLAYER_REVIVED'].includes(e.type)),fusenInDeck:s.deck.indexOf(fusen),open:s.players.A!.open})).toEqual({reserved:true,died:true,revived:true,giftPlayed:true});
 expect(s.players.B!.presence).toBe('active');expect(s.players.C!.presence).toBe('dead');
 expect(s.players.B!.hand).not.toContain(prayer);expect(s.discard.filter(id=>id===prayer)).toHaveLength(1);
 expect(s.reclaimReservations).toEqual([]);expect(s.reclaim?.[prayer]).toBeUndefined();
 expect(s.windows??[]).toEqual([]);expect(s.lifecycle??[]).toEqual([]);
 expect(canceled).toBe(true);expect(Object.keys(s.actions??{})).toEqual([]);expect(Object.keys(s.groups??{})).toEqual([]);
 expect(s.events.filter(e=>e.type==='PLAYER_DIED'&&e.actorId==='B')).toHaveLength(1);
 expect(s.events.filter(e=>e.type==='PLAYER_REVIVED'&&e.actorId==='B')).toHaveLength(1);
 expect(s.used).toContain(`${root.eventId}:B:${prayer}`);
});
