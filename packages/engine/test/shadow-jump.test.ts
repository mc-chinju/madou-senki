import type {GameCommand} from '@madou/protocol';
import {expect,it} from 'vitest';
import {getAction} from '@madou/catalog';
import {transition,viewFor,type GameState, discardIds } from '../src/index.js';
import {act,ready,until,finish,pass,closeWindow,readySetup} from './combat-helpers.js';
import {character,handCard,entropy,freshGame} from './fixtures.js';
const JUMP='c2-p06-r2c2-ab01';
function incoming(childName='黒翼飛翔剣',near=true,spirit=20,magic=0){let s=ready();character(s,'B','餓狼ヨーツルム');for(const p of Object.values(s.players))p.permanent={spirit:20,endurance:100};s.players.B!.permanent!.spirit=spirit;s.players.B!.permanent!.magic_level=magic;if(near)s.distances.A!.B=s.distances.B!.A='near';handCard(s,'A',getAction('a2-p12-r3c2')!.name);const attack=handCard(s,'A','踏み込み／弓'),advance=handCard(s,'B','踏み込み／蹴る'),child=handCard(s,'B',childName);handCard(s,'C','命運凶変');handCard(s,'C',getAction('a2-p02-r1c3')!.name);s=until(act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false}),'normal-defense');return {s,advance,child};}
function use(s:GameState){const option=viewFor(s,'B').abilityOptions.find(o=>o.abilityId===JUMP);expect(option).toBeDefined();return act(s,'B',{type:'USE_ABILITY',abilityId:JUMP,targetEventId:option!.targetEventId});}
it.each(['cost','attack','child'] as const)('Shadow jump self-check has no enemy check and defense survives declining %s',choice=>{
 let {s,advance,child}=incoming();s=until(use(s),'shadow-jump-cost');const f=Object.values(s.abilities!)[0]!;expect(f.shadowJump).toMatchObject({stage:'cost-choice',originalAttackerId:'A',targetId:'B',hitIndex:0});expect(s.rolls!.filter(r=>r.purpose==='ability-check').map(r=>r.rollerId)).toHaveLength(1);const paidBefore=[...s.players.B!.hand];
 if(choice!=='cost'){s=act(s,'B',{type:'PAY_SHADOW_JUMP',abilityEventId:f.id,advanceCardInstanceId:advance});s=until(s,'ability-attack');expect(discardIds(s).filter(id=>id===advance)).toHaveLength(1);expect(s.players.B!.hand.length).toBe(paidBefore.length-1);if(choice==='child'){s=until(act(s,'B',{type:'ATTACK',cardInstanceId:child,targetIds:['A'],dedicated:false}),'normal-defense');expect(Object.values(s.actions!).find(a=>a.actorId==='B')!.technique).toMatchObject({followerIgnore:true,maaiProhibited:true});}}
 s=finish(s);expect(s.players.B!.damage).toBe(0);expect(s.players.A!.damage).toBe(choice==='child'?7:0);expect(s.phase).toBe('withdrawal');expect(s.turnSeat).toBe(0);expect(s.distances.A!.B).toBe('near');expect(Object.values(s.distanceMarkers??{})).toEqual([]);expect(s.actions).toEqual({});expect(s.groups).toEqual({});if(choice==='cost')expect(s.players.B!.hand).toEqual(paidBefore);
});
it('Shadow jump cancellation before the self-check leaves the actual incoming hit live',()=>{
 let {s}=incoming();s=use(s);s=act(s,'C',{type:'PLAY_REACTION',cardInstanceId:'a2-p02-r2c3',mode:'cancel-ability',targetAbilityId:viewFor(s,'C').reactionTargetAbilityId!});s=finish(s);expect(s.players.B!.damage).toBe(4);expect(s.rolls?.filter(r=>r.purpose==='ability-check')??[]).toHaveLength(0);
});
it.each([false,true])('Shadow jump failed self-check God reroll=%s uses only the defender roll',reroll=>{
 let {s}=incoming('黒翼飛翔剣',true,0);s=until(use(s),'before-roll');s=closeWindow(s,[6,6]);expect(viewFor(s,'B').currentRoll).toMatchObject({rollerId:'B',modifier:-2,success:false});const rollId=viewFor(s,'B').currentRoll!.rollId;
 if(reroll){while(viewFor(s,'C').activeWindow?.pendingActorId!=='C')s=pass(s);s=act(s,'C',{type:'PLAY_REACTION',cardInstanceId:'a2-p02-r1c3',mode:'reroll',targetRollId:rollId});s=until(s,'shadow-jump-cost');}
 s=finish(s);expect(s.players.B!.damage).toBe(reroll?0:4);expect(s.rolls!.filter(r=>r.purpose==='ability-check').map(r=>r.rollerId)).toEqual(['B']);
});
it('Shadow jump cost rejects stale, foreign and non-advance payment before mutation; repeated payment is refused',()=>{
 let {s,advance,child}=incoming();s=until(use(s),'shadow-jump-cost');const id=Object.values(s.abilities!)[0]!.id;
 for(const [actorId,abilityEventId,advanceCardInstanceId] of [['B','old',advance],['C',id,advance],['B',id,child],['B',id,'a2-p02-r2c3']]){const before=JSON.stringify(s);expect(transition(s,{actorId:actorId!,command:{type:'PAY_SHADOW_JUMP',abilityEventId:abilityEventId!,advanceCardInstanceId:advanceCardInstanceId!}},entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);}
 for(const actor of ['A','C','D']){expect(viewFor(s,actor).shadowJumpCost).toBeNull();expect(viewFor(s,actor).additionalAttackOptions).toEqual([]);}
 s=until(act(s,'B',{type:'PAY_SHADOW_JUMP',abilityEventId:id,advanceCardInstanceId:advance}),'ability-attack');const before=JSON.stringify(s);expect(transition(s,{actorId:'B',command:{type:'PAY_SHADOW_JUMP',abilityEventId:id,advanceCardInstanceId:advance}},entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);s=finish(s);expect(discardIds(s).filter(x=>x===advance)).toHaveLength(1);expect(s.players.B!.damage).toBe(0);
});
it('Shadow jump paid child rejects changed target, far range, required chant and structurally dead original attacker',()=>{
 for(const variant of ['target','far','chant','dead'] as const){let {s,advance,child}=incoming(variant==='chant'?'天地百撃斬':variant==='far'?'踏み込み／殴る':'黒翼飛翔剣',variant!=='far');s=until(use(s),'shadow-jump-cost');const id=Object.values(s.abilities!)[0]!.id;s=until(act(s,'B',{type:'PAY_SHADOW_JUMP',abilityEventId:id,advanceCardInstanceId:advance}),'ability-attack');if(variant==='dead')s.players.A!.presence='dead';const before=JSON.stringify(s);expect(transition(s,{actorId:'B',command:{type:'ATTACK',cardInstanceId:child,targetIds:[variant==='target'?'C':'A'],dedicated:false}},entropy()).ok,variant).toBe(false);expect(JSON.stringify(s)).toBe(before);expect(s.groups![Object.values(s.abilities!)[0]!.shadowJump!.parentGroupId]!.targets[0]!.hits[0]!.defended).toBe(true);}
});
it('Actual cancellation of the paid child never restores the original hit or refunds its advance',()=>{
 let {s,advance,child}=incoming();s=until(use(s),'shadow-jump-cost');s=until(act(s,'B',{type:'PAY_SHADOW_JUMP',abilityEventId:Object.values(s.abilities!)[0]!.id,advanceCardInstanceId:advance}),'ability-attack');s=act(s,'B',{type:'ATTACK',cardInstanceId:child,targetIds:['A'],dedicated:false});s=act(s,'C',{type:'PLAY_REACTION',cardInstanceId:'a2-p02-r2c3',mode:'cancel',targetActionId:Object.values(s.actions!).find(a=>a.actorId==='B')!.id});s=finish(s);expect([s.players.A!.damage,s.players.B!.damage]).toEqual([0,0]);for(const card of [advance,child])expect(discardIds(s).filter(id=>id===card)).toHaveLength(1);expect(s.phase).toBe('withdrawal');
});
it('Actual nested Ice Mirror returns through the paid shadow child and exact defended parent',()=>{
 let {s,advance,child}=incoming('地槍');s=until(use(s),'shadow-jump-cost');const parent=Object.values(s.abilities!)[0]!.shadowJump!.parentGroupId;s=until(act(s,'B',{type:'PAY_SHADOW_JUMP',abilityEventId:Object.values(s.abilities!)[0]!.id,advanceCardInstanceId:advance}),'ability-attack');s=until(act(s,'B',{type:'ATTACK',cardInstanceId:child,targetIds:['A'],dedicated:false}),'normal-defense');const childGroup=viewFor(s,'A').currentAttack!.groupId;s=until(act(s,'A',{type:'PLAY_DEFENSE',cardInstanceId:'a2-p12-r3c2',dedicated:false}),'normal-defense');expect(s.groups![parent]!.targets[0]!.hits[0]!.defended).toBe(true);expect(Object.values(s.actions!).find(a=>a.cardInstanceId==='a2-p12-r3c2')!.resume!.groupId).toBe(childGroup);s=finish(s);expect([s.players.A!.damage,s.players.B!.damage]).toEqual([0,6]);expect(s.actions).toEqual({});expect(s.groups).toEqual({});expect(s.abilities).toEqual({});expect(s.phase).toBe('withdrawal');
});
it('Actual initial follower cannot absorb the shadow child and maai is rejected without payment',()=>{
 let s=freshGame();character(s,'A','侍大将のシン');character(s,'B','餓狼ヨーツルム');for(const p of Object.values(s.players))p.permanent={spirit:20,endurance:100};s.players.B!.permanent!.magic_level=-5;const source=handCard(s,'A','踏み込み／弓'),soldier=handCard(s,'A','兵士'),maai=handCard(s,'A','間合い／休息'),advance=handCard(s,'B','踏み込み／蹴る'),child=handCard(s,'B','地槍');
 for(const actor of s.seatOrder){if(actor==='A')s=act(s,actor,{type:'PLACE_INITIAL_FOLLOWER',cardInstanceId:soldier});s=act(s,actor,{type:'PASS_SETUP'});}s=readySetup(s);s=act(s,'A',{type:'START_TURN'});s=act(s,'A',{type:'CHOOSE_DRAW',draw:false});s=until(act(s,'A',{type:'ATTACK',cardInstanceId:source,targetIds:['B'],dedicated:false}),'normal-defense');s=until(use(s),'shadow-jump-cost');const followers=structuredClone(s.players.A!.followers);s=until(act(s,'B',{type:'PAY_SHADOW_JUMP',abilityEventId:Object.values(s.abilities!)[0]!.id,advanceCardInstanceId:advance}),'ability-attack');s=until(act(s,'B',{type:'ATTACK',cardInstanceId:child,targetIds:['A'],dedicated:false}),'normal-defense');const childAction=Object.values(s.actions!).find(a=>a.actorId==='B')!;
 expect(s.rolls!.filter(r=>r.resume.kind==='action-check'&&r.resume.actionId===childAction.id).length).toBeGreaterThan(0);expect(viewFor(s,'A').legalChoices).not.toContain('PLAY_MAAI');const before=JSON.stringify(s);expect(transition(s,{actorId:'A',command:{type:'PLAY_MAAI',cardInstanceId:maai}},entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);s=finish(s);expect([s.players.A!.damage,s.players.B!.damage]).toEqual([6,0]);expect(s.players.A!.followers).toEqual(followers);expect(s.players.A!.hand).toContain(maai);expect(discardIds(s)).not.toContain(soldier);
});
it.each(['far','chant'] as const)('Shadow jump child keeps ordinary %s eligibility without spending its card',variant=>{
 let {s,advance,child}=incoming(variant==='chant'?'天地百撃斬':'踏み込み／殴る',variant!=='far');
 s=until(use(s),'shadow-jump-cost');
 s=until(act(s,'B',{type:'PAY_SHADOW_JUMP',abilityEventId:Object.values(s.abilities!)[0]!.id,advanceCardInstanceId:advance}),'ability-attack');
 const before=JSON.stringify(s);
 expect(transition(s,{actorId:'B',command:{type:'ATTACK',cardInstanceId:child,targetIds:['A'],dedicated:false}},entropy()).ok).toBe(false);
 expect(JSON.stringify(s)).toBe(before);expect(s.players.B!.hand).toContain(child);
 s=finish(s);expect(s.players.B!.damage).toBe(0);expect(s.players.A!.damage).toBe(0);
 expect(s.players.B!.hand).toContain(child);expect(s.phase).toBe('withdrawal');expect(s.turnSeat).toBe(0);
});
it('Shadow jump paid child rejects approach withdrawal and extra turns while preserving the parent turn',()=>{
 let {s,advance,child}=incoming();s=until(use(s),'shadow-jump-cost');
 s=until(act(s,'B',{type:'PAY_SHADOW_JUMP',abilityEventId:Object.values(s.abilities!)[0]!.id,advanceCardInstanceId:advance}),'ability-attack');
 const distances=structuredClone(s.distances);
 for(const command of [{type:'APPROACH',cardInstanceId:child,targetId:'A'},{type:'WITHDRAW',cardInstanceId:child,targetId:'A'},{type:'START_TURN'},{type:'END_TURN',discardIds:[]}] satisfies GameCommand[]){
  const before=JSON.stringify(s);expect(transition(s,{actorId:'B',command},entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);
 }
 s=finish(act(s,'B',{type:'ATTACK',cardInstanceId:child,targetIds:['A'],dedicated:false}));
 expect(s.players.B!.damage).toBe(0);expect(s.players.A!.damage).toBe(7);
 expect(s.distances).toEqual(distances);expect(Object.values(s.distanceMarkers??{})).toEqual([]);
 expect(s.phase).toBe('withdrawal');expect(s.turnSeat).toBe(0);
 const before=JSON.stringify(s);expect(transition(s,{actorId:'B',command:{type:'START_TURN'}},entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);
});

it.each([[3,4,true],[4,4,false]] as const)('Shadow jump child independently checks excess magic level at %s plus %s success=%s',(x,y,success)=>{
 let {s,advance,child}=incoming('地槍',true,0,-5);s=until(use(s),'shadow-jump-cost');
 s=until(act(s,'B',{type:'PAY_SHADOW_JUMP',abilityEventId:Object.values(s.abilities!)[0]!.id,advanceCardInstanceId:advance}),'ability-attack');
 s=until(act(s,'B',{type:'ATTACK',cardInstanceId:child,targetIds:['A'],dedicated:false}),'before-roll');
 s=closeWindow(s,[x,y]);expect(s.rolls!.at(-1)).toMatchObject({purpose:'excess-level',rollerId:'B',threshold:7,total:x+y,success});
 s=finish(s);expect(s.players.A!.damage).toBe(success?6:0);expect(s.players.B!.damage).toBe(0);
 for(const id of [advance,child])expect(discardIds(s).filter(c=>c===id)).toHaveLength(1);
 expect(s.phase).toBe('withdrawal');expect(s.turnSeat).toBe(0);
});
it.each([[2,3,true],[3,3,false]] as const)('Shadow jump self spirit seven minus two boundary %s plus %s success=%s',(x,y,success)=>{
 let {s}=incoming('黒翼飛翔剣',true,0);s=until(use(s),'before-roll');s=closeWindow(s,[x,y]);
 expect(s.rolls!.at(-1)).toMatchObject({purpose:'ability-check',rollerId:'B',modifier:-2,threshold:5,total:x+y,success});
 s=finish(s);expect(s.players.B!.damage).toBe(success?0:4);expect(s.players.A!.damage).toBe(0);
 expect(s.rolls!.filter(r=>r.purpose==='ability-check')).toHaveLength(1);
});
it('Shadow jump paid child accepts only the original attacker and rejects another live target atomically',()=>{
 let {s,advance,child}=incoming();s=until(use(s),'shadow-jump-cost');
 s=until(act(s,'B',{type:'PAY_SHADOW_JUMP',abilityEventId:Object.values(s.abilities!)[0]!.id,advanceCardInstanceId:advance}),'ability-attack');
 const before=JSON.stringify(s);
 expect(transition(s,{actorId:'B',command:{type:'ATTACK',cardInstanceId:child,targetIds:['C'],dedicated:false}},entropy()).ok).toBe(false);
 expect(JSON.stringify(s)).toBe(before);expect(s.players.B!.hand).toContain(child);
 s=finish(act(s,'B',{type:'ATTACK',cardInstanceId:child,targetIds:['A'],dedicated:false}));
 expect([s.players.A!.damage,s.players.B!.damage,s.players.C!.damage]).toEqual([7,0,0]);
});
