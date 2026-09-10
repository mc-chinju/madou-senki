import {physicalEffectCard,effectProvenance} from './action-source.js';
import {commitMentalStopPrevention} from '../abilities/mental-protection.js';
import {hasPendingFatal} from '../state.js';
import {saveBeastCapture} from '../abilities/beast-empathy.js';
import type {GameState} from '../state.js';
import type {ActionFrame,AttackGroup,AttackTarget} from '../reactions/continuations.js';
import type {DamageIntent} from '../lifecycle/types.js';
import {settleDamage,clearDistances} from '../lifecycle/advance.js';
import {isActive} from '../lifecycle/objectives.js';
import {openWindow} from '../reactions/windows.js';
import {beginRoll} from '../rolls/advance.js';
export type LifetimeDecisionKind='instant-death'|'fixed-stop'|'otherworld-modifier'|'soul-drain';
export function lifetimeDecisionKind(group:AttackGroup):LifetimeDecisionKind{
 const kind=group.technique.lifetimeHit!.kind;return kind==='otherworld'?'otherworld-modifier':kind as LifetimeDecisionKind;
}
/** Selected on-hit additions wait in actor-private, JSON-persisted windows. */
export function prepareLifetimeHit(s:GameState,g:AttackGroup,t:AttackTarget,dice:()=>number):boolean{
 const effect=g.technique.lifetimeHit;if(!effect)return true;
 const action=s.actions![g.actionId]!;
 const choose=()=>{if(t.lifetimeChoice===undefined&&hasPendingFatal(s,g.attackerId))t.lifetimeChoice='decline';if(t.lifetimeChoice!==undefined)return true;openWindow(s,'lifetime-effect-choice',action.eventId,{kind:'group',id:g.id,targetId:t.actorId},[g.attackerId]);return false;};
 if(effect.optional&&effect.kind!=='soul-drain'&&!choose())return false;
 if(effect.kind==='fixed-stop'){
  if(t.lifetimeChoice==='decline')return true;
  let frame=s.rolls?.find(r=>r.id===g.durationRollId);
  if(!frame){frame=beginRoll(s,{eventId:action.eventId,rollerId:g.attackerId,purpose:'stop-duration',formula:'d6',resume:{kind:'hit',groupId:g.id,targetId:t.actorId}},dice);g.durationRollId=frame.id;return false;}
  if(frame.stage!=='applied')return false;
  t.pendingFixedStop=frame.total!;return true;
 }
 if(effect.kind==='instant-death'&&t.lifetimeChoice==='decline')return true;
 let frame=s.rolls?.find(r=>r.id===t.resistanceRollId);
 if(!frame){frame=beginRoll(s,{eventId:action.eventId,rollerId:t.actorId,purpose:'status-resistance',formula:'2d6',check:{modifier:effect.kind==='otherworld'&&t.lifetimeChoice==='apply'?-3:effect.modifier},resume:{kind:'hit',groupId:g.id,targetId:t.actorId}},dice);t.resistanceRollId=frame.id;return false;}
 if(frame.stage!=='applied')return false;
 if(frame.success)return true;
 if(effect.kind==='soul-drain'){
  if(effect.optional&&!choose())return false;
  if(t.lifetimeChoice==='apply')t.pendingInstantDeath='instant-death';else if(!t.pendingStatDrain){
   t.pendingStatDrain=true;
   (s.players[t.actorId]!.statuses??=[]).push({id:`${g.id}:${t.actorId}:lifetime`,kind:'stat-drain',timing:'until-death',amount:1,sourceActorId:action.actorId,sourceCardInstanceId:physicalEffectCard(action),targetId:t.actorId});
  }
 }else if(effect.kind==='otherworld')t.pendingOtherworld=true;
 else if(effect.kind==='deadly-stop')t.pendingDeadlyStop=effect.modifier;
 else t.pendingInstantDeath=effect.kind;
 return true;
}
/** The declaration cost is independent, so every failure path consumes it once. */
export function consumeSelfCost(s:GameState,a:ActionFrame):DamageIntent[]{
 if(a.substituteOrigin||a.followerOrigin||!a.technique.selfCost||a.selfCostSettled)return [];
 a.selfCostSettled=true;const p=s.players[a.actorId]!;
 s.discard.push(...p.followers.map(f=>f.cardInstanceId));p.followers=[];
 if(a.technique.selfCost.damage===0)return [];
 return [{targetId:p.id,damage:a.technique.selfCost.damage,cause:'self-damage',sourceActorId:p.id,...effectProvenance(a),actionId:a.id,eventId:a.eventId}];
}
export function settleLifetimeGroup(s:GameState,g:AttackGroup,now:number):void{
 const a=s.actions![g.actionId]!;
 const entries=[{group:g,action:a},...(g.substituteResults??[])];
 const intents=entries.flatMap(({group:g,action:a})=>{
 const intents:DamageIntent[]=g.targets.map(t=>({targetId:t.actorId,damage:t.pendingDamage??0,...(g.substituteOrigin?.sadLoveSource?{sadLoveSource:structuredClone(g.substituteOrigin.sadLoveSource)}:{}),...(t.pendingInstantDeath?{instantDeath:true}:{}),cause:t.pendingInstantDeath??'attack',sourceActorId:g.attackerId,...effectProvenance(a),groupId:g.id,actionId:a.id,eventId:a.eventId}));
 if(g.followerBundleId){intents.length=0;for(const t of g.targets){for(const hit of t.hits){if(!hit.hit)continue;const source=s.actions![hit.sourceActionId!]!;intents.push({targetId:t.actorId,damage:hit.bodyDamage?.total??hit.damage??0,...(hit.abilityInstantDeath?{instantDeath:true}:{}),cause:hit.abilityInstantDeath?'instant-death':'attack',sourceActorId:g.attackerId,sourceCardInstanceId:hit.sourceCardInstanceId!,groupId:g.id,actionId:source.id,eventId:source.eventId});}}}
 intents.push(...(g.pendingFatalIntents??[]));
 intents.push(...consumeSelfCost(s,a).map(intent=>({...intent,groupId:g.id})));
 return intents;
 });
 // Post-death benefits sit below the complete death batch and above stable outcomes.
 const drained=entries.flatMap(({group})=>group.technique.lifetimeHit?.kind==='soul-drain'?group.targets.filter(t=>t.pendingInstantDeath).map(t=>t.actorId):[]);
 const before=s.lifecycle?.length??0;const sinceEventId=s.nextEventId;
 settleDamage(s,intents,now);
 const accepted=drained.filter(id=>s.players[id]!.presence==='pending-death');
 if(accepted.length&&isActive(s.players[a.actorId]!))(s.lifecycle??=[]).splice(before,0,{kind:'post-death-heal',id:`heal-${g.id}`,actorId:a.actorId,targetIds:accepted,sinceEventId});
 for(const {group:g,action:a} of entries)for(const t of g.targets){const p=s.players[t.actorId]!;if(!isActive(p))continue;
  const source={id:`${g.id}:${p.id}:lifetime`,sourceActorId:a.actorId,...effectProvenance(a),targetId:p.id};
  for(const hit of t.hits){if(!hit.hit||!(hit.technique??g.technique).stopUntilSourceTurn||commitMentalStopPrevention(s,g,t,hit))continue;const card=hit.sourceCardInstanceId??physicalEffectCard(a);(p.statuses??=[]).push({id:`${g.id}:${p.id}:water:${hit.index}`,kind:'stopped',timing:'source-turn',sourceActorId:g.attackerId,sourceCardInstanceId:card,targetId:p.id});}
  if(t.pendingOtherworld){p.presence='otherworld';clearDistances(s,p.id);}
  if(t.pendingFixedStop&&!commitMentalStopPrevention(s,g,t))(p.statuses??=[]).push({...source,kind:'stopped',timing:'fixed-turns',remainingTurns:t.pendingFixedStop});
  if(t.pendingDeadlyStop!==undefined&&!commitMentalStopPrevention(s,g,t))(p.statuses??=[]).push({...source,kind:'stopped',timing:'deadly-recovery',modifiers:[t.pendingDeadlyStop],nextCheck:0});
 }
 saveBeastCapture(s,g);
}
