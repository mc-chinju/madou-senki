import {gameStats} from '../game-stats.js';
import {isConditionalAbility} from './conditional-sources.js';
import {resolveConditionalAbility} from './conditional-selection.js';
import {turnAbilityOptions,resolveTurnPackage} from './turn-information.js';
import {isTurnPackage} from './turn-packages.js';
import {isDeclarationAbility} from './declaration-effects.js';
import {resolveDeclarationAbility} from './declaration-resolution.js';
import {isMentalProtection,mentalProtectionOptions,mentalProtectionAttempt,validMentalProtection,resolveMentalProtection} from './mental-protection.js';
import {isMentalDefense,mentalDefenseOptions,validMentalDefense,mentalDefenseAttempt,resolveMentalDefense} from './mental-defense.js';
import {isNamedResponse,namedResponseOptions,validNamedResponse,resolveNamedResponse} from './named-responses.js';
import {isReceivedDefense,receivedDefenseOptions,validReceivedDefense,receiveAttempt,resolveReceivedDefense} from './received-defense.js';
import {LANCASTER_WIND,windAbilityOptions,validWindAbility,resolveWindAbility} from './attack-properties.js';
import {BEAST_EMPATHY,beastAbilityOptions,validBeastAbility,resolveBeastAbility} from './beast-empathy.js';
import {destructionAbilityOptions,isDestructionAbility,validDestructionAbility,resolveDestructionAbility} from './follower-destruction.js';
import {actionModifierOptions,isValueAbility,validActionModifier,resolveActionModifier} from './action-modifiers.js';
import {followerAbilityOptions,validFollowerAbility,resolveFollowerAbility,LESTER_ILLUSION,qualifiesForSpirit} from './follower-entry.js';
import {ownsAbility} from './ownership.js';
import {currentHit,currentTechnique} from '../reactions/continuations.js';
import {continueFollowerBundle,finishReceivedDefense,resumeDeclarationAction} from '../combat/attack.js';
import {discardBundle} from '../combat/follower-bundles.js';
import {getAction} from '@madou/catalog';
import type {GameState} from '../state.js';
import {canUseCharacterAbility,hasStatus} from '../state.js';
import type {GameInput,TransitionResult} from '../commands.js';
import {isActive} from '../lifecycle/objectives.js';
import {availableLifecycleAbilities,resolveLifecycleAbility} from '../lifecycle/commands.js';
import {openWindow,participants,resetParent} from '../reactions/windows.js';
import {beginRoll} from '../rolls/advance.js';
import {ABILITIES,type AbilityFrame,type AbilityId,type AbilityOption} from './frames.js';
import type {AttackTarget} from '../reactions/continuations.js';
const IDA='c2-p04-r2c2';
export function abilityEventId(s:GameState):string{return s.windows?.at(-1)?.eventId??`turn-${s.turnNumber??0}-${s.seatOrder[s.turnSeat]}-${s.phase}`;}
function lifecycleSource(ability:string):AbilityId|undefined{return (Object.keys(ABILITIES) as AbilityId[]).find(id=>ABILITIES[id].kind===ability);}
function usedKey(eventId:string,actorId:string,id:AbilityId):string{return `${eventId}:${actorId}:${id}`;}
export function availableAbilities(s:GameState,actorId:string):AbilityOption[]{
 const p=s.players[actorId];const w=s.windows?.at(-1);
 if(!p||s.outcome||!isActive(p)||!canUseCharacterAbility(p)||w&&w.participants[w.cursor]!==actorId)return [];
 const eventId=abilityEventId(s);const result:AbilityOption[]=turnAbilityOptions(s,actorId);
 const add=(id:AbilityId,extra:Partial<AbilityOption>={})=>{if(!s.used?.includes(usedKey(eventId,actorId,id)))result.push({abilityId:id,name:ABILITIES[id].name,targetEventId:eventId,...extra});};
 for(const ability of availableLifecycleAbilities(s,actorId)){const id=lifecycleSource(ability);if(id)add(id);}
 followerAbilityOptions(s,actorId,add);
 actionModifierOptions(s,actorId,add);
 destructionAbilityOptions(s,actorId,add);
 beastAbilityOptions(s,actorId,add);
 windAbilityOptions(s,actorId,add);
 receivedDefenseOptions(s,actorId,add);
 mentalDefenseOptions(s,actorId,add);
 result.push(...mentalProtectionOptions(s,actorId));
 result.push(...namedResponseOptions(s,actorId));
 if(!ownsAbility(p,`${IDA}-ab01`))return result;
 if(!w&&s.phase==='action'&&s.seatOrder[s.turnSeat]===actorId){
  const ids=p.hand.filter(id=>getAction(id)?.modes?.some(mode=>mode.playMode==='distance'));
  if(ids.length)add('c2-p04-r2c2-ab04',{costCardInstanceIds:ids,canConceal:p.revealed});
 }
 if(w?.continuation.kind==='group'){
  const g=s.groups?.[w.continuation.id];if(!g)return result;
  const targetId=w.continuation.targetId;const t=g.targets.find(t=>t.actorId===targetId);
  if(w.kind==='normal-defense'&&targetId===actorId&&g.attackerId!==actorId&&isActive(s.players[g.attackerId]!)&&!currentHit(g,actorId)?.defended)add('c2-p04-r2c2-ab01');
  if(!s.actions?.[g.actionId]?.fixedReceivedEffect&&w.kind==='attack-abilities'&&g.attackerId===actorId&&g.technique.attributes.includes('格'))add('c2-p04-r2c2-ab02');
  if(!s.actions?.[g.actionId]?.fixedReceivedEffect&&w.kind==='hit-abilities'&&g.attackerId===actorId&&t?.hits.some(h=>!h.defended&&!!h.abilityBudget&&!h.abilityBudget.closed&&(h.technique??g.technique).school==='warrior')){
   const hit=t?.hits.find(h=>!h.defended&&!!h.abilityBudget&&!h.abilityBudget.closed);
   if(hit&&hit.abilityBudget&&hit.abilityBudget.accepted<hit.abilityBudget.granted)result.push({abilityId:'c2-p04-r2c2-ab03',name:'必殺',targetEventId:eventId});
  }
 }
 return result;
}
export function transitionAbilityCommand(state:GameState,input:GameInput):TransitionResult|undefined{
 const c=input.command;if(c.type!=='USE_ABILITY'&&c.type!=='USE_LIFECYCLE_ABILITY')return;
 const p=state.players[input.actorId]!;if(hasStatus(p,'stopped'))return {ok:false,code:'STOPPED'};if(!canUseCharacterAbility(p))return {ok:false,code:'ABILITY_DISABLED'};
 const id=c.type==='USE_ABILITY'?c.abilityId:lifecycleSource(c.ability);
 const option=availableAbilities(state,p.id).find(option=>option.abilityId===id);
 if(!option)return {ok:false,code:'ABILITY_DISABLED'};
 if(c.type==='USE_ABILITY'&&c.targetId!==undefined)return {ok:false,code:'INVALID_COMMAND'};
 if(c.type==='USE_ABILITY'&&c.targetEventId!==option.targetEventId)return {ok:false,code:'INVALID_TARGET'};
 const cost=c.type==='USE_ABILITY'?c.costCardInstanceId:undefined;const conceal=c.type==='USE_ABILITY'?c.conceal:undefined;
 if(option.costCardInstanceIds){if(!cost||!option.costCardInstanceIds.includes(cost))return {ok:false,code:'CARD_NOT_IN_HAND'};}
 else if(cost!==undefined||conceal!==undefined)return {ok:false,code:'INVALID_COMMAND'};
 const effects=c.type==='USE_ABILITY'?c.abilityEffectIds:undefined;
 if(option.effectOptions){if(!effects?.length||effects.length>3||new Set(effects).size!==effects.length||effects.some(id=>!option.effectOptions!.some(e=>e.id===id)))return {ok:false,code:'INVALID_COMMAND'};}else if(effects!==undefined)return {ok:false,code:'INVALID_COMMAND'};
 if(conceal!==undefined&&option.canConceal===undefined)return {ok:false,code:'INVALID_COMMAND'};
 const s=structuredClone(state);const actor=s.players[p.id]!;const w=s.windows?.at(-1);const abilityId=option.abilityId;const kind=ABILITIES[abilityId].kind;
 const group=w?.continuation.kind==='group'?s.groups![w.continuation.id]:undefined;
 const targetId=w?.continuation.kind==='group'?w.continuation.targetId:null;
 const target=group?.targets.find(t=>t.actorId===targetId);
 const hitIndex=kind==='lethal'?target!.hits.find(h=>!h.defended&&!!h.abilityBudget&&!h.abilityBudget.closed)!.index:group?.hitCursor??0;
 const hit=target?.hits.find(h=>h.index===hitIndex);const ordinal=kind==='lethal'?++hit!.abilityBudget!.accepted:1;
 const frame:AbilityFrame={source:'ability',id:`ability-${s.nextEventId++}`,abilityId,actorId:p.id,eventId:option.targetEventId,parentWindowId:w?.id??null,useOrdinal:ordinal,
  targetIds:kind==='surprise'?[targetId!]:kind==='illusion'?group!.targets.map(t=>t.actorId):(kind==='shadow'||kind==='mental-defense')?[group!.attackerId]:kind==='lethal'?[targetId!]:kind==='martial-bypass'?group!.targets.map(t=>t.actorId):kind==='vanmil-subordinates'?[]:[p.id],
  costs:{...(cost?{cardInstanceId:cost}:{}),ownAction:kind==='conceal-heal'},stage:'declaration',canceled:false,rollIds:[],...(conceal!==undefined?{conceal}:{}),
  ...(effects?{abilityEffectIds:[...effects]}:{}),
  ...(abilityId===LESTER_ILLUSION&&effects?.includes('spirit-conversion')?{spiritSourceHitKeys:group!.targets.flatMap(t=>t.hits.filter(h=>qualifiesForSpirit(s,group!,h,gameStats(s,actor.id).magic_level)).map(h=>`${t.actorId}:${h.index}`))}:{}),
  context:isMentalProtection(abilityId)&&w?.kind==='after-roll'&&w.continuation.kind==='roll'?{kind:'mental-guard',sourceAbilityId:option.targetEventId,rollId:w.continuation.id}:isNamedResponse(abilityId)&&w?.kind==='declaration'?{kind:'ability-response',sourceAbilityId:option.targetEventId}:(kind==='action-value'||abilityId==='c2-p02-r2c2-ab02')&&w?.continuation.kind==='action'?{kind:'action',actionId:w.continuation.id}:w?.kind==='follower-entry-abilities'?{kind:'follower-entry',groupId:group!.id,targetId:targetId!}:group?{kind:'group',groupId:group.id,targetId,hitIndex}:kind==='conceal-heal'?{kind:'own-action'}:{kind:'boundary',triggerId:w?.continuation.id??option.targetEventId}};
 receiveAttempt(s,frame);
 mentalDefenseAttempt(s,frame);
 mentalProtectionAttempt(s,frame);
 (s.abilities??={})[frame.id]=frame;(s.used??=[]).push(usedKey(frame.eventId,p.id,abilityId));
 if(kind==='lancelot-transform')s.used.push(`${p.id}:lancelot-transform`);
 if(kind==='vanmil-subordinates'||kind==='arseil-conspiracy')s.used.push(`${frame.context.kind==='boundary'?frame.context.triggerId:frame.eventId}:${p.id}:${kind}`);
 if(cost){actor.hand.splice(actor.hand.indexOf(cost),1);s.discard.push(cost);if(kind==='conceal-heal')s.phase='hand-adjustment';}
 openWindow(s,'declaration',frame.eventId,{kind:'ability',id:frame.id},w?participants(s,(s.seatOrder.indexOf(p.id)+1)%s.seatOrder.length):participants(s));
 s.revision++;return {ok:true,state:s,events:[]};
}
export function finishAbility(s:GameState,frame:AbilityFrame):void{
 frame.stage='applied';delete s.abilities![frame.id];resetParent(s,frame.parentWindowId);
}
/** Revalidate live source and target restrictions without rechecking consumed attempt limits. */
function validResolution(s:GameState,f:AbilityFrame):boolean{
 const context=f.context;const p=s.players[f.actorId]!;if(!isActive(p)||!canUseCharacterAbility(p)||!ownsAbility(p,f.abilityId))return false;
 if(isNamedResponse(f.abilityId)&&f.context.kind==='ability-response')return validNamedResponse(s,f);
 if(isMentalProtection(f.abilityId))return validMentalProtection(s,f);
 if(isMentalDefense(f.abilityId))return validMentalDefense(s,f);
 if(isReceivedDefense(f.abilityId))return validReceivedDefense(s,f);
 if(isValueAbility(f.abilityId))return validActionModifier(s,f);
 if(isDestructionAbility(f.abilityId))return validDestructionAbility(s,f);
 if(f.abilityId===LANCASTER_WIND)return validWindAbility(s,f);
 if(f.abilityId===BEAST_EMPATHY)return validBeastAbility(s,f);
 const followerValid=validFollowerAbility(s,f);if(followerValid!==undefined)return followerValid;
 const kind=ABILITIES[f.abilityId].kind;
 if(kind==='lancelot-transform')return Object.values(s.players).some(p=>p.characterId==='c2-p03-r1c2'&&p.revealed);
 if(kind==='vanmil-subordinates'||kind==='arseil-conspiracy')return context.kind==='boundary'&&s.lifecycle?.some(t=>t.id===context.triggerId&&t.kind==='boundary'&&t.trigger==='vanmil-awakened')===true;
 if(f.context.kind==='group'){
  const g=s.groups?.[f.context.groupId];if(!g)return false;
  if(kind==='martial-bypass')return g.attackerId===p.id&&g.technique.attributes.includes('格')&&!g.targets.some(t=>t.followerSnapshot!==null);
  const targetId=f.context.targetId;const t=g.targets.find(t=>t.actorId===targetId);const hit=t?.hits.find(h=>h.index===(f.context as Extract<AbilityFrame['context'],{kind:'group'}>).hitIndex);
  if(!t||!hit||!isActive(s.players[t.actorId]!)||!isActive(s.players[g.attackerId]!))return false;
  if(kind==='shadow')return !hit.defended&&!t.followerStarted;
  return !hit.defended&&!t.hitsApplied;
 }
 return true;
}
export function continueAbility(s:GameState,f:AbilityFrame,dice:()=>number,now:number):void{
 if(isConditionalAbility(f.abilityId)){resolveConditionalAbility(s,f);finishAbility(s,f);return;}
 if(isTurnPackage(f.abilityId)){if(resolveTurnPackage(s,f,dice,now))finishAbility(s,f);return;}
 if(isDeclarationAbility(f.abilityId)){
  if(resolveDeclarationAbility(s,f,dice)){
   const actionId=f.context.kind==='action'?f.context.actionId:undefined;
   finishAbility(s,f);
   if(actionId&&s.actions?.[actionId])resumeDeclarationAction(s,s.actions[actionId]!,dice);
  }
  return;
 }

 if(f.followerBundleId){const b=s.followerBundles![f.followerBundleId]!;const valid=!f.canceled&&validResolution(s,f);finishAbility(s,f);if(!valid){discardBundle(s,b);s.phase='withdrawal';return;}b.stage='prepare';continueFollowerBundle(s,b);return;}
 if(f.canceled||!validResolution(s,f)){finishAbility(s,f);return;}
 if(isMentalProtection(f.abilityId)&&f.context.kind!=='ability-response'){resolveMentalProtection(s,f);finishAbility(s,f);finishReceivedDefense(s);return;}
 if(isNamedResponse(f.abilityId)){resolveNamedResponse(s,f);finishAbility(s,f);return;}
 if(isMentalDefense(f.abilityId)){if(resolveMentalDefense(s,f,dice)){finishAbility(s,f);finishReceivedDefense(s);}return;}
 if(isReceivedDefense(f.abilityId)){if(resolveReceivedDefense(s,f,dice)){finishAbility(s,f);finishReceivedDefense(s);}return;}
 if(isValueAbility(f.abilityId)){if(resolveActionModifier(s,f,dice))finishAbility(s,f);return;}
 if(isDestructionAbility(f.abilityId)){resolveDestructionAbility(s,f);finishAbility(s,f);return;}
 if(f.abilityId===LANCASTER_WIND){resolveWindAbility(s,f);finishAbility(s,f);return;}
 if(f.abilityId===BEAST_EMPATHY){resolveBeastAbility(s,f);finishAbility(s,f);return;}
 if(resolveFollowerAbility(s,f)){finishAbility(s,f);return;}
 const kind=ABILITIES[f.abilityId].kind;const latest=s.rolls?.find(r=>r.id===f.rollIds.at(-1));
 const roll=(rollerId:string,check:boolean)=>{const frame=beginRoll(s,{eventId:f.eventId,rollerId,purpose:check?'ability-check':'ability-value',formula:'2d6',...(check?{check:{modifier:-2}}:{}),resume:{kind:'ability',abilityId:f.id}},dice);f.rollIds.push(frame.id);};
 if(kind==='shadow'){
  if(f.stage==='declaration'){f.stage='self-check';roll(f.actorId,true);return;}
  if(f.stage==='self-check'){if(!latest?.success){finishAbility(s,f);return;}f.stage='enemy-check';roll(f.targetIds[0]!,true);return;}
  if(f.stage==='enemy-check'){
   if(latest?.success){finishAbility(s,f);return;}
   if(f.context.kind!=='group')throw Error('INVALID_ABILITY_CONTEXT');
   const g=s.groups![f.context.groupId]!;g.targets.find(t=>t.actorId===f.actorId)!.hits.find(h=>h.index===(f.context as Extract<AbilityFrame['context'],{kind:'group'}>).hitIndex)!.defended=true;
   f.stage='attack-choice';openWindow(s,'ability-attack',f.eventId,{kind:'ability',id:f.id},[f.actorId]);return;
  }
 }
 if(kind==='lethal'){
  if(f.stage==='declaration'){f.stage='numeric';roll(f.actorId,false);return;}
  if(!latest||latest.stage!=='applied'||f.context.kind!=='group')throw Error('INVALID_ABILITY_ROLL');
  const context=f.context;const g=s.groups![context.groupId]!;const t=g.targets.find(t=>t.actorId===context.targetId)!;const hit=t.hits.find(h=>h.index===context.hitIndex)!;
  if(latest.faces[0]===latest.faces[1]){hit.abilityInstantDeath=true;t.pendingInstantDeath='instant-death';}
  else if(Math.abs(latest.faces[0]!-latest.faces[1]!)===1&&hit.damage!==null) {hit.damage*=2;hit.damageMultiplier=(hit.damageMultiplier??1)*2;}
 }else if(kind==='martial-bypass'){
  if(f.context.kind!=='group')throw Error('INVALID_ABILITY_CONTEXT');s.groups![f.context.groupId]!.abilityFollowerIgnore=f.actorId;
 }else if(kind==='conceal-heal'){
  const p=s.players[f.actorId]!;p.damage=Math.max(0,p.damage-2);if(f.conceal)p.revealed=false;
 }else if(kind==='lancelot-transform'||kind==='vanmil-subordinates'||kind==='arseil-conspiracy')resolveLifecycleAbility(s,f.actorId,kind,now);
 finishAbility(s,f);
}
/** A granted budget is stored once per actual hit. Future printed rights may set granted=2. */
export function prepareHitAbilityWindow(s:GameState,groupId:string,target:AttackTarget):boolean{
 const g=s.groups![groupId]!;
 for(const hit of target.hits){
  if(hit.defended||(hit.technique??g.technique).school!=='warrior')continue;
  hit.abilityBudget??={granted:(hit.technique??g.technique).criticalAttempts??1,accepted:0,closed:false};
  if(!hit.abilityBudget.closed){openWindow(s,'hit-abilities',`${g.id}-${target.actorId}-${hit.index}`,{kind:'group',id:g.id,targetId:target.actorId});return false;}
 }
 return true;
}
