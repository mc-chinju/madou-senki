import {expect,it} from 'vitest';
import {getAction} from '@madou/catalog';
import {transition,viewFor,type GameState} from '../src/index.js';
import {act,finish,pass,ready} from './combat-helpers.js';
import {entropy} from './fixtures.js';
import {assignCharacter,takeCard,trimHand} from './fixtures/scenario-tools.js';

function prepared(card:string,damage=8){
 const s=ready();assignCharacter(s,'A','占星術師のアルセイル');assignCharacter(s,'B','黒騎士ガーウィン');assignCharacter(s,'C','大神官ジル');assignCharacter(s,'D','魔導王ガイナス');
 for(const p of Object.values(s.players))p.permanent={endurance:100,spirit:20};
 s.players.A!.damage=damage;s.players.B!.damage=3;takeCard(s,'A',card);trimHand(s,'A',card);
 s.deck=[...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];return s;
}
function rejected(s:GameState,actorId:string,command:unknown){
 const before=JSON.stringify(s),views=s.seatOrder.map(id=>viewFor(s,id));
 expect(transition(s,{actorId,command} as Parameters<typeof transition>[1],entropy()).ok).toBe(false);
 expect(JSON.stringify(s)).toBe(before);expect(s.seatOrder.map(id=>viewFor(s,id))).toEqual(views);
}
/** A numeric potion rolls at declaration resolution; its saved result window gets different dice. */
function finishPotions(initial:GameState,faces:number[]){
 let s=initial;const finalized=new Map<string,number>();
 for(let n=0;n<300;n++){
  const rolls=s.rolls?.filter(r=>r.purpose==='potion-recovery')??[];
  for(const r of rolls)if(r.total!==null&&r.total!==undefined){
   if(finalized.has(r.id))expect(r.total).toBe(finalized.get(r.id));else finalized.set(r.id,r.total);
  }
  const w=s.windows?.at(-1);if(!w){expect(rolls.map(r=>r.total)).toEqual(faces);return s;}
  const face=w.kind==='after-roll'?6:(faces[rolls.length]??6);
  expect(face).toBeDefined();s=pass(JSON.parse(JSON.stringify(s)),Array(30).fill(face));
 }
 throw Error('POTION_PHYSICAL_LIMIT');
}

it.each(['a2-p04-r2c3','a2-p04-r3c1'])('Physical %s potion uses one actual d6 to heal only its user and spend the action',card=>{
 for(const face of [1,2,3,4,5,6]){
  let s=prepared(card);rejected(s,'B',{type:'PLAY_TURN_CARD',cardInstanceIds:[card]});
  rejected(s,'A',{type:'REST',cardInstanceIds:[card]});
  s=act(s,'A',{type:'PLAY_TURN_CARD',cardInstanceIds:[card]});expect(s.players.A!.damage).toBe(8);
  expect(s.resolution).toContain(card);expect(s.players.A!.hand).not.toContain(card);
  s=finishPotions(s,[face]);expect(s.players.A!.damage).toBe(8-face);expect(s.players.B!.damage).toBe(3);
  expect(s.rolls!.filter(r=>r.purpose==='potion-recovery')).toMatchObject([{formula:'d6',rollerId:'A',total:face,stage:'applied'}]);
  expect(s.discard.filter(id=>id===card)).toHaveLength(1);expect(s.phase).toBe('hand-adjustment');
  rejected(s,'A',{type:'PLAY_TURN_CARD',cardInstanceIds:[card]});rejected(s,'A',{type:'PASS_ACTION'});
 }
});

it.each(['a2-p04-r2c3','a2-p04-r3c1'])('Physical %s potion combines with its other physical copy using two independent saved dice',card=>{
 let s=prepared(card);const second=card==='a2-p04-r2c3'?'a2-p04-r3c1':'a2-p04-r2c3';takeCard(s,'A',second);trimHand(s,'A',card,second);
 rejected(s,'A',{type:'PLAY_TURN_CARD',cardInstanceIds:[card,card]});
 s=act(s,'A',{type:'PLAY_TURN_CARD',cardInstanceIds:[card,second]});expect(s.resolution).toEqual(expect.arrayContaining([card,second]));
 s=finishPotions(s,[2,5]);expect(s.players.A!.damage).toBe(1);expect(s.players.B!.damage).toBe(3);
 const rolls=s.rolls!.filter(r=>r.purpose==='potion-recovery');expect(new Set(rolls.map(r=>r.id)).size).toBe(2);
 for(const id of [card,second])expect(s.discard.filter(value=>value===id)).toHaveLength(1);
 expect(s.phase).toBe('hand-adjustment');
});

it.each(['a2-p04-r2c3','a2-p04-r3c1'])('Physical %s potion never heals beyond the users current damage',card=>{
 for(const damage of [0,2]){let s=prepared(card,damage);s=act(s,'A',{type:'PLAY_TURN_CARD',cardInstanceIds:[card]});s=finishPotions(s,[6]);expect(s.players.A!.damage).toBe(0);expect(s.players.B!.damage).toBe(3);expect(s.discard.filter(id=>id===card)).toHaveLength(1);}
});

it.each(['a2-p04-r2c3','a2-p04-r3c1'])('Physical %s canceled potion stays paid and heals nothing without generating a die',card=>{
 let s=prepared(card);const fate=takeCard(s,'B','命運凶変');trimHand(s,'B',fate);
 s=act(s,'A',{type:'PLAY_TURN_CARD',cardInstanceIds:[card]});const action=s.windows!.at(-1)!.continuation.id;
 s=pass(s);s=act(s,'B',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel',targetActionId:action});s=finish(s);
 expect(s.players.A!.damage).toBe(8);expect(s.players.B!.damage).toBe(3);
 expect(s.rolls?.filter(r=>r.purpose==='potion-recovery')??[]).toEqual([]);
 for(const id of [card,fate])expect(s.discard.filter(value=>value===id)).toHaveLength(1);expect(s.phase).toBe('hand-adjustment');
});

it.each(['a2-p04-r2c3','a2-p04-r3c1'])('Physical %s first potion cancellation preserves the second paid copy and its one saved die',card=>{
 let s=prepared(card);const second=card==='a2-p04-r2c3'?'a2-p04-r3c1':'a2-p04-r2c3';takeCard(s,'A',second);trimHand(s,'A',card,second);const fate=takeCard(s,'B','命運凶変');trimHand(s,'B',fate);
 s=act(s,'A',{type:'PLAY_TURN_CARD',cardInstanceIds:[card,second]});const action=s.windows!.at(-1)!.continuation.id;
 s=pass(s);s=act(s,'B',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel',targetActionId:action});
 s=finishPotions(s,[5]);expect(s.players.A!.damage).toBe(3);expect(s.players.B!.damage).toBe(3);
 for(const id of [card,second,fate])expect(s.discard.filter(value=>value===id)).toHaveLength(1);expect(s.phase).toBe('hand-adjustment');
});
