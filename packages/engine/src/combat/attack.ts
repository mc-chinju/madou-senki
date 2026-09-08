import {gameStats} from '../game-stats.js';
import {revealCharacter} from '../abilities/character-visibility.js';
import {finishInspection} from '../abilities/private-inspection.js';
import {advanceDeclaration,prepareDeclarationValue} from '../abilities/declaration-resolution.js';
import {evaluateReceivedReservations} from '../abilities/received-defense.js';
import {destructionTargetMultiplier,fixedReflectedTechnique} from '../abilities/follower-destruction.js';
import {acceptActionModifiers,addPrayer,freezeEffectLevel,prepareModifierDamage,freezeDamage} from '../abilities/action-modifiers.js';
import {currentEffectiveTechnique,effectiveHitTechnique} from '../abilities/follower-entry.js';
import {discardBundle,type FollowerBundle} from './follower-bundles.js';
import {currentHit} from '../reactions/continuations.js';
import {validMagicGate,acceptMagicGate} from '../lifecycle/magic-gate.js';
import {canSelectFollowerDedicated} from '../effects/follower-descriptors.js';
import {resolveTechniqueSelection} from './legality.js';
import {freezeRelativeDefenseLimits} from './defense.js';
import {advanceCards,groupDefenseOptions,substitutionHits} from './combination.js';
import {continueAbility,finishAbility} from '../abilities/advance.js';
import {consumeSelfCost,settleLifetimeGroup} from './lifetime.js';
import {validTurnTechniqueTargets,resolveTurnTechnique} from '../lifecycle/turn-techniques.js';
import {resolveLifecycleAction} from '../lifecycle/commands.js';
import {settleDamage,passLifecycle} from '../lifecycle/advance.js';
import {isActive} from '../lifecycle/objectives.js';
import { beginRoll, closeBeforeRoll, throwRoll, unresolvedRoll } from '../rolls/advance.js';
import { applyActionValue, prepareActionValues } from '../rolls/action-values.js';
import { resumeTurnRoll } from '../rolls/turn-continuations.js';
import type { GameInput, EngineErrorCode, TransitionResult } from '../commands.js';
import { completeOwnTurn, hasStatus, hasPendingFatal, type Entropy, type GameState } from '../state.js';
import type { ActionFrame, AttackGroup, ReactionWindow } from '../reactions/continuations.js';
import { techniqueFor } from '../effects/registry.js';
import { appendEvent, EntropyError, randomSource, refillHand } from '../setup.js';
import { getAction, getCharacter } from '@madou/catalog';
import { freezeFollowerSnapshot,resolveFollowerSnapshot } from './followers.js';
import { applyHits } from './hits.js';
import { openWindow, participants, resetParent } from '../reactions/windows.js';
class Rejected extends Error { constructor(readonly code: EngineErrorCode) { super(code); } }
function reject(code: EngineErrorCode): never { throw new Rejected(code); }
function discardAction(s: GameState, action: ActionFrame) {
  if(action.followerBundleId){const b=s.followerBundles![action.followerBundleId]!;if(b.stage==='prepare'){action.bundleFailed=true;b.cursor++;continueFollowerBundle(s,b);return;}discardBundle(s,b);return;}
  if(action.abilityReflection){delete s.actions![action.id];resetParent(s,action.parentWindowId);return;}
  if(action.followerOrigin){delete s.actions![action.id];return;}
  if(action.abilityReturnId){const ability=s.abilities?.[action.abilityReturnId];if(ability){const window=s.windows?.find(w=>w.continuation.kind==='ability'&&w.continuation.id===ability.id);if(window)s.windows=s.windows!.filter(w=>w.id!==window.id);finishAbility(s,ability);}}
  const cost=consumeSelfCost(s,action);if(cost.length)settleDamage(s,cost,s.events.at(-1)?.at??0);
  for(const cardId of [action.cardInstanceId,...(action.coSource?[action.coSource.cardInstanceId]:[])]){const index=s.resolution.indexOf(cardId);if(index>=0){s.resolution.splice(index,1);s.discard.push(cardId);}}
  delete s.actions![action.id]; resetParent(s,action.parentWindowId);
  if(action.grantReturnActionId){const source=s.actions?.[action.grantReturnActionId];if(source){const grantWindow=s.windows?.find(w=>w.continuation.kind==='action'&&w.continuation.id===source.id&&w.kind==='ability-attack');if(grantWindow)s.windows=s.windows!.filter(w=>w.id!==grantWindow.id);finishPrintedGrant(s,source);}}
  for(const id of [...s.reclaimReservations]){const reservation=s.reclaim?.[id];if(reservation?.eventId===action.eventId&&!Object.values(s.actions??{}).some(parent=>parent.eventId===action.eventId)){s.reclaimReservations.splice(s.reclaimReservations.indexOf(id),1);if(isActive(s.players[reservation.ownerId]!))s.players[reservation.ownerId]!.hand.push(id);else s.discard.push(id);delete s.reclaim![id];}}
}
function createGroup(s:GameState,a:ActionFrame):AttackGroup{
  const count=typeof a.technique.hitCount==='number'?a.technique.hitCount:1;const hitIndices=Array.from({length:count},(_,index)=>index);const lineage=a.lineage??[];
  const g:AttackGroup={sourceCardInstanceIds:a.sourceCardInstanceIds??[a.cardInstanceId,...(a.coSource?[a.coSource.cardInstanceId]:[])],sourceDamageRollIds:[...(a.sourceDamageRollIds??[])],id:`g-${s.nextEventId++}`,actionId:a.id,attackerId:a.actorId,technique:structuredClone(a.technique),targets:a.targetIds.map(actorId=>{const characterName=getCharacter(s.players[actorId]!.characterId)?.name;const multiplier=(a.fixedReceivedEffect?1:a.technique.characterDamageMultipliers?.find(entry=>entry.characterNames.includes(characterName??''))?.multiplier??1)*destructionTargetMultiplier(s,a,actorId);const baseDamage=!a.fixedReceivedEffect&&a.modifiers?.targetDamages&&Object.hasOwn(a.modifiers.targetDamages,actorId)?a.modifiers.targetDamages[actorId]!:a.technique.damage;const damage=baseDamage===null?null:baseDamage*multiplier;const effectLevel=!a.fixedReceivedEffect?a.modifiers?.targetEffectLevels?.[actorId]??a.technique.effectLevel:a.technique.effectLevel;const local=effectLevel!==a.technique.effectLevel||baseDamage!==a.technique.damage?{technique:{...structuredClone(a.technique),effectLevel,damage:baseDamage}}:{};return {actorId,followerStarted:false,normalDefenseClosed:false,followerSnapshot:null,hits:hitIndices.map(index=>({index,defended:false,damage,...local,...(a.effectSourceCardInstanceId?{sourceCardInstanceId:a.effectSourceCardInstanceId}:{}),...(a.damageRollId?{damageRollId:a.damageRollId}:{}),hit:false,lineage:[...lineage]}))};}),hitIndices,targetCursor:0,hitCursor:0,stage:'defense',maai:null,...(a.damageRollId?{damageRollId:a.damageRollId}:{})};
  (s.groups??={})[g.id]=g;return g;
}
function resumeDefense(s:GameState,a:ActionFrame):void{
  const resume=a.resume;if(!resume)return;const parent=s.windows?.at(-1);if(resume.preserveWindow){resetParent(s,a.parentWindowId);return;}if(parent?.id===a.parentWindowId)s.windows!.pop();const group=s.groups?.[resume.groupId];if(!group)return;group.targetCursor++;nextDefense(s,group);
}
function finishPrintedGrant(s:GameState,a:ActionFrame):void{
 const group=s.groups?.[a.groupId!];discardAction(s,a);
 if(!group)return;
 if(s.windows?.at(-1)?.id===a.parentWindowId)s.windows.pop();
 group.targetCursor++;nextDefense(s,group);
}
function finishDefense(s:GameState,a:ActionFrame):void{
 const g=s.groups![a.groupId!]!;discardAction(s,a);
 if(a.substitution||!currentHit(g,a.actorId)?.defended){resetParent(s,a.parentWindowId);return;}
 if(s.windows?.at(-1)?.id===a.parentWindowId)s.windows.pop();
 g.targetCursor++;nextDefense(s,g);
}
function activeGroup(s:GameState,w:ReactionWindow):AttackGroup { return s.groups![w.continuation.id]!; }
function reveal(s:GameState,id:string,now:number){revealCharacter(s,id,now);}
function distanceKey(a:string,b:string){return[a,b].sort().join(':');}
function moveToResolution(s:GameState,p:GameState['players'][string],id:string){const index=p.hand.indexOf(id);if(index<0)reject('CARD_NOT_IN_HAND');p.hand.splice(index,1);s.resolution.push(id);}
function finishDistance(s:GameState,a:ActionFrame,success:boolean):void{
  const ids=[...(a.distanceAdvances??[]),...(a.distanceMaais??[])];const key=distanceKey(a.actorId,a.distanceTargetId!);let marker:string|undefined;
  if(a.distanceMode==='approach'&&success)marker=a.distanceAdvances!.at(-1);
  for(const id of ids){const index=s.resolution.indexOf(id);if(index>=0)s.resolution.splice(index,1);if(id!==marker)s.discard.push(id);}
  if(a.distanceMode==='approach'&&success){s.distances[a.actorId]![a.distanceTargetId!]='near';s.distances[a.distanceTargetId!]![a.actorId]='near';(s.distanceMarkers??={})[key]={a:a.actorId,b:a.distanceTargetId!,ownerId:a.actorId,cardInstanceId:marker!};s.phase='action';}
  if(a.distanceMode==='withdrawal'){
    if(success){s.distances[a.actorId]![a.distanceTargetId!]='far';s.distances[a.distanceTargetId!]![a.actorId]='far';const old=s.distanceMarkers?.[key];if(old){s.discard.push(old.cardInstanceId);delete s.distanceMarkers![key];}}
    s.phase='hand-adjustment';
  }
  delete s.actions![a.id];
}
function distanceCard(id:string,mode:'advance'|'distance'){return getAction(id)?.modes?.some(entry=>entry.playMode===mode)??false;}
/** Close only a defended current hit after its cancellable ability has resolved. */
export function finishReceivedDefense(s:GameState):void {
 const w=s.windows?.at(-1);if(w?.kind!=='normal-defense'||w.continuation.kind!=='group')return;
 const g=s.groups?.[w.continuation.id];if(!g||!currentHit(g,w.continuation.targetId!)?.defended)return;
 s.windows!.pop();g.targetCursor++;nextDefense(s,g);
}
function nextDefense(s:GameState,g:AttackGroup){
  if(!g.abilityWindowOpened){g.abilityWindowOpened=true;openWindow(s,'attack-abilities',g.actionId,{kind:'group',id:g.id,targetId:null});return;}
  if(g.stage==='defense'){
    while(g.hitCursor<g.hitIndices.length){
      if(!g.maai)g.maai={hitIndex:g.hitCursor,submissions:{},advances:[]};
      const defenseTargets=g.defenseTargetIds?.[g.hitCursor]?.map(id=>g.targets.find(t=>t.actorId===id)!)??g.targets;
      while(g.targetCursor<defenseTargets.length){const t=defenseTargets[g.targetCursor]!;const h=currentHit(g,t.actorId)!;
        if(h&&isActive(s.players[t.actorId]!)&&!t.normalDefenseClosed&&!h.defended&&!h.passedDefense){openWindow(s,'normal-defense',`${g.id}-${g.hitCursor}`,{kind:'group',id:g.id,targetId:t.actorId},[t.actorId]);return;}g.targetCursor++;
      }
      const canEvade=g.targets.some(target=>{const required=currentEffectiveTechnique(s,g,target.actorId).maaiRequired??1;const hit=currentHit(g,target.actorId)!;const submitted=g.maai!.submissions[target.actorId]?.length??0;return !!hit&&!target.normalDefenseClosed&&!hit.defended&&!hit.passedDefense&&(hit.maaiProgress??0)+submitted>=required;});
      if(canEvade){openWindow(s,'defense-advance',`${g.id}-${g.hitCursor}`,{kind:'group',id:g.id,targetId:null},[g.attackerId]);return;}
      g.maai=null;g.targetCursor=0;g.hitCursor++;
    }
    g.stage='followers';g.targetCursor=0;
  }
  while(g.targetCursor<g.targets.length){const t=g.targets[g.targetCursor]!;if(!isActive(s.players[t.actorId]!)||t.hits.every(hit=>hit.defended)){g.targetCursor++;continue;}if(hasPendingFatal(s,g.attackerId)&&t.followerBypassChoice===undefined)t.followerBypassChoice=false;if(g.technique.optionalFollowerBypassAtOrBelowEffectLevel&&t.followerBypassChoice===undefined&&s.players[t.actorId]!.followers.length){openWindow(s,'follower-bypass-choice',g.actionId,{kind:'group',id:g.id,targetId:t.actorId},[g.attackerId]);return;}if(!t.followerEntryClosed){openWindow(s,'follower-entry-abilities',`${g.id}-${t.actorId}-follower-entry`,{kind:'group',id:g.id,targetId:t.actorId});return;}t.followerStarted=true;freezeFollowerSnapshot(s,g,t);openWindow(s,'follower-start',g.actionId,{kind:'group',id:g.id,targetId:t.actorId},[t.actorId]);return;
  }
  const a=s.actions![g.actionId]!;settleLifetimeGroup(s,g,s.events.at(-1)?.at??0);delete s.groups![g.id];const hadResume=!!a.resume;discardAction(s,a);if(a.followerOrigin){const origin=a.followerOrigin;const parent=s.groups?.[origin.parentGroupId];if(parent)openWindow(s,'follower-start',parent.actionId,{kind:'group',id:parent.id,targetId:origin.targetId},[origin.targetId]);}else if(hadResume)resumeDefense(s,a);else if(!s.windows?.length)s.phase='withdrawal';
}
/** An automatic returned hit is not a second physical card use. */
function startFollowerReflection(s:GameState,g:AttackGroup,t:import('../reactions/continuations.js').AttackTarget):void{
 const reflection=t.pendingFollowerReflection!;delete t.pendingFollowerReflection;
 const hit=t.hits[reflection.hitIndex]!;const parent=s.actions![g.actionId]!;
 if(!isActive(s.players[g.attackerId]!)){openWindow(s,'follower-start',g.actionId,{kind:'group',id:g.id,targetId:t.actorId},[t.actorId]);return;}
 const technique=fixedReflectedTechnique(effectiveHitTechnique(s,g,t,hit),hit.damage);
 const id=`a-${s.nextEventId++}`;
 const a:ActionFrame={id,eventId:parent.eventId,parentWindowId:null,actorId:t.actorId,cardInstanceId:reflection.cardInstanceId,kind:'follower-reflection',fixedReceivedEffect:true,effectSourceCardInstanceId:hit.sourceCardInstanceId??parent.effectSourceCardInstanceId??parent.cardInstanceId,targetIds:[g.attackerId],technique,groupId:null,stage:'resolve',checks:[],roll:null,canceled:false,valuesPrepared:true,selfCostSettled:true,followerOrigin:{...reflection,parentGroupId:g.id,targetId:t.actorId},lineage:[...hit.lineage,reflection.cardInstanceId],sourceCardInstanceIds:hit.sourceCardInstanceId?[hit.sourceCardInstanceId]:[...(g.sourceCardInstanceIds??[parent.cardInstanceId])],sourceDamageRollIds:hit.sourceActionId?[...(s.actions![hit.sourceActionId]?.sourceDamageRollIds??[])]:[...(g.sourceDamageRollIds??[])],...(hit.damageRollId?{damageRollId:hit.damageRollId}:{})};
 (s.actions??={})[id]=a;
 const child=createGroup(s,a);child.abilityWindowOpened=true;child.targets[0]!.hits[0]!.damage=hit.damage;
 nextDefense(s,child);
}
/** A character reflection borrows physical provenance without moving or paying that card. */
export function startAbilityReflection(s:GameState,g:AttackGroup,t:import('../reactions/continuations.js').AttackTarget,hit:import('../reactions/continuations.js').AttackTarget['hits'][number],f:import('../abilities/frames.js').AbilityFrame):void {
 if(!isActive(s.players[g.attackerId]!))return;
 const parent=s.actions![g.actionId]!;
 const source=hit.sourceCardInstanceId??parent.effectSourceCardInstanceId??parent.cardInstanceId;
 const technique=fixedReflectedTechnique(effectiveHitTechnique(s,g,t,hit),hit.damage);
 technique.counter=true;
 const id=`a-${s.nextEventId++}`;
 const action:ActionFrame={id,eventId:parent.eventId,parentWindowId:f.parentWindowId,actorId:t.actorId,cardInstanceId:source,kind:'ability-reflection',abilityReflection:{abilityId:f.abilityId,parentGroupId:g.id,targetId:t.actorId,hitIndex:hit.index},fixedReceivedEffect:true,effectSourceCardInstanceId:source,targetIds:[g.attackerId],technique,groupId:null,stage:'resolve',checks:[],roll:null,canceled:false,valuesPrepared:true,selfCostSettled:true,lineage:[...hit.lineage,f.abilityId],resume:{groupId:g.id,targetId:t.actorId,hitIndex:hit.index},sourceCardInstanceIds:hit.sourceCardInstanceId?[source]:[...(g.sourceCardInstanceIds??[source])],sourceDamageRollIds:hit.sourceActionId?[...(s.actions![hit.sourceActionId]?.sourceDamageRollIds??[])]:[...(g.sourceDamageRollIds??[])],...(hit.damageRollId?{damageRollId:hit.damageRollId}:{})};
 hit.defended=true;
 (s.actions??={})[id]=action;
 const child=createGroup(s,action);child.abilityWindowOpened=true;
 nextDefense(s,child);
}
function resolveDefenseMaai(s:GameState,g:AttackGroup):void{
  const exchange=g.maai;if(!exchange)return;for(const target of g.targets){const hit=currentHit(g,target.actorId)!;if(!hit)continue;const submitted=exchange.submissions[target.actorId]?.length??0;const uncancelled=Math.max(0,submitted-exchange.advances.length);const progress=(hit.maaiProgress??0)+uncancelled;if(progress>=(currentEffectiveTechnique(s,g,target.actorId).maaiRequired??1))hit.defended=true;else if(progress)hit.maaiProgress=progress;}
  g.maai=null;g.targetCursor=0;nextDefense(s,g);
}
export function resumeDeclarationAction(s:GameState,a:ActionFrame,roll:()=>number):void {
  continueAction(s,a,{kind:'declaration'} as ReactionWindow,roll);
}
function continueAction(s:GameState,a:ActionFrame,w:ReactionWindow,roll:()=>number){
  if(a.kind==='lifecycle'){resolveLifecycleAction(s,a,s.events.at(-1)?.at??0);discardAction(s,a);return;}
  if(a.canceled){if(a.kind==='defense'){finishDefense(s,a);return;}const resume=!!a.resume;discardAction(s,a);if(resume)resumeDefense(s,a);else if(!s.windows?.length)s.phase=a.kind==='turn-technique'?'hand-adjustment':'withdrawal';return;}
  if(a.kind==='reaction'&&(w.kind==='declaration'||w.kind==='after-roll')){
    if(a.reactionMode==='effect-plus'&&a.reactionAmount===undefined){beginRoll(s,{eventId:a.eventId,rollerId:a.actorId,purpose:'prayer-addition',formula:'d6',resume:{kind:'prayer',actionId:a.id}},roll);return;}
    const targetRoll=s.rolls?.find(frame=>frame.id===a.targetRollId);
    if(targetRoll&&targetRoll.stage!=='applied'){if(a.reactionMode==='force-fail'){targetRoll.forcedFailure=true;targetRoll.success=false;}else if(a.reactionMode==='reroll'&&targetRoll.stage==='after-roll'){targetRoll.generation++;throwRoll(targetRoll,roll);}if(targetRoll.stage==='after-roll'&&targetRoll.resume.kind==='action-check'){const parent=s.actions?.[targetRoll.resume.actionId];if(parent)parent.roll={dice:[...targetRoll.faces],threshold:targetRoll.threshold!,success:targetRoll.success!};}}
    const ability=s.abilities?.[a.targetAbilityId!];if(a.reactionMode==='cancel-ability'&&ability&&ability.stage==='declaration'&&!ability.canceled)ability.canceled=true;
    const target=s.actions?.[a.targetActionId!];if(target){if(a.reactionMode==='cancel')target.canceled=true;else if(a.reactionMode==='effect-plus')addPrayer(s,target,a.reactionAmount??0);}
    if(a.reactionDedicated&&a.cardInstanceId==='a2-p05-r2c3'){const index=s.resolution.indexOf(a.cardInstanceId);if(index>=0)s.resolution.splice(index,1);s.reclaimReservations.push(a.cardInstanceId);(s.reclaim??={})[a.cardInstanceId]={ownerId:a.actorId,eventId:a.eventId};delete s.actions![a.id];resetParent(s,a.parentWindowId);}else discardAction(s,a);return;
  }
  if(w.kind==='declaration'||w.kind==='after-roll'){
    if(a.declaration&&!a.declaration.committed){
      const result=advanceDeclaration(s,a);
      if(result==='pending')return;
      if(result==='failed'){
        a.canceled=true;
        continueAction(s,a,w,roll);
        return;
      }
    }
    if(a.followerBundleId&&a.technique.effectLevelFormula&&!a.useLevelPrepared){if(!a.effectLevelRollId){a.effectLevelRollId=beginRoll(s,{eventId:a.eventId,rollerId:a.actorId,purpose:'technique-value',formula:'d6',resume:{kind:'action-value',actionId:a.id,value:'effect-level'}},roll).id;return;}a.useLevelPrepared=true;const stats=gameStats(s,a.actorId,{provenance:{kind:'action',id:a.id}});a.checkSpecs=a.technique.noChecks?[]:Array.from({length:Math.max(0,a.technique.useLevel-(a.technique.school==='warrior'?stats.warrior_level:stats.magic_level))},()=>({purpose:'excess-level' as const,modifier:0}));a.checks=a.checkSpecs.map(c=>c.modifier);}
    if(w.kind==='after-roll' && !a.roll!.success){if(a.kind==='defense'){finishDefense(s,a);return;}discardAction(s,a);if(!s.windows?.length)s.phase=a.kind==='turn-technique'?'hand-adjustment':'withdrawal';return;}
    if(a.checks.length){const spec=a.checkSpecs?.shift()??{purpose:'excess-level' as const,modifier:0};a.checks.shift();a.stage='checks';a.checkRollId=beginRoll(s,{eventId:a.eventId,rollerId:a.actorId,purpose:spec.purpose,formula:'2d6',check:{modifier:spec.modifier},resume:{kind:'action-check',actionId:a.id}},roll).id;return;}
    a.stage='effect-level';openWindow(s,'effect-level',a.eventId,{kind:'action',id:a.id});return;
  }
  if(w.kind==='effect-level'){if(a.technique.effectLevelFormula&&!a.effectLevelRollId){a.effectLevelRollId=beginRoll(s,{eventId:a.eventId,rollerId:a.actorId,purpose:'technique-value',formula:'d6',resume:{kind:'action-value',actionId:a.id,value:'effect-level'}},roll).id;return;}if(!prepareDeclarationValue(s,a,'effect',roll))return;freezeEffectLevel(s,a);freezeRelativeDefenseLimits(a.technique);a.stage='damage';openWindow(s,'damage',a.eventId,{kind:'action',id:a.id});return;}
  if(w.kind==='damage'){
    if(a.substitution&&!a.substitution.resolved){
      const saved=s.rolls?.find(r=>r.id===a.substitution!.rollId);
      if(!saved){a.substitution.rollId=beginRoll(s,{eventId:a.eventId,rollerId:a.actorId,purpose:'technique-check',formula:'2d6',check:{modifier:-3},resume:{kind:'technique',actionId:a.id}},roll).id;return;}
      if(saved.stage!=='applied')return;
      if(!saved.success){finishDefense(s,a);return;}
    }
    if(!prepareActionValues(s,a,roll))return;
    if(!prepareModifierDamage(s,a,roll))return;
    if(!prepareDeclarationValue(s,a,'damage',roll))return;
    if(a.technique.optionalDamageDouble){
      if(a.doubleChoice===undefined){openWindow(s,'technique-double-choice',a.eventId,{kind:'action',id:a.id},[a.actorId]);return;}
      if(a.doubleChoice&&!a.doubleApplied){
        const saved=s.rolls?.find(r=>r.id===a.doubleRollId);
        if(!saved){a.doubleRollId=beginRoll(s,{eventId:a.eventId,rollerId:a.actorId,purpose:'technique-check',formula:'2d6',check:{modifier:0},resume:{kind:'technique',actionId:a.id}},roll).id;return;}
        if(saved.stage!=='applied')return;
        if(saved.success)acceptActionModifiers(s,a).printedDamageDouble=true;
        a.doubleApplied=true;
      }
    }
    if(a.technique.randomExtraMaai){
      const saved=s.rolls?.find(r=>r.id===a.extraMaaiRollId);
      if(!saved){a.extraMaaiRollId=beginRoll(s,{eventId:a.eventId,rollerId:a.actorId,purpose:'technique-value',formula:'d6',resume:{kind:'technique',actionId:a.id}},roll).id;return;}
      if(saved.stage!=='applied')return;a.technique.maaiRequired=1+saved.total!;
    }
    freezeDamage(s,a);
    a.stage='resolve';
    if(a.kind==='turn-technique'){resolveTurnTechnique(s,a);discardAction(s,a);s.phase='hand-adjustment';return;}
    if(a.kind==='defense'){
      const g=s.groups![a.groupId!]!;
      if(a.substitution){
        const lineage=new Set<string>([a.cardInstanceId]);
        for(const ref of a.substitution.hits){const target=g.targets.find(t=>t.actorId===ref.targetId);const hit=target?.hits.find(h=>h.index===ref.hitIndex);if(hit){hit.lineage.forEach(id=>lineage.add(id));hit.defended=true;}}
        a.substitution.resolved=true;a.resume={groupId:g.id,targetId:a.actorId,hitIndex:0,preserveWindow:true};a.lineage=[...lineage];
        a.kind='attack';a.targetIds=[g.attackerId];a.groupId=null;a.technique.hitCount=1;nextDefense(s,createGroup(s,a));return;
      }
      const target=g.targets.find(t=>t.actorId===a.actorId)!;const hit=currentHit(g,target.actorId)!;
      if(a.technique.fixedNegate){
        const effect=a.technique.fixedNegate;const shin=effect.shinImmune&&getCharacter(s.players[g.attackerId]!.characterId)?.name==='侍大将のシン';
        if(!shin&&!effect.automatic){
          const saved=s.rolls?.find(r=>r.id===a.fixedDefenseRollId);
          if(!saved){a.fixedDefenseRollId=beginRoll(s,{eventId:a.eventId,rollerId:g.attackerId,purpose:'technique-check',formula:'2d6',check:{modifier:-1},resume:{kind:'technique',actionId:a.id}},roll).id;return;}
          if(saved.stage!=='applied')return;if(!saved.success)hit.defended=true;
        }else if(!shin)hit.defended=true;
        if(hit.defended&&effect.grantAttack){a.printedGrant={source:'card',actorId:a.actorId,targetId:g.attackerId,stage:'choice'};openWindow(s,'ability-attack',a.eventId,{kind:'action',id:a.id},[a.actorId]);return;}
        finishDefense(s,a);return;
      }
      const incomingTechnique=effectiveHitTechnique(s,g,target,hit);const incoming=incomingTechnique.effectLevel;
      if(a.technique.defense==='counter'){
        if(!a.technique.counterIgnoresLevel&&a.technique.effectLevel<incoming){finishDefense(s,a);return;}
        hit.defended=true;
        if((a.technique.counterIgnoresLevel||a.technique.effectLevel>incoming) && (a.technique.range==='far'||a.technique.range==='near'&&s.distances[a.actorId]![g.attackerId]==='near')){if(a.technique.counterReturnFollowerIgnore)a.technique.followerIgnore=true;a.resume={groupId:g.id,targetId:target.actorId,hitIndex:g.hitCursor};}
      } else if(a.technique.defense==='parry') { if(incomingTechnique.school!=='warrior')reject('ILLEGAL_DEFENSE');hit.defended=true; }
      else if(a.technique.defense==='reflect') {
        const limit=incomingTechnique.school==='magic'?a.technique.reflectMagicLimit??-1:a.technique.blockWarriorLimit??-1;if(incomingTechnique.effectLevel>limit)reject('ILLEGAL_DEFENSE');
        hit.defended=true;if(incomingTechnique.school==='magic'){if(hit.lineage.includes(a.cardInstanceId))reject('ALREADY_USED');const incomingAction=s.actions![g.actionId]!;a.effectSourceCardInstanceId=hit.sourceCardInstanceId??incomingAction.effectSourceCardInstanceId??incomingAction.cardInstanceId;a.fixedReceivedEffect=true;a.technique=fixedReflectedTechnique(incomingTechnique,hit.damage);a.sourceCardInstanceIds=hit.sourceCardInstanceId?[hit.sourceCardInstanceId]:[...(g.sourceCardInstanceIds??[])];a.sourceDamageRollIds=hit.sourceActionId?[...(s.actions![hit.sourceActionId]?.sourceDamageRollIds??[])]:[...(g.sourceDamageRollIds??[])];if(hit.damageRollId)a.damageRollId=hit.damageRollId;a.lineage=[...hit.lineage,a.cardInstanceId];a.resume={groupId:g.id,targetId:target.actorId,hitIndex:g.hitCursor};}
      } else hit.defended=true;
      if(a.resume){a.kind='attack';a.targetIds=[g.attackerId];a.groupId=null;a.stage='resolve';nextDefense(s,createGroup(s,a));return;}
      discardAction(s,a);s.windows!.pop();g.targetCursor++;nextDefense(s,g);return;
    }
    if(a.followerBundleId){const b=s.followerBundles![a.followerBundleId]!;b.cursor++;continueFollowerBundle(s,b);return;}
    nextDefense(s,createGroup(s,a));
  }
}
function closeWindow(s:GameState,w:ReactionWindow,roll:()=>number,now:number,random:()=>number){
  if(w.continuation.kind==='inspection'){finishInspection(s,w.continuation.id);return;}
  if(w.kind==='technique-double-choice'&&w.continuation.kind==='action'){const a=s.actions![w.continuation.id]!;a.doubleChoice??=false;continueAction(s,a,{...w,kind:'damage'},roll);return;}
  if(w.kind==='ability-attack'&&w.continuation.kind==='action'){finishPrintedGrant(s,s.actions![w.continuation.id]!);return;}
  if(w.continuation.kind==='ability'){const ability=s.abilities?.[w.continuation.id];if(ability){if(w.kind==='ability-attack')finishAbility(s,ability);else continueAbility(s,ability,roll,now);}return;}
  if(w.continuation.kind==='lifecycle'){passLifecycle(s,w.continuation.id,now);return;}
  if(w.continuation.kind==='roll'){
    const frame=s.rolls!.find(frame=>frame.id===w.continuation.id)!;
    if(frame.stage==='before-roll'){closeBeforeRoll(s,frame,roll);return;}
    if(frame.stage!=='after-roll')throw Error('ROLL_ALREADY_APPLIED');
    frame.stage='applied';const resume=frame.resume;
    if(resume.kind==='technique'){const action=s.actions![resume.actionId]!;continueAction(s,action,{...w,kind:'damage'},roll);}
    else if(resume.kind==='ability'){const ability=s.abilities?.[resume.abilityId];if(ability)continueAbility(s,ability,roll,now);}
    else if(resume.kind==='action-check'){const action=s.actions![resume.actionId]!;action.roll={dice:[...frame.faces],threshold:frame.threshold!,success:frame.success!};continueAction(s,action,{...w,kind:'after-roll'},roll);}
    else if(resume.kind==='action-value'){applyActionValue(s,frame);continueAction(s,s.actions![resume.actionId]!,{...w,kind:resume.value==='declaration-effect'?'effect-level':resume.value==='effect-level'?(s.actions![resume.actionId]!.followerBundleId&&!s.actions![resume.actionId]!.useLevelPrepared?'declaration':'effect-level'):'damage'},roll);}
    else if(resume.kind==='prayer'){const action=s.actions![resume.actionId]!;action.reactionAmount=frame.total!;continueAction(s,action,{...w,kind:'after-roll'},roll);}
    else if(resume.kind==='revival'){}
    else if(resume.kind==='recovery'||resume.kind==='potion')resumeTurnRoll(s,frame,roll,random,now);
    else if(resume.kind==='follower'||resume.kind==='hit')closeWindow(s,{...w,kind:resume.kind==='follower'?'follower-start':'hit',continuation:{kind:'group',id:resume.groupId,targetId:resume.targetId}},roll,now,random);
    else throw Error('INVALID_CONTINUATION');
    return;
  }
  if(w.continuation.kind==='action'){continueAction(s,s.actions![w.continuation.id]!,w,roll);return;}
  const continuation=w.continuation;if(continuation.kind!=='group')throw new Error('INVALID_CONTINUATION');
  const g=activeGroup(s,w);const t=g.targets.find(t=>t.actorId===continuation.targetId)!;
  if(w.kind==='follower-entry-abilities'){t.followerEntryClosed=true;nextDefense(s,g);return;}
  if(w.kind==='attack-abilities'){nextDefense(s,g);return;}
  if(w.kind==='normal-defense'){
    currentHit(g,t.actorId)!.passedDefense=true;g.targetCursor++;nextDefense(s,g);return;
  }
  if(w.kind==='defense-advance'){resolveDefenseMaai(s,g);return;}
  if(w.kind==='follower-bypass-choice'){t.followerBypassChoice=false;nextDefense(s,g);return;}
  if(w.kind==='follower-start'){if(!resolveFollowerSnapshot(s,g,t,roll)){if(t.pendingFollowerReflection)startFollowerReflection(s,g,t);return;}openWindow(s,'hit',g.actionId,{kind:'group',id:g.id,targetId:t.actorId});return;}
  if(w.kind==='lifetime-effect-choice'){t.lifetimeChoice??='decline';}
  if(w.kind==='hit-advance-choice')g.postHitAdvancePaid=true;
  if(w.kind==='hit-abilities'){const hit=t.hits.find(h=>!h.defended&&h.abilityBudget&&!h.abilityBudget.closed);if(hit)hit.abilityBudget!.closed=true;}
  if(w.kind==='hit'||w.kind==='hit-abilities'||w.kind==='hit-advance-choice'||w.kind==='lifetime-effect-choice'){
    if(!applyHits(s,t,g.technique,g.id,now,roll))return;
    if(g.technique.onHitDiscardChants && !hasPendingFatal(s,g.attackerId) && t.hits.some(hit=>hit.hit) && s.players[t.actorId]!.chants.length){
      openWindow(s,'on-hit-choice',g.actionId,{kind:'group',id:g.id,targetId:t.actorId},[g.attackerId]);return;
    }
    g.targetCursor++;nextDefense(s,g);
  }
  if(w.kind==='on-hit-choice'){g.targetCursor++;nextDefense(s,g);}
}
export function transitionCombat(state:GameState,input:GameInput,entropy:Entropy):TransitionResult{
  try{
    randomSource(entropy);let cursor=0;const roll=()=>{const n=entropy.dice[cursor++];if(n===undefined)throw new EntropyError('ENTROPY_EXHAUSTED');return n;};
    const s=structuredClone(state);const start=s.events.length;const c=input.command;const p=s.players[input.actorId]!;const w=s.windows?.at(-1);
    if(c.type==='PLAY_DEFENSE'&&w?.continuation.kind==='group'&&s.groups?.[w.continuation.id]?.targets.some(t=>t.actorId===p.id&&(t.followerStarted||t.normalDefenseClosed||s.groups![w.continuation.id]!.stage==='followers')))reject('DEFENSE_WINDOW_CLOSED');
    if(c.type==='CHOOSE_DAMAGE_DOUBLE'){
      if(!w||w.kind!=='technique-double-choice'||w.continuation.kind!=='action'||w.continuation.id!==c.actionId)reject('WRONG_PHASE');
      if(w.participants[w.cursor]!==p.id)reject('NOT_PRIORITY');
      const action=s.actions![c.actionId]!;action.doubleChoice=c.attempt;s.windows!.pop();continueAction(s,action,{...w,kind:'damage'},roll);
    }else if(c.type==='PAY_HIT_ADVANCES'){
      if(!w||w.kind!=='hit-advance-choice'||w.continuation.kind!=='group'||w.continuation.id!==c.groupId)reject('WRONG_PHASE');
      if(w.participants[w.cursor]!==p.id)reject('NOT_PRIORITY');
      const g=s.groups![c.groupId]!;if(g.postHitAdvancePaid)reject('ALREADY_USED');
      const pool=advanceCards(s,p.id);if(c.cardInstanceIds.some(id=>!pool.includes(id)))reject('CARD_NOT_IN_HAND');
      for(const id of c.cardInstanceIds){p.hand.splice(p.hand.indexOf(id),1);s.discard.push(id);}
      g.postHitAdvancePaid=true;g.postHitAdvanceAmount=c.cardInstanceIds.length*5;
      for(const target of g.targets){if(target.hitsApplied)continue;for(const hit of target.hits){if(!hit.defended&&hit.damage!==null)hit.damage+=g.postHitAdvanceAmount*(hit.damageMultiplier??1);}}
      s.windows!.pop();openWindow(s,'hit',g.actionId,{kind:'group',id:g.id,targetId:w.continuation.targetId});
    }else if(c.type==='CHOOSE_LIFETIME_EFFECT'){
      if(!w||w.kind!=='lifetime-effect-choice'||w.continuation.kind!=='group')reject('WRONG_PHASE');
      if(w.participants[w.cursor]!==p.id)reject('NOT_PRIORITY');
      const group=activeGroup(s,w);const targetId=w.continuation.targetId;const target=group.targets.find(t=>t.actorId===targetId)!;
      target.lifetimeChoice=c.choice;s.windows!.pop();closeWindow(s,w,roll,entropy.now,randomSource(entropy));
    }else if(c.type==='CHOOSE_FOLLOWER_BYPASS'){
      if(!w||w.kind!=='follower-bypass-choice'||w.continuation.kind!=='group')reject('WRONG_PHASE');
      if(w.participants[w.cursor]!==p.id)reject('NOT_PRIORITY');const targetId=w.continuation.targetId;const group=activeGroup(s,w);const target=group.targets.find(target=>target.actorId===targetId)!;
      target.followerBypassChoice=c.ignore;s.windows!.pop();nextDefense(s,group);
    }else if(c.type==='DISCARD_HIT_CHANTS'){
      if(!w||w.kind!=='on-hit-choice'||w.continuation.kind!=='group')reject('WRONG_PHASE');
      if(w.participants[w.cursor]!==p.id)reject('NOT_PRIORITY');
      if(hasPendingFatal(s,p.id))reject('STOPPED');
      const group=activeGroup(s,w);const target=s.players[w.continuation.targetId!]!;
      if(c.discard){s.discard.push(...target.chants.map(chant=>chant.cardInstanceId));target.chants=[];}
      s.windows!.pop();group.targetCursor++;nextDefense(s,group);
    }else if(c.type==='PASS_WITHDRAWAL'){
      if(w||s.phase!=='withdrawal'||s.seatOrder[s.turnSeat]!==p.id)reject('WRONG_PHASE');
      if(hasStatus(p,'stopped')){completeOwnTurn(p,s);s.turnSeat=(s.turnSeat+1)%s.seatOrder.length;s.phase='turn-start';}else s.phase='hand-adjustment';
    }else if(c.type==='PLAY_MAAI'||c.type==='PLAY_ADVANCE'){
      if(!w||w.participants[w.cursor]!==p.id)reject('NOT_PRIORITY');
      if(hasStatus(p,'stopped'))reject('STOPPED');
      if(w.kind==='approach'||w.kind==='withdrawal'){
        if(w.continuation.kind!=='action')reject('WRONG_PHASE');const action=s.actions![w.continuation.id]!;const expected=c.type==='PLAY_MAAI'?'distance':'advance';if(!distanceCard(c.cardInstanceId,expected))reject('UNSUPPORTED_CARD');moveToResolution(s,p,c.cardInstanceId);
        if(c.type==='PLAY_MAAI')(action.distanceMaais??=[]).push(c.cardInstanceId);else(action.distanceAdvances??=[]).push(c.cardInstanceId);
        const other=p.id===action.actorId?action.distanceTargetId!:action.actorId;action.distanceNextActorId=other;w.participants=[other];w.cursor=0;w.passed=[];w.revision++;
      }else if(w.kind==='normal-defense'&&c.type==='PLAY_MAAI'){
        if(w.continuation.kind!=='group')reject('WRONG_PHASE');if(!distanceCard(c.cardInstanceId,'distance'))reject('UNSUPPORTED_CARD');const group=s.groups![w.continuation.id]!;if(currentEffectiveTechnique(s,group,p.id).maaiProhibited)reject('ILLEGAL_DEFENSE');moveToResolution(s,p,c.cardInstanceId);s.resolution.splice(s.resolution.indexOf(c.cardInstanceId),1);s.discard.push(c.cardInstanceId);const submitted=(group.maai!.submissions[p.id]??=[]);submitted.push(c.cardInstanceId);const target=group.targets.find(target=>target.actorId===p.id)!;const required=(currentEffectiveTechnique(s,group,p.id).maaiRequired??1)-(currentHit(group,target.actorId)!.maaiProgress??0);if(submitted.length>=required){s.windows!.pop();group.targetCursor++;nextDefense(s,group);}else{w.passed=[];w.cursor=0;w.revision++;}
      }else if(w.kind==='defense-advance'&&c.type==='PLAY_ADVANCE'){
        if(w.continuation.kind!=='group')reject('WRONG_PHASE');if(!distanceCard(c.cardInstanceId,'advance'))reject('UNSUPPORTED_CARD');const group=s.groups![w.continuation.id]!;moveToResolution(s,p,c.cardInstanceId);s.resolution.splice(s.resolution.indexOf(c.cardInstanceId),1);s.discard.push(c.cardInstanceId);group.maai!.advances.push(c.cardInstanceId);const needed=Math.max(...Object.values(group.maai!.submissions).map(ids=>ids.length));if(group.maai!.advances.length>=needed){s.windows!.pop();resolveDefenseMaai(s,group);}else{w.passed=[];w.cursor=0;w.revision++;}
      }else reject('WRONG_PHASE');
    }else if(c.type==='PLAY_REACTION'){
      if(!w||w.participants[w.cursor]!==p.id)reject('NOT_PRIORITY');
      if(p.statuses?.some(status=>status.kind==='stopped'))reject('STOPPED');
      const action='targetActionId' in c?s.actions?.[c.targetActionId]:undefined;
      const ability='targetAbilityId' in c?s.abilities?.[c.targetAbilityId]:undefined;
      const current=unresolvedRoll(s);const targetRoll='targetRollId' in c?current?.id===c.targetRollId?current:undefined:c.mode==='force-fail'&&current?.resume.kind==='action-check'&&current.resume.actionId===action?.id?current:undefined;
      if(c.mode==='reroll'||c.mode==='force-fail'){if(!targetRoll||c.mode==='force-fail'&&targetRoll.kind!=='check')reject('INVALID_TARGET');}
      else if(c.mode==='cancel-ability'){if(!ability||ability.canceled||ability.stage!=='declaration'||w.kind!=='declaration'||w.continuation.kind!=='ability'||w.continuation.id!==ability.id)reject('INVALID_TARGET');}
      else if(!action||action.canceled||w.continuation.kind!=='action'||w.continuation.id!==action.id)reject('INVALID_TARGET');
      const expected=(c.cardInstanceId==='a2-p02-r1c3'&&c.mode==='reroll'&&w.kind==='after-roll')||(c.cardInstanceId==='a2-p02-r2c3'&&(((c.mode==='cancel'||c.mode==='cancel-ability')&&w.kind==='declaration')||(c.mode==='force-fail'&&(w.kind==='before-roll'||w.kind==='after-roll'))))||(c.cardInstanceId==='a2-p05-r2c3'&&c.mode==='effect-plus'&&w.kind==='effect-level');
      if(!expected)reject('UNSUPPORTED_CARD');if(!p.hand.includes(c.cardInstanceId))reject('CARD_NOT_IN_HAND');
      const dedicated='dedicated' in c&&!!c.dedicated;if(dedicated&&(c.cardInstanceId!=='a2-p05-r2c3'||getCharacter(p.characterId)?.name!=='リーア姫'))reject('UNSUPPORTED_CARD');if(c.cardInstanceId==='a2-p05-r2c3'&&!dedicated&&action!.actorId!==p.id)reject('INVALID_TARGET');
      const eventId=targetRoll?.eventId??ability?.eventId??action!.eventId;const key=`${eventId}:${p.id}:${c.cardInstanceId}`;if(s.used?.includes(key))reject('ALREADY_USED');(s.used??=[]).push(key);
      p.hand.splice(p.hand.indexOf(c.cardInstanceId),1);s.resolution.push(c.cardInstanceId);
      const id=`a-${s.nextEventId++}`;const base=techniqueFor('a2-p05-r3c1')!;const reaction:ActionFrame={id,eventId,parentWindowId:w.id,actorId:p.id,cardInstanceId:c.cardInstanceId,kind:'reaction',targetIds:[],technique:base,groupId:null,stage:'declaration',checks:[],roll:null,canceled:false,reactionMode:c.mode,...(action?{targetActionId:action.id}:{}),...(ability?{targetAbilityId:ability.id}:{}),...(targetRoll?{targetRollId:targetRoll.id}:{}),...(dedicated?{reactionDedicated:true}:{})};
      (s.actions??={})[id]=reaction;if(c.mode!=='effect-plus'||dedicated){(s.lifecycle??=[]).push({kind:'declaration',id:`declare-${id}`,actionId:id});refillHand(s,p,p.hand.length+1,randomSource(entropy),entropy.now);}else openWindow(s,'declaration',eventId,{kind:'action',id},participants(s,(s.seatOrder.indexOf(p.id)+1)%s.seatOrder.length));
    }else if(c.type==='CANCEL_REACTION'){
      if(hasStatus(p,'stopped'))reject('STOPPED');
      if(!w||w.kind!=='declaration'||w.participants[w.cursor]!==p.id)reject('NOT_PRIORITY');const action=s.actions?.[c.targetActionId];if(!action||w.continuation.kind!=='action'||w.continuation.id!==action.id||action.kind!=='reaction'||action.cardInstanceId!=='a2-p02-r2c3')reject('INVALID_TARGET');
      if(getCharacter(p.characterId)?.name!=='占星術師のアルセイル'||!p.revealed)reject('UNSUPPORTED_CARD');const key=`${action.id}:${p.id}:printed:cancel-fate`;if(s.used?.includes(key))reject('ALREADY_USED');(s.used??=[]).push(key);action.canceled=true;w.passed=[];w.cursor=0;w.revision++;
    }else if(c.type==='REVEAL_CHARACTER'){
      if(p.revealed)reject('ALREADY_REVEALED');reveal(s,p.id,entropy.now);
      if(w)resetParent(s,w.id);
    }else if(c.type==='PASS'){
      if(!w)reject('WRONG_PHASE');if(w.participants[w.cursor]!==p.id)reject('NOT_PRIORITY');
      if(w.kind==='approach'||w.kind==='withdrawal') {if(w.continuation.kind!=='action')reject('WRONG_PHASE');const action=s.actions![w.continuation.id]!;s.windows!.pop();const success=p.id===action.distanceTargetId;finishDistance(s,action,success);}
      else {
      w.passed.push(p.id);w.cursor++;w.revision++;
      if(w.cursor===w.participants.length){s.windows!.pop();closeWindow(s,w,roll,entropy.now,randomSource(entropy));}
      }
    }else if(c.type==='START_FOLLOWERS'){
      if(!w||w.kind!=='normal-defense')reject('WRONG_PHASE');if(w.participants[w.cursor]!==p.id)reject('NOT_PRIORITY');
      const continuation=w.continuation;if(continuation.kind!=='group')reject('WRONG_PHASE');const group=s.groups![continuation.id]!;const target=group.targets.find(t=>t.actorId===p.id)!;
      const dedicated=c.dedicatedCardInstanceIds??[];if(dedicated.some(id=>!p.followers.some(f=>f.cardInstanceId===id)||!canSelectFollowerDedicated(id,p.characterId)))reject('FOLLOWER_RESTRICTED');target.dedicatedCardInstanceIds=[...dedicated];target.normalDefenseClosed=true;
      s.windows!.pop();group.targetCursor++;nextDefense(s,group);
    }else if(c.type==='APPROACH'||c.type==='WITHDRAW'){
      if(w)reject('WRONG_PHASE');if(s.seatOrder[s.turnSeat]!==p.id)reject('NOT_YOUR_TURN');if(hasStatus(p,'stopped'))reject('STOPPED');if(!Object.hasOwn(s.players,c.targetId)||!isActive(s.players[c.targetId]!)||c.targetId===p.id)reject('INVALID_TARGET');
      (s.distanceMarkers??={});
      if(c.type==='APPROACH'){if(s.phase!=='action')reject('WRONG_PHASE');if(s.distances[p.id]![c.targetId]!=='far'||!distanceCard(c.cardInstanceId,'advance'))reject('OUT_OF_RANGE');}
      else {if(s.phase!=='withdrawal')reject('WRONG_PHASE');if(s.distances[p.id]![c.targetId]!=='near'||!distanceCard(c.cardInstanceId,'distance'))reject('OUT_OF_RANGE');}
      moveToResolution(s,p,c.cardInstanceId);const id=`a-${s.nextEventId++}`;const mode=c.type==='APPROACH'?'approach':'withdrawal';const action:ActionFrame={id,eventId:id,parentWindowId:null,actorId:p.id,cardInstanceId:c.cardInstanceId,kind:'distance',targetIds:[c.targetId],technique:techniqueFor('a2-p05-r3c1')!,groupId:null,stage:'declaration',checks:[],roll:null,canceled:false,distanceMode:mode,distanceTargetId:c.targetId,distanceNextActorId:c.targetId,distanceAdvances:c.type==='APPROACH'?[c.cardInstanceId]:[],distanceMaais:c.type==='WITHDRAW'?[c.cardInstanceId]:[]};(s.actions??={})[id]=action;s.phase=c.type==='APPROACH'?'combat':'withdrawal';openWindow(s,mode,id,{kind:'action',id},[c.targetId]);
    }else if(c.type==='ATTACK'||c.type==='PLAY_DEFENSE'||c.type==='PLAY_GROUP_DEFENSE'||c.type==='PLAY_TURN_TECHNIQUE'){
      if(p.statuses?.some(x=>x.kind==='stopped'))reject('STOPPED');
      const groupMode=c.type==='PLAY_GROUP_DEFENSE';
      const printedGranted=c.type==='ATTACK'&&w?.kind==='ability-attack'&&w.continuation.kind==='action'?s.actions?.[w.continuation.id]:undefined;
      if(printedGranted){if(w!.participants[w!.cursor]!==p.id||printedGranted.printedGrant?.actorId!==p.id||printedGranted.printedGrant.stage!=='choice')reject('NOT_PRIORITY');if(c.type==='ATTACK'&&(c.targetIds.length!==1||c.targetIds[0]!==printedGranted.printedGrant.targetId))reject('INVALID_TARGET');}
      const granted=c.type==='ATTACK'&&w?.kind==='ability-attack'&&w.continuation.kind==='ability'?s.abilities?.[w.continuation.id]:undefined;
      if(granted){if(w!.participants[w!.cursor]!==p.id||granted.actorId!==p.id||granted.stage!=='attack-choice')reject('NOT_PRIORITY');if(c.type==='ATTACK'&&(c.targetIds.length!==1||c.targetIds[0]!==granted.targetIds[0]))reject('INVALID_TARGET');}
      if(c.type!=='PLAY_DEFENSE'&&!groupMode&&!granted&&!printedGranted){if(s.phase!=='action'||w)reject('WRONG_PHASE');if(s.seatOrder[s.turnSeat]!==p.id)reject('NOT_YOUR_TURN');}
      else if(c.type==='PLAY_DEFENSE'){if(!w||w.kind!=='normal-defense')reject('WRONG_PHASE');if(w.participants[w.cursor]!==p.id)reject('NOT_PRIORITY');}
      if(groupMode&&!groupDefenseOptions(s,p.id).some(o=>o.cardInstanceId===c.cardInstanceId&&o.groupId===c.groupId))reject('ILLEGAL_DEFENSE');
      const group=groupMode?s.groups![c.groupId]!:c.type==='PLAY_DEFENSE'?activeGroup(s,w!):null;
      const selection=resolveTechniqueSelection(s,p.id,{
        cardInstanceId:c.cardInstanceId,dedicated:c.dedicated,
        ...(c.declarationAbilityIds?{declarationAbilityIds:c.declarationAbilityIds}:{}),
        ...(c.type==='ATTACK'&&c.techniqueVariant?{techniqueVariant:c.techniqueVariant}:{}),
        ...((c.type==='ATTACK'||c.type==='PLAY_DEFENSE')&&c.coSource?{coSource:c.coSource}:{}),
      },c.type==='ATTACK'?{kind:'attack',targetIds:c.targetIds,...(c.advanceCardInstanceIds?{advanceCardInstanceIds:c.advanceCardInstanceIds}:{})}
        :c.type==='PLAY_DEFENSE'?{kind:'defense',group:group!}
        :groupMode?{kind:'group-defense',group:group!}:{kind:'turn-technique'});
      if(!selection.ok)reject(selection.code);
      const {coSource,fromHand,fromFollowers}=selection;
      const technique=selection.declarationBase??selection.technique;
      const chant=selection.fromChant;
      const advanceCosts=c.type==='ATTACK'?c.advanceCardInstanceIds:undefined;
      const targetIds=c.type==='ATTACK'||c.type==='PLAY_TURN_TECHNIQUE'?c.targetIds:[group!.attackerId];
      if(c.type==='PLAY_TURN_TECHNIQUE'&&!validTurnTechniqueTargets(s,p.id,technique,targetIds,c.convertTargetIds??[]))reject('INVALID_TARGET');
      if(c.type==='PLAY_TURN_TECHNIQUE'){
        if(technique.turnEffect==='magic-gate'){if(!c.followerTransfer||!validMagicGate(s,p.id,targetIds[0]!,c.followerTransfer))reject('INVALID_TARGET');}
        else if(c.followerTransfer)reject('UNSUPPORTED_CARD');
      }
      const followerTransfer=c.type==='PLAY_TURN_TECHNIQUE'&&c.followerTransfer?acceptMagicGate(s,p.id,targetIds[0]!,c.followerTransfer):undefined;
      const id=`a-${s.nextEventId++}`;const eventId=printedGranted?`${printedGranted.id}-attack`:granted?`${granted.id}-attack`:group?`${group.id}-${p.id}-0`:id;const key=`${eventId}:${p.id}:${c.cardInstanceId}`;
      if(s.used?.includes(key))reject('ALREADY_USED');(s.used??=[]).push(key);
      if(coSource){s.used.push(`${eventId}:${p.id}:${coSource.cardInstanceId}`);if(coSource.fromFollowers)p.followers=p.followers.filter(f=>f.cardInstanceId!==coSource.cardInstanceId);else if(coSource.fromChant)p.chants=p.chants.filter(ch=>ch.cardInstanceId!==coSource.cardInstanceId);else p.hand.splice(p.hand.indexOf(coSource.cardInstanceId),1);s.resolution.push(coSource.cardInstanceId);}
      for(const cost of advanceCosts??[]){p.hand.splice(p.hand.indexOf(cost),1);s.discard.push(cost);}
      if(fromFollowers)p.followers=p.followers.filter(f=>f.cardInstanceId!==c.cardInstanceId);else if(fromHand)p.hand.splice(p.hand.indexOf(c.cardInstanceId),1);else p.chants=p.chants.filter(x=>x.cardInstanceId!==c.cardInstanceId);s.resolution.push(c.cardInstanceId);
      const noChecks=technique.noChecks||(c.type==='PLAY_DEFENSE'&&technique.counterNoChecks);const stats=gameStats(s,p.id);
      const checkSpecs:NonNullable<ActionFrame['checkSpecs']>=noChecks?[]:Array.from({length:Math.max(0,technique.useLevel-(technique.school==='warrior'?stats.warrior_level:stats.magic_level))},()=>({purpose:'excess-level' as const,modifier:0}));
      if((!noChecks||!!coSource)&&technique.activationCheckModifier!==undefined)checkSpecs.unshift({purpose:'activation',modifier:technique.activationCheckModifier});
      if(!noChecks&&technique.defense==='teleport')checkSpecs.push({purpose:'teleport',modifier:0});
      if(c.type==='PLAY_DEFENSE'&&technique.counterCheck&&!technique.counterNoChecks)checkSpecs.push({purpose:'counter',modifier:0});
      const checks=checkSpecs.map(check=>check.modifier);
      const action:ActionFrame={sourceZone:fromFollowers?'followers':fromHand?'hand':'chant',...(followerTransfer?{followerTransfer}:{}),...(coSource?{coSource,fromChant:coSource.fromChant}:{}),...(advanceCosts?{advanceCosts}:{}),...(groupMode?{substitution:{groupId:group!.id,hits:substitutionHits(group!,p.id)}}:{}),...(printedGranted?{grantReturnActionId:printedGranted.id}:{}),id,eventId,parentWindowId:w?.id??null,actorId:p.id,cardInstanceId:c.cardInstanceId,kind:c.type==='ATTACK'?'attack':c.type==='PLAY_TURN_TECHNIQUE'?'turn-technique':'defense',...(c.type==='PLAY_TURN_TECHNIQUE'?{convertTargetIds:c.convertTargetIds??[]}:{}),targetIds:[...targetIds],technique,groupId:group?.id??null,stage:'declaration',checks,checkSpecs,roll:null,canceled:false,...(coSource?{fromChant:coSource.fromChant}:chant?{fromChant:true}:{}),...(granted?{abilityReturnId:granted.id}:{})};
      if(c.declarationAbilityIds?.length)action.declaration={base:structuredClone(technique),kind:c.type==='ATTACK'?'attack':c.type==='PLAY_TURN_TECHNIQUE'?'turn-technique':groupMode?'group-defense':'defense',committed:false,queue:[...c.declarationAbilityIds].sort().map(abilityId=>({abilityId:abilityId as import('../abilities/declaration-effects.js').DeclarationAbilityId,status:'pending'}))};
      acceptActionModifiers(s,action);
      if(granted)granted.stage='child-attack';
      if(printedGranted)printedGranted.printedGrant!.stage='child';
      (s.actions??={})[id]=action;s.phase='combat';
      openWindow(s,'declaration',eventId,{kind:'action',id},w?participants(s,(s.seatOrder.indexOf(p.id)+1)%s.seatOrder.length):participants(s));
    }else reject('WRONG_PHASE');
    s.revision++;return{ok:true,state:s,events:structuredClone(s.events.slice(start))};
  }catch(e){if(e instanceof Rejected)return{ok:false,code:e.code};if(e instanceof EntropyError)return{ok:false,code:'INVALID_ENTROPY'};throw e;}
}

/** Inactive seats cannot strand an accepted parent or create an undefined priority actor. */
export function drainEmptyWindows(s:GameState,dice:()=>number,random:()=>number,now:number):void{
 for(let count=0;count<1000;count++){
  const w=s.windows?.at(-1);if(!w)return;
  if(w.kind==='normal-defense'&&w.continuation.kind==='group'){
   const c=w.continuation,g=s.groups?.[c.id],t=g?.targets.find(t=>t.actorId===c.targetId);
   const hit=g&&t&&currentHit(g,t.actorId);
   if(g&&t&&hit){evaluateReceivedReservations(s,g,t,hit);if(hit.defended){finishReceivedDefense(s);continue;}}
  }
  if(!['death-gift','revival'].includes(w.kind)){
   const pending=w.participants[w.cursor];const remaining=w.participants.slice(w.cursor).filter(id=>isActive(s.players[id]!));
   const passed=w.participants.slice(0,w.cursor).filter(id=>isActive(s.players[id]!));
   w.participants=[...passed,...remaining];w.cursor=passed.length;
  }
  if(w.cursor<w.participants.length)return;
  s.windows!.pop();closeWindow(s,w,dice,now,random);
 }
 throw Error('EMPTY_WINDOWS_DID_NOT_CONVERGE');
}

/** Saved card continuations all finish before one normal-defense group is constructed. */
export function continueFollowerBundle(s:GameState,b:FollowerBundle):void{
 const next=s.actions![b.actionIds[b.cursor]??''];
 if(next){openWindow(s,'declaration',next.eventId,{kind:'action',id:next.id});return;}
 const sources=b.actionIds.map(id=>s.actions![id]!).filter(a=>!a.bundleFailed);
 if(!sources.length){discardBundle(s,b);s.phase='withdrawal';return;}
 b.stage='defense';const first=sources[0]!;const g=createGroup(s,first);g.followerBundleId=b.id;g.targets=[];g.hitIndices=[];g.defenseTargetIds=[];g.sourceCardInstanceIds=sources.map(a=>a.cardInstanceId);g.sourceDamageRollIds=sources.flatMap(a=>a.sourceDamageRollIds??[]);
 let slot=0;
 for(const a of sources){const count=typeof a.technique.hitCount==='number'?a.technique.hitCount:1;
  for(let hit=0;hit<count;hit++,slot++){g.hitIndices.push(slot);g.defenseTargetIds.push([...a.targetIds]);for(const actorId of a.targetIds){let t=g.targets.find(t=>t.actorId===actorId);if(!t){t={actorId,followerStarted:false,normalDefenseClosed:false,followerSnapshot:null,hits:[]};g.targets.push(t);}t.hits.push({index:slot,sourceActionId:a.id,sourceCardInstanceId:a.cardInstanceId,technique:structuredClone(a.technique),defended:false,damage:a.technique.damage,...(a.damageRollId?{damageRollId:a.damageRollId}:{}),hit:false,lineage:[]});}}
 }
 nextDefense(s,g);
}
