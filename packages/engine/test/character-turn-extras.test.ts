import {expect,it} from 'vitest';
import {getAction} from '@madou/catalog';
import {transition,viewFor,type GameState} from '../src/index.js';
import {act,finish,pass,ready,until} from './combat-helpers.js';
import {character,entropy,handCard} from './fixtures.js';
import {nextOwnAction} from './owned-reclaim-helpers.js';
const EXTRA_CASES: [string,string,string|null][] = [
 ['小妖精のチャム','c2-p01-r2c2-ab03','B'],
 ['リーア姫','c2-p03-r1c2-ab02','B'],
 ['リーア姫','c2-p03-r1c2-ab04','C'],
 ['吟遊詩人のレスター','c2-p03-r2c1-ab03','B'],
 ['占星術師のアルセイル','c2-p04-r2c1-ab02','B'],
 ['占星術師のアルセイル','c2-p04-r2c1-ab01',null],
 ['邪祭ウーノス','c2-p05-r1c1-ab01','B'],
];
const BLESS='c2-p03-r1c2-ab04',BAN='c2-p07-r1c2-ab03';
function setup(name:string,id:string){
 let s=ready();character(s,'A',name);character(s,'C','リーア姫');
 character(s,'D',s.players.A!.faction==='GOOD'?'魔導王ガイナス':'リーア姫');
 if(id===BLESS){character(s,'B','破壊神ヴァンミール');character(s,'C','侍大将のシン');s.players.B!.revealed=true;}
 if(id==='c2-p04-r2c1-ab01')s.players.A!.revealed=true;
 for(const p of Object.values(s.players))p.permanent={endurance:100,spirit:20};
 s.distances.A!.B=s.distances.B!.A='near';
 const fate=handCard(s,'D','命運凶変'),bow=handCard(s,'A','踏み込み／弓'),orb=handCard(s,'A','遠見の水晶球');
 s.deck=[...s.deck.filter(c=>getAction(c)!.category!=='open'),...s.deck.filter(c=>getAction(c)!.category==='open')];
 if(id===BLESS){
  const setting=viewFor(s,'A').conditionalAbilities.find(o=>o.abilityId==='c2-p03-r1c2-ab03')!;
  s=act(s,'A',{type:'SET_CONDITIONAL_ABILITY',abilityId:setting.abilityId,targetEventId:setting.targetEventId,enabled:true,targetIds:[]});
  while(s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!=='B')s=pass(s);
  const ban=viewFor(s,'B').abilityOptions.find(o=>o.abilityId===BAN)!;
  s=finish(act(s,'B',{type:'USE_ABILITY',abilityId:BAN,targetEventId:ban.targetEventId,targetIds:['C']}));
  expect(s.suppressionDesignations?.map(d=>d.targetId)).toEqual(['C']);
 }
 return {s,fate,bow,orb};
}
function option(s:GameState,id:string){const o=viewFor(s,'A').abilityOptions.find(o=>o.abilityId===id);expect(o).toBeDefined();return o!;}
function use(s:GameState,id:string,target:string|null){return act(s,'A',{type:'USE_ABILITY',abilityId:id,targetEventId:option(s,id).targetEventId,...(target?{targetId:target}:{})});}
function reject(s:GameState,command:unknown){const before=JSON.stringify(s),views=s.seatOrder.map(id=>viewFor(s,id));expect(transition(s,{actorId:'A',command} as Parameters<typeof transition>[1],entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);expect(s.seatOrder.map(id=>viewFor(s,id))).toEqual(views);}
it.each(EXTRA_CASES)('%s %s target %s own-turn-once-attempt',(name,id,target)=>{
 let {s,fate,bow}=setup(name,id);expect(option(s,id).actionCost).toBe('extra');
 const command={type:'USE_ABILITY',abilityId:id,targetEventId:option(s,id).targetEventId,...(target?{targetId:target}:{})};
 s=use(s,id,target);
 while(s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!=='D')s=pass(s);
 s=finish(act(s,'D',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel-ability',targetAbilityId:viewFor(s,'D').reactionTargetAbilityId!}));
 expect(s.phase).toBe('action');expect(viewFor(s,'A').abilityOptions.some(o=>o.abilityId===id)).toBe(false);reject(JSON.parse(JSON.stringify(s)),command);
 s=act(s,'A',{type:'PASS_ACTION'});
 expect(viewFor(s,'A').abilityOptions.some(o=>o.abilityId===id)).toBe(false);reject(JSON.parse(JSON.stringify(s)),command);
 s=nextOwnAction({state:s,ownerId:'A'},bow);
 expect(option(s,id).actionCost).toBe('extra');
});
it.each(EXTRA_CASES)('%s %s target %s main-action-preserved',(name,id,target)=>{
 let {s,bow}=setup(name,id);s=use(s,id,target);
 const frame=Object.values(s.abilities!).find(a=>a.abilityId===id)!;
 expect(frame.targetIds).toEqual(target?[target]:['A']);expect(frame.costs.ownAction).toBe(false);
 s=finish(s);expect(s.phase).toBe('action');
 s=finish(act(s,'A',{type:'ATTACK',cardInstanceId:bow,targetIds:['D'],dedicated:false}));
 expect(s.phase).toBe('withdrawal');expect(s.players.D!.damage).toBeGreaterThan(0);
});
it.each(EXTRA_CASES)('%s %s target %s public-priority-no-private-choice-interrupt',(name,id,target)=>{
 let {s,orb}=setup(name,id);
 if(id==='c2-p03-r1c2-ab02'){
  const setting=viewFor(s,'A').conditionalAbilities.find(o=>o.abilityId==='c2-p03-r1c2-ab03')!;
  s=act(s,'A',{type:'SET_CONDITIONAL_ABILITY',abilityId:setting.abilityId,targetEventId:setting.targetEventId,enabled:true,targetIds:[]});
 }else s=act(s,'A',{type:'PLAY_TURN_CARD',cardInstanceId:orb,targetId:'B'});
 const parent=s.windows!.at(-1)!.id,event=option(s,id).targetEventId;
 let accepted=use(s,id,target);
 for(let n=0;n<300&&accepted.windows?.at(-1)?.id!==parent;n++)accepted=pass(accepted);
 expect(accepted.windows!.at(-1)).toMatchObject({id:parent,cursor:0});
 s=pass(s);expect(s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]).not.toBe('A');
 reject(s,{type:'USE_ABILITY',abilityId:id,targetEventId:event,...(target?{targetId:target}:{})});
 if(id==='c2-p03-r1c2-ab02')s=act(finish(s),'A',{type:'PLAY_TURN_CARD',cardInstanceId:orb,targetId:'B'});
 s=until(s,'private-inspection');expect(viewFor(s,'A').inspection).not.toBeNull();
 expect(viewFor(s,'A').abilityOptions.some(o=>o.abilityId===id)).toBe(false);
 reject(s,{type:'USE_ABILITY',abilityId:id,targetEventId:s.windows!.at(-1)!.eventId,...(target?{targetId:target}:{})});
 s=finish(s);expect(s.windows??[]).toEqual([]);
});
it('Astrology selects exactly one declared player and rejects a multiple-player input atomically',()=>{
 let {s}=setup('占星術師のアルセイル','c2-p04-r2c1-ab02');const id='c2-p04-r2c1-ab02',event=option(s,id).targetEventId;
 reject(s,{type:'USE_ABILITY',abilityId:id,targetEventId:event,targetIds:['B','C']});
 reject(s,{type:'USE_ABILITY',abilityId:id,targetEventId:event,targetId:'missing'});
 s=until(use(s,id,'B'),'private-inspection');expect(viewFor(s,'A').inspection).toMatchObject({targetId:'B',zone:'hand'});
 expect(viewFor(s,'A').inspection!.cards.map(c=>c.cardInstanceId)).toEqual(s.players.B!.hand);
 for(const actor of ['B','C','D'])expect(viewFor(s,actor).inspection).toBeNull();
});
