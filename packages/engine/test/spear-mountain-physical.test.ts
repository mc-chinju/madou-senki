import {expect,it} from 'vitest';
import {transition,viewFor,type GameState} from '../src/index.js';
import {act,finish,pass,until,closeWindow,passReclaims} from './combat-helpers.js';
import {entropy} from './fixtures.js';
import {makeSpearMountainScenario} from './fixtures/spear-mountain-scenarios.js';
const players=['A','B','C','D'].map(id=>({id,name:id}));
const rows=[['spear-ordinary','a2-p10-r3c3',false],['spear-dedicated','a2-p10-r3c3',true],['mountain-ordinary','a2-p11-r1c2',false],['mountain-dedicated','a2-p11-r1c2',true]] as const;
function reject(s:GameState,actorId:string,command:unknown){const before=JSON.stringify(s),views=s.seatOrder.map(id=>viewFor(s,id));expect(transition(s,{actorId,command} as never,entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);expect(s.seatOrder.map(id=>viewFor(s,id))).toEqual(views);}
it.each(rows)('%s physical %s selected=%s root attack retains exact profile and context-specific usage checks',(scenario,card,dedicated)=>{
 for(const level of [4,5]){let s=makeSpearMountainScenario(scenario,players,{root:true,level});s=act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated});const f=Object.values(s.actions!).find(a=>a.cardInstanceId===card)!,spear=card==='a2-p10-r3c3';expect(f.technique).toMatchObject({school:'warrior',range:spear?'far':'near',useLevel:5,effectLevel:dedicated?6:5,damage:dedicated?7:spear?5:4,attributes:spear?['戦','槍','反']:['戦','剣','白','反'],counter:true,defense:'counter',chant:false});expect(f.checkSpecs).toHaveLength(spear&&dedicated?0:5-level);s=finish(s);expect(s.players.B!.damage).toBe(dedicated?7:spear?5:4);expect(s.rolls?.filter(r=>r.purpose==='counter')??[]).toEqual([]);expect(s.discard.filter(id=>id===card)).toHaveLength(1);}
});
it.each(rows)('%s physical %s selected=%s counter applies ordinary or dedicated checks and returns its own damage',(scenario,card,dedicated)=>{
 let s=makeSpearMountainScenario(scenario,players);s=act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:card,dedicated});const f=Object.values(s.actions!).find(a=>a.cardInstanceId===card)!;expect(f.technique.useLevel).toBe(5);expect(f.technique.effectLevel).toBe(dedicated?6:5);expect(f.checkSpecs).toHaveLength(dedicated?(scenario.startsWith('spear')?1:0):1);s=finish(s);expect([s.players.A!.damage,s.players.B!.damage]).toEqual([dedicated?7:scenario.startsWith('spear')?5:4,0]);expect(s.rolls?.filter(r=>r.purpose==='counter').length??0).toBe(scenario==='spear-dedicated'?1:0);expect(s.discard.filter(id=>id===card)).toHaveLength(1);
});
it.each(rows)('%s physical %s selected=%s actual Fate cancellation preserves incoming hit and offers a different defense',(scenario,card,dedicated)=>{
 let s=act(makeSpearMountainScenario(scenario,players),'B',{type:'PLAY_DEFENSE',cardInstanceId:card,dedicated});const id=Object.values(s.actions!).find(a=>a.cardInstanceId===card)!.id;while(s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!=='C')s=pass(s);s=act(s,'C',{type:'PLAY_REACTION',cardInstanceId:'a2-p02-r2c3',mode:'cancel',targetActionId:id});s=until(s,'normal-defense');reject(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:card,dedicated:false});expect(s.discard.filter(x=>x===card)).toHaveLength(1);s=finish(act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:'a2-p05-r3c1',dedicated:false}));expect([s.players.A!.damage,s.players.B!.damage]).toEqual([0,0]);
});
it.each(rows)('%s physical %s selected=%s refuses prohibited source and follower-started defense without cost',(scenario,card,dedicated)=>{
 const forbidden=makeSpearMountainScenario(scenario,players,{prohibited:true});reject(forbidden,'B',{type:'PLAY_DEFENSE',cardInstanceId:card,dedicated});let s=makeSpearMountainScenario(scenario,players);reject(s,'C',{type:'PLAY_DEFENSE',cardInstanceId:card,dedicated});s=act(s,'B',{type:'START_FOLLOWERS'});reject(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:card,dedicated});
});
it.each(['spear-dedicated','mountain-dedicated'] as const)('%s refuses foreign owner while preserving all views',scenario=>{
 const s=makeSpearMountainScenario(scenario,players,{owner:'白魔術師シェリム'});reject(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:scenario==='spear-dedicated'?'a2-p10-r3c3':'a2-p11-r1c2',dedicated:true});
});
it('Dedicated Spear counters actual level8 Flame despite lower own level and ignores the initial Water Dragon only on return',()=>{
 let s=makeSpearMountainScenario('spear-dedicated',players,{incoming:'炎舞',bonus:2,follower:'水竜'});expect(Object.values(s.groups!)[0]!.technique.effectLevel).toBe(8);const guard=s.players.A!.followers[0]!;reject(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:'a2-p10-r3c3',dedicated:false});s=finish(act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:'a2-p10-r3c3',dedicated:true}));expect([s.players.A!.damage,s.players.B!.damage]).toEqual([7,0]);expect(s.players.A!.followers).toEqual([guard]);
 s=makeSpearMountainScenario('spear-dedicated',players,{root:true,follower:'水竜'});s=finish(act(s,'A',{type:'ATTACK',cardInstanceId:'a2-p10-r3c3',targetIds:['B'],dedicated:true}));expect(s.players.B!.damage).toBe(0);expect(s.players.B!.followers[0]!.revealed).toBe(true);
});
it('Dedicated Spear failed spirit check cannot retry as ordinary and leaves another legal defense',()=>{
 let s=act(makeSpearMountainScenario('spear-dedicated',players),'B',{type:'PLAY_DEFENSE',cardInstanceId:'a2-p10-r3c3',dedicated:true});s=until(s,'before-roll');s=closeWindow(s,[6,6]);s=closeWindow(s);s=passReclaims(s);expect(s.windows!.at(-1)!.kind).toBe('normal-defense');expect(s.rolls!.at(-1)).toMatchObject({purpose:'counter',faces:[6,6],success:false});reject(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:'a2-p10-r3c3',dedicated:false});s=finish(act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:'a2-p05-r3c1',dedicated:false}));expect([s.players.A!.damage,s.players.B!.damage]).toEqual([0,0]);
});
it.each(['spear-ordinary','mountain-ordinary'] as const)('%s equal level cancels and above level refuses the actual incoming Flame',scenario=>{
 const card=scenario==='spear-ordinary'?'a2-p10-r3c3':'a2-p11-r1c2';let s=makeSpearMountainScenario(scenario,players,{incoming:'黒翼飛翔剣'});s=finish(act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:card,dedicated:false}));expect([s.players.A!.damage,s.players.B!.damage]).toEqual([0,0]);s=makeSpearMountainScenario(scenario,players,{incoming:'炎舞'});reject(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:card,dedicated:false});
});
it.each([false,true] as const)('Mountain selected=%s far counter blocks without returning and root attack needs actual approach',dedicated=>{
 let s=makeSpearMountainScenario('mountain-dedicated',players,{near:false});s=finish(act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:'a2-p11-r1c2',dedicated}));expect([s.players.A!.damage,s.players.B!.damage]).toEqual([0,0]);s=makeSpearMountainScenario('mountain-dedicated',players,{root:true,near:false});reject(s,'A',{type:'ATTACK',cardInstanceId:'a2-p11-r1c2',targetIds:['B'],dedicated});s=finish(act(s,'A',{type:'APPROACH',targetId:'B',cardInstanceId:'a2-p24-r1c2'}));s=finish(act(s,'A',{type:'ATTACK',cardInstanceId:'a2-p11-r1c2',targetIds:['B'],dedicated}));expect(s.players.B!.damage).toBe(dedicated?7:4);
});
it.each(['小悪魔','スケルトン'] as const)('Mountain destroys actual initial %s by its printed black or dead attribute before HP reduction',follower=>{
 let s=makeSpearMountainScenario('mountain-ordinary',players,{root:true,follower});const guard=s.players.B!.followers[0]!.cardInstanceId;s=until(act(s,'A',{type:'ATTACK',cardInstanceId:'a2-p11-r1c2',targetIds:['B'],dedicated:false}),'follower-start');s=closeWindow(s);expect(Object.values(s.groups!)[0]!.targets[0]!.followerDefense![0]!.hits[0]!.outcome).toBe('attribute-destroyed');s=finish(s);expect(s.players.B!.damage).toBe(4);expect(s.players.B!.followers).toEqual([]);expect(s.discard.filter(id=>id===guard)).toHaveLength(1);
});
it('Initial Lancelot II uses Mountain dedicated values but retains root usage checks',()=>{
 let s=makeSpearMountainScenario('mountain-dedicated',players,{root:true,owner:'聖騎士ランスロット2'});s=act(s,'A',{type:'ATTACK',cardInstanceId:'a2-p11-r1c2',targetIds:['B'],dedicated:true});const f=Object.values(s.actions!).find(a=>a.cardInstanceId==='a2-p11-r1c2')!;expect(f.checkSpecs).toHaveLength(1);expect(f.technique).toMatchObject({useLevel:5,effectLevel:6,damage:7});s=finish(s);expect(s.players.B!.damage).toBe(7);
});
