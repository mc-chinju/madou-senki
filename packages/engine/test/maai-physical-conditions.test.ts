import {expect,it} from 'vitest';
import {getAction} from '@madou/catalog';
import {transition,viewFor,type GameState} from '../src/index.js';
import {act,finish,pass,passReclaims,ready,until} from './combat-helpers.js';
import {entropy} from './fixtures.js';
import {assignCharacter,takeCard,trimHand} from '../../../apps/worker/test/fixtures/scenario-tools.js';
import {makeR6MaaiScenario} from '../../../apps/worker/test/fixtures/r6-maai-scenarios.js';

function prepared(card:string,owner='B'){
 const s=ready();assignCharacter(s,'A','侍大将のシン');assignCharacter(s,'B','黒騎士ガーウィン');
 assignCharacter(s,'C','大神官ジル');assignCharacter(s,'D','魔導王ガイナス');
 for(const p of Object.values(s.players))p.permanent={endurance:100,spirit:20,warrior_level:20,magic_level:20};
 s.players.B!.damage=3;takeCard(s,owner,card);trimHand(s,owner,card);
 s.deck=[...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];return s;
}
function rejected(s:GameState,actorId:string,command:unknown){
 const before=JSON.stringify(s),views=s.seatOrder.map(id=>viewFor(s,id));
 expect(transition(s,{actorId,command} as Parameters<typeof transition>[1],entropy()).ok).toBe(false);
 expect(JSON.stringify(s)).toBe(before);expect(s.seatOrder.map(id=>viewFor(s,id))).toEqual(views);
}

it.each(['a2-p07-r1c1','a2-p07-r1c2','a2-p07-r1c3','a2-p07-r2c1','a2-p07-r2c2','a2-p07-r2c3','a2-p07-r3c1','a2-p07-r3c2'])('Physical %s maai evades only one of three actually chanted sword hits',card=>{
 let s=makeR6MaaiScenario(['A','B','C','D'].map(id=>({id,name:id})),true,card);
 expect(s.players.B!.hand).toContain(card);expect(Object.values(s.groups!)[0]!.hitIndices).toEqual([0,1,2]);
 s=passReclaims(act(s,'B',{type:'PLAY_MAAI',cardInstanceId:card}));s=act(s,'A',{type:'PASS'});
 expect(Object.values(s.groups!)[0]!.targets[0]!.hits.map(h=>h.defended)).toEqual([true,false,false]);
 expect(Object.values(s.groups!)[0]!.hitCursor).toBe(1);
 rejected(s,'B',{type:'PLAY_MAAI',cardInstanceId:card});
 s=finish(s);expect(s.players.B!.damage).toBe(14);expect(s.phase).toBe('withdrawal');
 expect(s.discard.filter(id=>id===card)).toHaveLength(1);
});

it.each(['a2-p07-r1c1','a2-p07-r1c2','a2-p07-r1c3','a2-p07-r2c1','a2-p07-r2c2','a2-p07-r2c3','a2-p07-r3c1','a2-p07-r3c2'])('Physical %s maai needs a second distinct card for an actual additional-one attack',card=>{
 for(const count of [1,2]){
  let s=prepared(card);const second=card==='a2-p07-r1c1'?'a2-p07-r1c2':'a2-p07-r1c1';takeCard(s,'B',second);trimHand(s,'B',card,second);
  const attack=takeCard(s,'A','黒翼飛翔剣');trimHand(s,'A',attack);
  s=until(act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false}),'normal-defense');
  s=passReclaims(act(s,'B',{type:'PLAY_MAAI',cardInstanceId:card}));
  expect(viewFor(s,'B').maaiDefense!.targets[0]).toMatchObject({submitted:1,remaining:1});
  expect(s.windows!.at(-1)).toMatchObject({kind:'normal-defense',continuation:{targetId:'B'}});
  rejected(s,'B',{type:'PLAY_MAAI',cardInstanceId:card});
  if(count===2)s=passReclaims(act(s,'B',{type:'PLAY_MAAI',cardInstanceId:second}));
  s=finish(s);expect(s.players.B!.damage).toBe(count===2?3:10);
  expect(s.discard.filter(id=>id===card)).toHaveLength(1);
  if(count===2)expect(s.discard.filter(id=>id===second)).toHaveLength(1);else expect(s.players.B!.hand).toContain(second);
 }
});

it.each(['a2-p07-r1c1','a2-p07-r1c2','a2-p07-r1c3','a2-p07-r2c1','a2-p07-r2c2','a2-p07-r2c3','a2-p07-r3c1','a2-p07-r3c2'])('Physical %s combat maai is canceled by one actual advance without changing distances',card=>{
 let s=prepared(card);const attack=takeCard(s,'A','踏み込み／弓'),advance=takeCard(s,'A','踏み込み／蹴る');trimHand(s,'A',attack,advance);const distances=structuredClone(s.distances);
 s=until(act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false}),'normal-defense');
 s=passReclaims(act(s,'B',{type:'PLAY_MAAI',cardInstanceId:card}));
 s=passReclaims(act(s,'A',{type:'PLAY_ADVANCE',cardInstanceId:advance}));
 expect(s.windows!.at(-1)).toMatchObject({kind:'normal-defense',continuation:{targetId:'B'}});
 s=finish(s);expect(s.players.B!.damage).toBe(7);expect(s.distances).toEqual(distances);
 for(const id of [card,advance])expect(s.discard.filter(value=>value===id)).toHaveLength(1);
 expect(Object.values(s.distanceMarkers??{})).toEqual([]);
});

it.each(['a2-p07-r1c1','a2-p07-r1c2','a2-p07-r1c3','a2-p07-r2c1','a2-p07-r2c2','a2-p07-r2c3','a2-p07-r3c1','a2-p07-r3c2'])('Physical %s maai answers an actual approach and keeps both directions far',card=>{
 let s=prepared(card);const advance=takeCard(s,'A','踏み込み／蹴る');trimHand(s,'A',advance);
 s=act(s,'A',{type:'APPROACH',targetId:'B',cardInstanceId:advance});
 s=act(s,'B',{type:'PLAY_MAAI',cardInstanceId:card});s=finish(s);
 expect(s.distances.A!.B).toBe('far');expect(s.distances.B!.A).toBe('far');expect(s.phase).toBe('action');
 expect(s.players.B!.damage).toBe(3);expect(Object.values(s.distanceMarkers??{})).toEqual([]);
 for(const id of [card,advance])expect(s.discard.filter(value=>value===id)).toHaveLength(1);
});

it.each(['a2-p07-r1c1','a2-p07-r1c2','a2-p07-r1c3','a2-p07-r2c1','a2-p07-r2c2','a2-p07-r2c3','a2-p07-r3c1','a2-p07-r3c2'])('Physical %s withdraws after an actual approach and attack and removes the old marker once',card=>{
 let s=prepared(card,'A');const advance=takeCard(s,'A','踏み込み／蹴る'),attack=takeCard(s,'A','踏み込み／弓');trimHand(s,'A',card,advance,attack);
 s=finish(act(s,'A',{type:'APPROACH',targetId:'B',cardInstanceId:advance}));
 expect(s.distances.A!.B).toBe('near');expect(Object.values(s.distanceMarkers!)[0]!.cardInstanceId).toBe(advance);
 s=finish(act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false}));expect(s.phase).toBe('withdrawal');
 s=finish(act(s,'A',{type:'WITHDRAW',targetId:'B',cardInstanceId:card}));
 expect(s.distances.A!.B).toBe('far');expect(s.distances.B!.A).toBe('far');expect(s.phase).toBe('hand-adjustment');
 expect(Object.values(s.distanceMarkers!)).toEqual([]);expect(s.players.A!.damage).toBe(0);
 for(const id of [card,advance])expect(s.discard.filter(value=>value===id)).toHaveLength(1);
 rejected(s,'A',{type:'WITHDRAW',targetId:'B',cardInstanceId:card});
});

it.each(['a2-p07-r1c1','a2-p07-r1c2','a2-p07-r1c3','a2-p07-r2c1','a2-p07-r2c2','a2-p07-r2c3','a2-p07-r3c1','a2-p07-r3c2'])('Physical %s stays in hand when the actual incoming technique prohibits maai',card=>{
 let s=prepared(card);const attack=takeCard(s,'A','a2-p15-r2c2');trimHand(s,'A',attack);
 s=until(act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false}),'normal-defense');
 expect(Object.values(s.groups!)[0]!.technique.maaiProhibited).toBe(true);
 rejected(s,'B',{type:'PLAY_MAAI',cardInstanceId:card});
 s=finish(s);expect(s.players.B!.hand).toContain(card);expect(s.discard).not.toContain(card);
 expect(s.reclaimDecisions?.filter(d=>d.cardInstanceId===card)??[]).toEqual([]);expect(s.players.B!.damage).toBe(5);
});
