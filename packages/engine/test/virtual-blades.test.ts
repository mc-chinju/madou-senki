import {getAction} from '@madou/catalog';
import {expect,it} from 'vitest';
import {transition,viewFor,type GameState, discardIds } from '../src/index.js';
import {act,ready,finish,until,pass,closeWindow} from './combat-helpers.js';
import {character,entropy,handCard,handCards} from './fixtures.js';
const sources=[['凍気のアイエル','c2-p04-r1c1-ab02','水',3,2],['爆炎のフレイアード','c2-p06-r2c1-ab02','炎',5,1]] as const;
function setup(name:string){const s=ready();character(s,'A',name);s.players.A!.revealed=true;for(const p of Object.values(s.players))p.permanent={endurance:100,spirit:20};s.distances.A!.B=s.distances.B!.A='near';handCard(s,'C','命運凶変');return s;}
it.each(sources)('%s declares its exact virtual profile and finishes without physical source disposal',(name,abilityId,element,damage,maaiRequired)=>{
 let s=setup(name);const hands=Object.fromEntries(s.seatOrder.map(id=>[id,[...s.players[id]!.hand]])),discard=[...discardIds(s)];
 s=act(s,'A',{type:'DECLARE_VIRTUAL_BLADE',abilityId,targetIds:['B']});expect(Object.values(s.actions!)[0]).toMatchObject({source:{kind:'ability',abilityId,actorId:'A'},cardInstanceId:null});
 s=until(s,'normal-defense');expect(Object.values(s.actions!)[0]!.technique).toMatchObject({school:'magic',range:'near',useLevel:4,effectLevel:4,damage,attributes:['魔',element],maaiRequired});expect(Object.values(s.groups!)).toHaveLength(1);
 s=finish(s);expect(s.reclaimDecisions??[]).toEqual([]);expect(s.players.B!.damage).toBe(damage);expect(discardIds(s)).toEqual(discard);for(const id of s.seatOrder)expect(s.players[id]!.hand).toEqual(hands[id]);expect(s.phase).toBe('withdrawal');expect(s.actions).toEqual({});expect(s.groups).toEqual({});
});
it.each(sources)('%s Fate cancellation consumes the attack without creating a virtual discard',(name,abilityId)=>{
 let s=setup(name);const hand=[...s.players.A!.hand],discard=[...discardIds(s)];s=act(s,'A',{type:'DECLARE_VIRTUAL_BLADE',abilityId,targetIds:['B']});while(viewFor(s,'C').activeWindow?.pendingActorId!=='C')s=pass(s);
 s=act(s,'C',{type:'PLAY_REACTION',cardInstanceId:'a2-p02-r2c3',mode:'cancel-ability',targetAbilityId:viewFor(s,'C').reactionTargetAbilityId!});s=finish(s);expect(s.players.B!.damage).toBe(0);expect(s.players.A!.hand).toEqual(hand);expect(discardIds(s)).toEqual([...discard,'a2-p02-r2c3']);expect(s.phase).toBe('withdrawal');expect(s.actions).toEqual({});
});
it.each(sources)('%s rejects hidden ownership, foreign actor, far target and invented descriptor unchanged',(name,abilityId)=>{
 const start=setup(name);for(const variant of ['hidden','foreign','far','numeric','stale'] as const){const s=structuredClone(start);if(variant==='hidden')s.players.A!.revealed=false;if(variant==='far')s.distances.A!.B=s.distances.B!.A='far';const before=JSON.stringify(s),command={type:'DECLARE_VIRTUAL_BLADE',abilityId,targetIds:['B'],...(variant==='numeric'?{damage:100}:{}),...(variant==='stale'?{targetEventId:'old'}:{})};expect(transition(s,{actorId:variant==='foreign'?'D':'A',command} as never,entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);expect(s.phase).toBe('action');}
});
it.each(sources)('%s privately offers only the owned source and requires the printed maai count',(name,abilityId,element,damage,required)=>{
 for(const count of [1,2]){let s=setup(name);const maais=handCards(s,['B','B'],'間合い／休息');expect(viewFor(s,'A').virtualBladeOptions.map(o=>o.abilityId)).toEqual([abilityId]);for(const id of ['B','C','D'])expect(viewFor(s,id).virtualBladeOptions).toEqual([]);
  s=until(act(s,'A',{type:'DECLARE_VIRTUAL_BLADE',abilityId,targetIds:['B']}),'normal-defense');expect(viewFor(s,'B').currentAction).toMatchObject({source:'ability',abilityId,technique:{school:'magic',attributes:['魔',element]}});
  s=act(s,'B',{type:'PLAY_MAAI',cardInstanceId:maais[0]});if(required===2&&count===2){s=until(s,'normal-defense');s=act(s,'B',{type:'PLAY_MAAI',cardInstanceId:maais[1]});}s=finish(s);expect(s.players.B!.damage).toBe(count>=required?0:damage);
 }
});
it.each(sources)('%s resumes a real physical reflection without inventing an original card',(name,abilityId,element,damage)=>{
 let s=setup(name);const mirror=handCard(s,'B',getAction('a2-p12-r3c2')!.name);s=until(act(s,'A',{type:'DECLARE_VIRTUAL_BLADE',abilityId,targetIds:['B']}),'normal-defense');s=until(act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:mirror,dedicated:false}),'normal-defense');
 expect(viewFor(s,'A').currentAttack!.attackerId).toBe('B');const child=Object.values(s.actions!).find(a=>a.actorId==='B')!;expect(child).toMatchObject({fixedReceivedEffect:true,effectSourceAbilityId:abilityId,sourceCardInstanceIds:[]});s=finish(s);expect(s.players.B!.damage).toBe(0);expect(s.players.A!.damage).toBe(damage);expect(discardIds(s).filter(id=>id===mirror)).toHaveLength(1);expect(s.phase).toBe('withdrawal');
});
it('Actual source suppression during virtual blade declaration consumes the attack without a hit',()=>{
 let s=setup('凍気のアイエル');character(s,'C','破壊神ヴァンミール');s.players.C!.revealed=true;s=act(s,'A',{type:'DECLARE_VIRTUAL_BLADE',abilityId:'c2-p04-r1c1-ab02',targetIds:['B']});while(viewFor(s,'C').activeWindow?.pendingActorId!=='C')s=pass(s);const abilityId='c2-p07-r1c2-ab03',o=viewFor(s,'C').abilityOptions.find(o=>o.abilityId===abilityId)!;expect(o).toBeDefined();s=finish(act(s,'C',{type:'USE_ABILITY',abilityId,targetEventId:o.targetEventId,targetIds:['A']}));expect(s.players.B!.damage).toBe(0);expect(s.phase).toBe('withdrawal');expect(discardIds(s)).toEqual([]);
});
it('Virtual blade uses ordinary excess-level before/after rolls',()=>{
 let s=setup('凍気のアイエル');s.players.A!.permanent={magic_level:-3,endurance:100,spirit:20};s=act(s,'A',{type:'DECLARE_VIRTUAL_BLADE',abilityId:'c2-p04-r1c1-ab02',targetIds:['B']});s=until(s,'before-roll');expect(viewFor(s,'A').currentRoll).toMatchObject({purpose:'excess-level',stage:'before-roll'});s=closeWindow(s,[1,2]);expect(viewFor(s,'A').currentRoll).toMatchObject({stage:'after-roll',faces:[1,2]});s=finish(s);expect(s.players.B!.damage).toBe(3);
});
it.each([false,true])('Failed virtual use check, God reroll=%s, preserves the source and attack opportunity',reroll=>{
 let s=setup('凍気のアイエル');s.players.A!.permanent={magic_level:-3,endurance:100,spirit:0};handCard(s,'C',getAction('a2-p02-r1c3')!.name);s=until(act(s,'A',{type:'DECLARE_VIRTUAL_BLADE',abilityId:'c2-p04-r1c1-ab02',targetIds:['B']}),'before-roll');s=closeWindow(s,[6,6]);const roll=viewFor(s,'A').currentRoll!;expect(roll).toMatchObject({stage:'after-roll',success:false});
 if(reroll){while(viewFor(s,'C').activeWindow?.pendingActorId!=='C')s=pass(s);s=act(s,'C',{type:'PLAY_REACTION',cardInstanceId:'a2-p02-r1c3',mode:'reroll',targetRollId:roll.rollId});s=finish(s);}else s=finish(s);
 expect(s.players.B!.damage).toBe(reroll?3:0);expect(s.phase).toBe('withdrawal');expect(discardIds(s)).not.toContain(null);
});
it('A real physical counter resumes the exact virtual parent once',()=>{
 let s=setup('凍気のアイエル');const card=handCard(s,'B','妖撃破山剣');s=until(act(s,'A',{type:'DECLARE_VIRTUAL_BLADE',abilityId:'c2-p04-r1c1-ab02',targetIds:['B']}),'normal-defense');const parent=Object.values(s.groups!)[0]!.id;s=until(act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:card,dedicated:false}),'normal-defense');const child=Object.values(s.actions!).find(a=>a.actorId==='B')!;expect(child.resume!.groupId).toBe(parent);const damage=child.technique.damage!;s=finish(s);expect([s.players.A!.damage,s.players.B!.damage]).toEqual([damage,0]);expect(discardIds(s).filter(id=>id===card)).toHaveLength(1);expect(s.actions).toEqual({});expect(s.groups).toEqual({});expect(s.phase).toBe('withdrawal');
});
