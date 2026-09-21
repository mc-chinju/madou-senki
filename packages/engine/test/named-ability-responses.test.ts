import {describe,expect,it} from 'vitest';
import {transition,viewFor,type GameState, discardIds } from '../src/index.js';
import {act,ready,until,pass,passReclaims,finish,closeWindow} from './combat-helpers.js';
import {character,handCard,entropy} from './fixtures.js';

const SHIN='c2-p01-r2c1-ab05';
const SORROW='c2-p07-r1c1-ab02';
const SHADOW='c2-p04-r2c2-ab01';
const MAJESTY='c2-p05-r2c2-ab02';
function priority(s:GameState,actor:string){
 for(let n=0;n<20;n++){
  const w=s.windows?.at(-1);
  if(w?.participants[w.cursor]===actor)return s;
  s=pass(s);
 }
 throw Error('NO_PRIORITY');
}
function option(s:GameState,actor:string,id:string){return viewFor(s,actor).abilityOptions.find(o=>o.abilityId===id);}
function use(s:GameState,actor:string,id:string){
 const choice=option(s,actor,id);
 expect(choice).toBeDefined();
 expect(choice).not.toHaveProperty('costCardInstanceIds');
 return act(s,actor,{type:'USE_ABILITY',abilityId:id,targetEventId:choice!.targetEventId});
}
function attack(s:GameState){
 const card=handCard(s,'A','白光');
 s=act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false});
 return until(s,'normal-defense');
}
function shadow(shin='A',revealShin=true,revealIda=true){
 let s=ready();
 character(s,'A',shin==='A'?'侍大将のシン':'小人のランバ');
 character(s,'B','忍びのイダ');
 if(shin!=='A')character(s,shin,'侍大将のシン');
 for(const p of Object.values(s.players))p.permanent={endurance:50,spirit:10};
 if(revealShin)s=act(s,shin,{type:'REVEAL_CHARACTER'});
 if(revealIda)s=act(s,'B',{type:'REVEAL_CHARACTER'});
 s=attack(s);
 return use(s,'B',SHADOW);
}
function transformedSource(revealSource=true,responder='A',original=MAJESTY){
 const lia=responder==='A'?'C':'D';
 let s=ready();
 character(s,responder,'聖騎士ランスロット');
 character(s,'B',original===MAJESTY?'魔導王ガイナス':'忍びのイダ');
 character(s,lia,'リーア姫');
 for(const p of Object.values(s.players))p.permanent={endurance:50,spirit:10};
 s=act(s,lia,{type:'REVEAL_CHARACTER'});
 if(s.windows?.length)s=priority(s,responder);
 s=act(s,responder,{type:'USE_LIFECYCLE_ABILITY',ability:'lancelot-transform'});
 s=finish(s);
 expect(s.players[responder]!.characterId).toBe('c2-p07-r1c1');
 expect(s.players[responder]!.abilityCharacterIds).toEqual(['c2-p02-r2c2','c2-p07-r1c1']);
 if(revealSource)s=act(s,'B',{type:'REVEAL_CHARACTER'});
 s=attack(s);
 return use(s,'B',original);
}

describe('Task7t actual named source response declarations',()=>{
 it.each(['A','C'])('revealed Shin %s cancels current revealed Ida before checks and preserves incoming damage',shin=>{
  let s=priority(shadow(shin),shin);
  const sourceId=viewFor(s,shin).reactionTargetAbilityId!;
  const incoming=viewFor(s,shin).currentAttack!.technique;
  expect(option(s,shin,SHIN)?.targetEventId).toBe(sourceId);

  s=use(s,shin,SHIN);
  s=closeWindow(s);
  expect(s.abilities![sourceId]!.canceled).toBe(true);
  s=closeWindow(s);

  expect(s.rolls?.some(r=>r.purpose==='ability-check')).not.toBe(true);
  expect(option(s,'B',SHADOW)).toBeUndefined();
  expect(viewFor(s,'B').currentAttack!.technique).toEqual(incoming);
  s=finish(s);
  expect(s.players.B!.damage).toBe(incoming.damage);
 });
 it('actual transformed LancelotII cancels revealed Majesty against his own attack before reflection',()=>{
  let s=priority(transformedSource(),'A');
  expect(s.players.A!.revealed).toBe(true);
  const sourceId=viewFor(s,'A').reactionTargetAbilityId!;
  const incoming=viewFor(s,'A').currentAttack!.technique;
  expect(option(s,'A',SORROW)?.targetEventId).toBe(sourceId);

  s=use(s,'A',SORROW);
  s=closeWindow(s);
  expect(s.abilities![sourceId]!.canceled).toBe(true);
  s=closeWindow(s);

  expect(s.rolls?.some(r=>r.purpose==='ability-check')).not.toBe(true);
  expect(Object.values(s.groups!)).toHaveLength(1);
  expect(option(s,'B',MAJESTY)).toBeUndefined();
  s=finish(s);
  expect(s.players.A!.damage).toBe(0);
  expect(s.players.B!.damage).toBe(incoming.damage);
 });
});

function reject(s:GameState,actorId:string,command:unknown,code='ABILITY_DISABLED'){
 const before=JSON.stringify(s);
 expect(transition(s,{actorId,command} as any,entropy())).toEqual({ok:false,code});
 expect(JSON.stringify(s)).toBe(before);
}
function cancelResponse(s:GameState,actor:string,id:string){
 const fate=handCard(s,'D','命運凶変');
 s=use(s,actor,id);
 const responseId=viewFor(s,actor).reactionTargetAbilityId!;
 s=priority(s,'D');
 const handCount=s.players.D!.hand.length;
 s=act(s,'D',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel-ability',targetAbilityId:responseId});
 expect(s.players.D!.hand).toHaveLength(handCount);
 s=passReclaims(closeWindow(s));
 expect(s.abilities![responseId]!.canceled).toBe(true);
 expect(discardIds(s)).toContain(fate);
 s=closeWindow(s);
 return s;
}
function nextAttack(s:GameState,card:string){
 s=finish(s);
 if(s.phase==='withdrawal')s=act(s,'A',{type:'PASS_WITHDRAWAL'});
 s=act(s,'A',{type:'END_TURN',discardIds:s.players.A!.hand.filter(id=>id!==card).slice(0,Math.max(0,s.players.A!.hand.length-5))});
 for(const actor of ['B','C','D']){
  s=act(s,actor,{type:'START_TURN'});
  s=act(s,actor,{type:'CHOOSE_DRAW',draw:false});
  s=act(s,actor,{type:'PASS_ACTION'});
  s=act(s,actor,{type:'END_TURN',discardIds:s.players[actor]!.hand.slice(5)});
 }
 s=act(s,'A',{type:'START_TURN'});
 s=act(s,'A',{type:'CHOOSE_DRAW',draw:false});
 s=act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false});
 return until(s,'normal-defense');
}

it.each([[SHIN,SHADOW],[SORROW,MAJESTY]])('actual Fate cancels %s, source resumes saved checks and a later source grants a fresh attempt',(response,original)=>{
 let s=priority(response===SHIN?shadow():transformedSource(),'A');
 const laterCard=handCard(s,'A','衝破');
 const originalId=viewFor(s,'A').reactionTargetAbilityId!;
 const oldCommand={type:'USE_ABILITY',abilityId:response,targetEventId:originalId};
 s=cancelResponse(s,'A',response);
 s=priority(s,'A');
 expect(s.abilities![originalId]!.canceled).toBe(false);
 expect(option(s,'A',response)).toBeUndefined();
 reject(s,'A',oldCommand);

 s=closeWindow(s);
 expect(viewFor(s,'A').currentRoll).toMatchObject({purpose:'ability-check',rollerId:'B'});
 s=closeWindow(s,[1,1]);
 expect(viewFor(s,'A').currentRoll!.success).toBe(true);
 s=closeWindow(s);
 if(response===SHIN){
  expect(viewFor(s,'A').currentRoll).toMatchObject({purpose:'ability-check',rollerId:'A',modifier:-2});
  s=closeWindow(s,[1,1]);
  expect(viewFor(s,'A').currentRoll!.success).toBe(true);
  s=closeWindow(s);
 }else{
  expect(viewFor(s,'A').currentAttack).toMatchObject({attackerId:'B',reflection:{source:'ability',actorId:'B'}});
  s=until(s,'normal-defense');
  expect(s.windows!.at(-1)!.participants).toEqual(['A']);
  const evade=handCard(s,'A','結界');
  s=act(s,'A',{type:'PLAY_DEFENSE',cardInstanceId:evade,dedicated:false});
 }
 s=finish(s);
 expect(s.players.A!.damage).toBe(0);
 expect(s.players.B!.damage).toBe(response===SHIN?6:0);

 s=nextAttack(s,laterCard);
 s=use(s,'B',original);
 s=priority(s,'A');
 const nextId=option(s,'A',response)!.targetEventId;
 expect(nextId).not.toBe(originalId);
 reject(s,'A',oldCommand,'INVALID_TARGET');
 s=use(s,'A',response);
 s=closeWindow(s);
 expect(s.abilities![nextId]!.canceled).toBe(true);
 s=finish(s);
 expect(s.players.B!.damage).toBe(response===SHIN?11:5);
});

it.each([[false,true],[true,false],[false,false]])('actual reveal gates: Shin=%s Ida=%s grants no Mirror option',(shin,ida)=>{
 const s=priority(shadow('A',shin,ida),'A');
 expect(option(s,'A',SHIN)).toBeUndefined();
 expect(s.players.A!.revealed).toBe(shin);
 expect(s.players.B!.revealed).toBe(ida);
});
it('actual hidden Gainas grants no Sorrow option',()=>{
 const s=priority(transformedSource(false),'A');
 expect(option(s,'A',SORROW)).toBeUndefined();
 expect(s.players.B!.revealed).toBe(false);
});
it.each([SHIN,SORROW])('%s wrong/shared target, choices, cost, priority and late source reject atomically',id=>{
 let s=priority(id===SHIN?shadow():transformedSource(),'A');
 const sourceId=viewFor(s,'A').reactionTargetAbilityId!;
 const command={type:'USE_ABILITY',abilityId:id,targetEventId:sourceId};
 reject(s,'C',command);
 reject(s,'A',{...command,targetEventId:'wrong'},'INVALID_TARGET');
 reject(s,'A',{...command,targetEventId:s.windows!.at(-1)!.eventId},'INVALID_TARGET');
 reject(s,'A',{...command,costCardInstanceId:s.players.A!.hand[0]},'INVALID_COMMAND');
 reject(s,'A',{...command,conceal:true},'INVALID_COMMAND');
 reject(s,'A',{...command,abilityEffectIds:['spirit-conversion']},'INVALID_COMMAND');

 s=closeWindow(s);
 expect(option(s,'A',id)).toBeUndefined();
 reject(s,'A',command);
});

it('actual transformed third-party LancelotII cannot cancel Majesty against another attacker',()=>{
 const s=transformedSource(true,'C');
 expect(option(s,'C',SORROW)).toBeUndefined();
 reject(s,'C',{type:'USE_ABILITY',abilityId:SORROW,targetEventId:viewFor(s,'C').reactionTargetAbilityId!});
});
it('actual Shin cannot respond to Majesty and LancelotII cannot respond to Shadow',()=>{
 let s=priority(transformedSource(true,'C'),'A');
 s=act(s,'A',{type:'REVEAL_CHARACTER'});
 s=priority(s,'A');
 expect(option(s,'A',SHIN)).toBeUndefined();

 s=priority(transformedSource(true,'A',SHADOW),'A');
 expect(option(s,'A',SORROW)).toBeUndefined();
});
it.each([SHIN,SORROW])('%s successful response preserves actual Soldier follower processing',id=>{
 let s=priority(id===SHIN?shadow():transformedSource(),'A');
 const soldier=handCard(s,'B','兵士');
 s.players.B!.hand=s.players.B!.hand.filter(card=>card!==soldier);
 s.players.B!.followers.push({cardInstanceId:soldier,revealed:false});
 s=use(s,'A',id);
 s=finish(s);
 expect(s.players.B!.damage).toBe(5);
 expect(discardIds(s)).toContain(soldier);
});
it.each([SHIN,SORROW])('helper: %s hidden responder privacy is owner-only before and during nested Fate',id=>{
 let s=priority(id===SHIN?shadow():transformedSource(),'A');
 s.players.A!.revealed=false;
 if(id===SHIN){
  expect(option(s,'A',SHIN)).toBeUndefined();
  return;
 }
 const sourceId=option(s,'A',SORROW)!.targetEventId;
 s=use(s,'A',SORROW);
 const responseId=viewFor(s,'A').reactionTargetAbilityId!;
 expect(s.abilities![responseId]!.context).toEqual({kind:'ability-response',sourceAbilityId:sourceId});
 expect(viewFor(s,'A').currentAction).toMatchObject({abilityId:SORROW,abilityName:'悲しみを胸に'});
 for(const viewer of ['B','C','D']){
  expect(viewFor(s,viewer).currentAction).toMatchObject({label:'特殊能力'});
  expect(JSON.stringify(viewFor(s,viewer))).not.toContain(SORROW);
  expect(JSON.stringify(viewFor(s,viewer))).not.toContain('悲しみを胸に');
 }
 const fate=handCard(s,'D','命運凶変');
 s=priority(s,'D');
 s=act(s,'D',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel-ability',targetAbilityId:responseId});
 for(const viewer of ['B','C','D'])expect(JSON.stringify(viewFor(s,viewer))).not.toContain(SORROW);
 s=closeWindow(s);
 for(const viewer of ['B','C','D'])expect(JSON.stringify(viewFor(s,viewer))).not.toContain(SORROW);
 s=closeWindow(s);
 expect(s.abilities![sourceId]!.canceled).toBe(false);
});

function suppress(s:GameState,actor:string,change:string){
 if(change==='inactive')s.players[actor]!.presence='dead';
 else if(change==='ownership'){
  character(s,actor,'黒騎士ガーウィン');
  delete s.players[actor]!.abilityCharacterIds;
 }else if(change==='hidden')s.players[actor]!.revealed=false;
 else s.players[actor]!.statuses=[{id:'boundary-probe',kind:change as 'stopped'|'ability-disabled',modifiers:[0],nextCheck:0}];
}
it.each([SHIN,SORROW])('helper: %s stopped/disabled/inactive/foreign ownership rejects without consuming an attempt',id=>{
 const source=priority(id===SHIN?shadow():transformedSource(),'A');
 const command={type:'USE_ABILITY',abilityId:id,targetEventId:option(source,'A',id)!.targetEventId};
 for(const change of ['stopped','ability-disabled','inactive','ownership']){
  const s=structuredClone(source);
  suppress(s,'A',change);
  expect(option(s,'A',id)).toBeUndefined();
  reject(s,'A',command,change==='stopped'?'STOPPED':change==='inactive'?'INACTIVE_ACTOR':'ABILITY_DISABLED');
 }
});
it.each([SHIN,SORROW])('helper: %s rechecks responder status and source public identity while pinned declaration waits',id=>{
 const declared=use(priority(id===SHIN?shadow():transformedSource(),'A'),'A',id);
 const responseId=viewFor(declared,'A').reactionTargetAbilityId!;
 const context=declared.abilities![responseId]!.context;
 if(context.kind!=='ability-response')throw Error('MISSING_PIN');
 for(const [actor,change] of [['A','stopped'],['A','ability-disabled'],['A','inactive'],['A','ownership'],['B','hidden'],['B','ownership'],...(id===SHIN?[['A','hidden']]:[])]){
  let s=structuredClone(declared);
  suppress(s,actor!,change!);
  s=closeWindow(s);
  expect(s.abilities![context.sourceAbilityId]!.canceled).toBe(false);
  expect(s.abilities![responseId]).toBeUndefined();
 }
});
it.each([SHIN,SORROW])('helper: %s committed cancellation survives later responder/source suppression',id=>{
 let s=use(priority(id===SHIN?shadow():transformedSource(),'A'),'A',id);
 const source=Object.values(s.abilities!).find(f=>f.abilityId===(id===SHIN?SHADOW:MAJESTY))!;
 s=closeWindow(s);
 expect(s.abilities![source.id]!.canceled).toBe(true);
 suppress(s,'A','ability-disabled');
 suppress(s,'B','ability-disabled');
 s=finish(s);
 expect(s.players.B!.damage).toBe(6);
 expect(s.rolls?.some(r=>r.purpose==='ability-check')).not.toBe(true);
});

it('actual canceled Mirror resumes both saved Shadow checks and the granted physical child attack',()=>{
 let s=priority(shadow(),'A');
 // Initial numeric/distance arrangement for a legal child; neither source nor roll is manufactured.
 s.players.A!.permanent!.spirit=0;
 s.distances.A!.B=s.distances.B!.A='near';
 const child=handCard(s,'B','踏み込み／殴る');
 const originalId=viewFor(s,'A').reactionTargetAbilityId!;
 s=cancelResponse(s,'A',SHIN);
 s=closeWindow(s);
 expect(viewFor(s,'A').currentRoll).toMatchObject({rollerId:'B',purpose:'ability-check'});
 s=closeWindow(s,[1,1]);
 const selfRoll=s.rolls!.at(-1)!.id;
 expect(viewFor(s,'A').currentRoll!.success).toBe(true);
 s=closeWindow(s);
 expect(viewFor(s,'A').currentRoll).toMatchObject({rollerId:'A',purpose:'ability-check'});
 s=closeWindow(s,[6,6]);
 const enemyRoll=s.rolls!.at(-1)!.id;
 expect(viewFor(s,'A').currentRoll!.success).toBe(false);
 s=closeWindow(s);
 expect(s.windows!.at(-1)!.kind).toBe('ability-attack');
 expect(s.abilities![originalId]!.rollIds).toEqual([selfRoll,enemyRoll]);
 expect(option(s,'A',SHIN)).toBeUndefined();

 s=act(s,'B',{type:'ATTACK',cardInstanceId:child,targetIds:['A'],dedicated:false});
 s=finish(s);
 expect(s.players.B!.damage).toBe(0);
 expect(s.players.A!.damage).toBe(1);
 expect(discardIds(s).filter(card=>card===child)).toHaveLength(1);
});
it.each([SHIN,SORROW])('%s may decline without canceling the source or consuming its own attempt',id=>{
 let s=priority(id===SHIN?shadow():transformedSource(),'A');
 const originalId=option(s,'A',id)!.targetEventId;
 s=closeWindow(s);
 expect(s.abilities![originalId]!.canceled).toBe(false);
 expect(viewFor(s,'A').currentRoll!.purpose).toBe('ability-check');
 expect(s.used).not.toContain(`${originalId}:A:${id}`);
});
it('helper: another revealed Shin retains independent entitlement after first response is Fate-canceled',()=>{
 let s=priority(shadow(),'A');
 character(s,'C','侍大将のシン');
 s.players.C!.revealed=true;
 const sourceId=option(s,'A',SHIN)!.targetEventId;
 const fate=handCard(s,'D','命運凶変');
 s=use(s,'A',SHIN);
 s=priority(s,'C');
 expect(option(s,'C',SHIN)).toBeUndefined();
 reject(s,'C',{type:'USE_ABILITY',abilityId:SHIN,targetEventId:sourceId});
 s=priority(s,'D');
 s=act(s,'D',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel-ability',targetAbilityId:viewFor(s,'D').reactionTargetAbilityId!});
 s=passReclaims(closeWindow(s));
 s=closeWindow(s);
 expect(option(s,'C',SHIN)?.targetEventId).toBe(sourceId);
 s=use(s,'C',SHIN);
 s=closeWindow(s);
 expect(s.abilities![sourceId]!.canceled).toBe(true);
 s=finish(s);
 expect(s.players.B!.damage).toBe(6);
});
it.each(['closed-window','applied-source','canceled-source','wrong-hit'])('helper: pinned response cannot target %s on resume',change=>{
 let s=use(priority(shadow(),'A'),'A',SHIN);
 const responseId=viewFor(s,'A').reactionTargetAbilityId!;
 const source=Object.values(s.abilities!).find(f=>f.abilityId===SHADOW)!;
 if(change==='closed-window')s.windows=s.windows!.filter(w=>!(w.continuation.kind==='ability'&&w.continuation.id===source.id));
 if(change==='applied-source')source.stage='self-check';
 if(change==='canceled-source')source.canceled=true;
 if(change==='wrong-hit'&&source.context.kind==='group')source.context.hitIndex++;
 s=closeWindow(s);
 expect(s.abilities![responseId]).toBeUndefined();
 expect(s.abilities![source.id]!.canceled).toBe(change==='canceled-source');
});
