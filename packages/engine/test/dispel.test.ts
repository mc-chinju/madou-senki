import {expect,it} from 'vitest';
import {transition,viewFor,type GameState} from '../src/index.js';
import {act,closeWindow,finish,pass,until} from './combat-helpers.js';
import {character,entropy,freshGame,handCard} from './fixtures.js';
const DISPEL='a2-p02-r3c1';
function scenario(mode:'two'|'mixed'|'zero'='mixed'){
 let s=freshGame();character(s,'A','侍大将のシン');character(s,'B','黒騎士ガーウィン');
 const wood=handCard(s,'B','ウッドゴーレム'),stone=handCard(s,'B','ストーンゴーレム'),other=handCard(s,'B','グリフォン');
 s=act(s,'A',{type:'PASS_SETUP'});
 for(const id of (mode==='two'?[wood,stone]:mode==='mixed'?[wood,other]:[other]))s=act(s,'B',{type:'PLACE_INITIAL_FOLLOWER',cardInstanceId:id});
 for(const id of ['B','C','D'])s=act(s,id,{type:'PASS_SETUP'});
 s=act(s,'A',{type:'START_TURN'});s=act(s,'A',{type:'CHOOSE_DRAW',draw:false});
 handCard(s,'A','呪払');const attack=handCard(s,'A','踏み込み／弓');return {s,wood,stone,other,attack};
}
function start(s:GameState,attack:string){return act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false,dispel:{cardInstanceId:DISPEL,targetId:'B'}});}
it.each(['two','mixed'] as const)('Dispel %s commits a real attack, destroys all placed golems before its declaration and exposes no other follower identity',mode=>{
 let {s,wood,stone,other,attack}=scenario(mode);const destroyed=mode==='two'?[wood,stone]:[wood],remaining=mode==='two'?[]:[expect.objectContaining({cardInstanceId:other,revealed:false})];const hand=s.players.A!.hand.length,deck=[...s.deck];
 s=start(s,attack);const child=Object.values(s.actions!).find(a=>a.cardInstanceId===DISPEL)!;expect(child).toBeDefined();expect(s.windows!.at(-1)!.continuation.id).toBe(child.id);expect(Object.keys(s.groups??{})).toHaveLength(0);
 expect(s.players.A!.hand).toHaveLength(hand-2);expect(s.deck).toEqual(deck);s=closeWindow(s);expect(s.players.B!.followers).toEqual(remaining);
 for(let n=0;n<80&&s.windows!.at(-1)!.kind==='reclaim';n++)s=pass(s);
 expect(s.windows!.at(-1)!.kind).toBe('declaration');expect(s.actions![s.windows!.at(-1)!.continuation.id]!.cardInstanceId).toBe(attack);
 expect(s.discard).toEqual(expect.arrayContaining([DISPEL,...destroyed]));expect(s.reclaimDecisions!.filter(d=>d.source.kind==='ordinary-disposition'&&d.source.trigger==='follower-died').map(d=>d.source.cardInstanceId)).toEqual(destroyed);
 const v=viewFor(s,'C');expect(v.players.B!.followers).toEqual(mode==='two'?[]:[{position:0,face:'back'}]);expect(v.logs.filter(e=>e.type==='FOLLOWER_DESTROYED').map(e=>e.cardInstanceId)).toEqual(destroyed);expect(v.logs.some(e=>e.cardInstanceId===other)).toBe(false);
 s=finish(s);expect(s.phase).toBe('withdrawal');expect(s.discard).toContain(attack);
});
it('declining Dispel leaves it in hand and ordinary attack begins directly',()=>{
 let {s,attack}=scenario();s=act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false});expect(s.players.A!.hand).toContain(DISPEL);expect(Object.values(s.actions!)).toHaveLength(1);expect(s.players.B!.followers).toHaveLength(2);
});
it('Fate cancels Dispel alone without refund or refill and the committed attack resumes once',()=>{
 let {s,attack}=scenario();const fate=handCard(s,'B','命運凶変'),hand=s.players.A!.hand.length;s=start(s,attack);const child=viewFor(s,'B').reactionTargetActionId!;
 s=act(s,'B',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel',targetActionId:child});s=until(s,'attack-abilities');expect(s.players.B!.followers).toHaveLength(2);expect(s.players.A!.hand).toHaveLength(hand-2);expect(s.discard).toContain(DISPEL);expect(Object.keys(s.groups!)).toHaveLength(1);s=finish(s);expect(s.phase).toBe('withdrawal');
});
it('zero golems still consumes accepted Dispel and proceeds to attack',()=>{
 let {s,attack}=scenario('zero');s=until(start(s,attack),'attack-abilities');expect(s.discard).toContain(DISPEL);expect(s.players.B!.followers).toHaveLength(1);expect(s.events.some(e=>e.type==='FOLLOWER_DESTROYED')).toBe(false);
});
it('foreign source, unlocked target and illegal attack reject atomically before either card is paid',()=>{
 const {s,attack}=scenario();for(const command of [
  {type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false,dispel:{cardInstanceId:DISPEL,targetId:'C'}},
  {type:'ATTACK',cardInstanceId:DISPEL,targetIds:['B'],dedicated:false,dispel:{cardInstanceId:DISPEL,targetId:'B'}},
  {type:'PLAY_ANYTIME_CARD',cardInstanceId:DISPEL,targetEventId:'free',targetId:'B'},
 ]){const before=JSON.stringify(s);expect(transition(s,{actorId:'A',command} as never,entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);}
 const foreign=structuredClone(s);foreign.players.A!.hand=foreign.players.A!.hand.filter(id=>id!==DISPEL);foreign.players.C!.hand.push(DISPEL);expect(transition(foreign,{actorId:'A',command:{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false,dispel:{cardInstanceId:DISPEL,targetId:'B'}}} as never,entropy()).ok).toBe(false);
});

it('the still unannounced parent is unavailable to attack responses until Dispel finishes',()=>{
 let {s,attack}=scenario();character(s,'A','魔導王ガイナス');s.players.A!.revealed=true;handCard(s,'B','アレキサンドリア城の悲劇');s=start(s,attack);
 expect(viewFor(s,'B').anytimeCardOptions.some(o=>o.cardInstanceId==='a2-p01-r2c3')).toBe(false);
 const parent=Object.values(s.actions!).find(a=>a.kind==='attack')!.id;
 for(let n=0;n<100&&!viewFor(s,'B').anytimeCardOptions.some(o=>o.targetEventId===parent);n++)s=pass(s);
 expect(viewFor(s,'B').anytimeCardOptions.some(o=>o.cardInstanceId==='a2-p01-r2c3'&&o.targetEventId===parent)).toBe(true);
});
it('Dispel finishes before additional attack payments return to the saved declaration',()=>{
 let {s}=scenario();character(s,'A','黒騎士ガーウィン');const attack=handCard(s,'A','魔空剣'),cost=handCard(s,'A','踏み込み／蹴る');
 s=act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:true,advanceCardInstanceIds:[cost],dispel:{cardInstanceId:DISPEL,targetId:'B'}});
 expect(s.actions![s.windows!.at(-1)!.continuation.id]!.cardInstanceId).toBe(DISPEL);expect(s.resolution).toEqual(expect.arrayContaining([DISPEL,attack,cost]));
 s=until(s,'attack-abilities');expect(s.discard).toContain(cost);expect(s.players.B!.followers).toHaveLength(1);expect(Object.keys(s.groups!)).toHaveLength(1);s=finish(s);expect(s.phase).toBe('withdrawal');
});
