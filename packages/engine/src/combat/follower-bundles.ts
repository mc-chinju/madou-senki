import {recordAbility,recordAttackEnded,recordCardPlayed} from '../public-record.js';
import {printedTechniqueAllowed} from './printed-restrictions.js';
import {offerReclaim} from '../reclaim.js';
import {lifeIdentity} from '../abilities/suppression-state.js';
import {conditionalSourcePreview} from '../abilities/conditional-preview.js';
import {gameStats} from '../game-stats.js';
import {acceptActionModifiers} from '../abilities/action-modifiers.js';
import {getAction,getCharacter} from '@madou/catalog';
import type {FollowerAbilityId,FollowerAttackSourceChoice} from '@madou/protocol';
import type {GameState} from '../state.js';
import {canUseCharacterAbility,hasStatus} from '../state.js';
import type {GameInput,TransitionResult} from '../commands.js';
import type {ActionFrame,Technique} from '../reactions/continuations.js';
import {isActive} from '../lifecycle/objectives.js';
import {followerBottomFor,followerAttackFor} from '../effects/follower-attacks.js';
import {legalAttackTargets,type FollowerAttackOption} from './legality.js';
import {openWindow} from '../reactions/windows.js';
import {ABILITIES,type AbilityFrame} from '../abilities/frames.js';
export interface FollowerBundle {id:string;actorId:string;abilityId:FollowerAbilityId;actionIds:string[];cursor:number;stage:'grant'|'prepare'|'defense';reclaimCursor?:number;reclaimDecisionId?:string}
export interface FollowerBundleOption {abilityId:FollowerAbilityId;name:string;targetEventId:string;sources:(Omit<FollowerAttackOption,'dedicated'>&{dedicated:boolean})[]}
export function followerAbilityId(s:GameState,actorId:string):FollowerAbilityId|undefined {const id=s.players[actorId]?.characterId;return id==='c2-p05-r1c2'?'c2-p05-r1c2-ab02':id==='c2-p06-r1c2'?'c2-p06-r1c2-ab04':undefined;}
function eventId(s:GameState){return `turn-${s.turnNumber??0}-${s.seatOrder[s.turnSeat]}-${s.phase}`;}
function canDeclare(s:GameState,actorId:string){const p=s.players[actorId];return !!p&&!s.outcome&&isActive(p)&&canUseCharacterAbility(p,s)&&!s.windows?.length&&s.phase==='action'&&s.seatOrder[s.turnSeat]===actorId;}
/** Shared pure capability/source validation, called for options and before atomic reservation. */
function selection(s:GameState,actorId:string,choice:Pick<FollowerAttackSourceChoice,'cardInstanceId'|'dedicated'>):{technique:Technique;sourceZone:'hand'|'followers'}|undefined{
 const p=s.players[actorId]!;const ability=followerAbilityId(s,actorId);if(!ability)return;
 const card=getAction(choice.cardInstanceId);if(card?.category!=='follower'||!(card.stats?.attributes as string[]|undefined)?.includes(ability==='c2-p05-r1c2-ab02'?'獣':'人'))return;
 const sourceZone=p.hand.includes(choice.cardInstanceId)?'hand':p.followers.some(f=>f.cardInstanceId===choice.cardInstanceId)?'followers':undefined;if(!sourceZone)return;
 const t=choice.dedicated?ability==='c2-p05-r1c2-ab02'&&choice.cardInstanceId==='a2-p20-r3c1'?followerAttackFor(choice.cardInstanceId,getCharacter(p.characterId)?.name,true):undefined:followerBottomFor(choice.cardInstanceId);if(!t)return;
 if(t.school==='magic'&&hasStatus(p,'silenced')||!printedTechniqueAllowed(p,t))return;
 if(t.useLevelSource==='own-warrior'){t.useLevel=gameStats(s,p.id).warrior_level;t.effectLevel=t.useLevel;}
 return {technique:t,sourceZone};
}
function validTargets(s:GameState,actorId:string,t:Technique,ids:string[]):boolean{const legal=legalAttackTargets(s,actorId,t);return !!ids.length&&new Set(ids).size===ids.length&&ids.every(id=>legal.includes(id))&&(t.target==='all'||ids.length===1)&&(!t.mandatoryAll||ids.length===legal.length);}
export function followerBundleOptions(s:GameState,actorId:string):FollowerBundleOption[]{
 if(!canDeclare(s,actorId))return [];const abilityId=followerAbilityId(s,actorId);if(!abilityId)return [];const p=s.players[actorId]!;const sources:FollowerBundleOption['sources']=[];
 for(const cardInstanceId of [...p.hand,...p.followers.map(f=>f.cardInstanceId)])for(const dedicated of [false,true]){
  const resolved=selection(s,actorId,{cardInstanceId,dedicated});if(!resolved)continue;const t=resolved.technique;const ids=legalAttackTargets(s,actorId,t);if(!validTargets(s,actorId,t,t.target==='one'?ids.slice(0,1):ids))continue;
  sources.push({cardInstanceId,dedicated,sourceZone:resolved.sourceZone,targetMode:t.mandatoryAll?'mandatory-all':t.target==='all'?'selected-all':'one',legalTargetIds:ids,range:t.range as 'near'|'far',school:t.school,attributes:[...t.attributes],useLevel:t.effectLevelFormula?'3+1d6':t.useLevel,...conditionalSourcePreview(s,actorId,t,ids),hitCount:t.hitCount as number,noChecks:t.noChecks});
 }
 return sources.length?[{abilityId,name:ABILITIES[abilityId].name,targetEventId:eventId(s),sources}]:[];
}
export function transitionFollowerBundle(state:GameState,input:GameInput):TransitionResult|undefined{
 const c=input.command;if(c.type!=='USE_FOLLOWER_ATTACK')return;const p=state.players[input.actorId]!;
 if(hasStatus(p,'stopped'))return {ok:false,code:'STOPPED'};
 if(!canDeclare(state,p.id)||followerAbilityId(state,p.id)!==c.abilityId)return {ok:false,code:'ABILITY_DISABLED'};
 if(c.targetEventId!==eventId(state))return {ok:false,code:'INVALID_TARGET'};
 const selections=c.sources.map(choice=>selection(state,p.id,choice));
 if(selections.some(v=>!v))return {ok:false,code:'UNSUPPORTED_CARD'};
 if(selections.some((v,i)=>!validTargets(state,p.id,v!.technique,c.sources[i]!.targetIds)))return {ok:false,code:'INVALID_TARGET'};
 const s=structuredClone(state);const actor=s.players[p.id]!;const id=`bundle-${s.nextEventId++}`;
 const bundle:FollowerBundle={id,actorId:p.id,abilityId:c.abilityId,actionIds:[],cursor:0,stage:'grant'};(s.followerBundles??={})[id]=bundle;
 for(let i=0;i<c.sources.length;i++){
  const choice=c.sources[i]!;const resolved=selections[i]!;const t=resolved.technique;
  if(resolved.sourceZone==='hand')actor.hand.splice(actor.hand.indexOf(choice.cardInstanceId),1);else actor.followers=actor.followers.filter(f=>f.cardInstanceId!==choice.cardInstanceId);
  s.resolution.push(choice.cardInstanceId);recordCardPlayed(s,actor.id,choice.cardInstanceId,'attack',choice.targetIds);const actionId=`a-${s.nextEventId++}`;const stats=gameStats(s,actor.id,{technique:t});
  const checkSpecs:NonNullable<ActionFrame['checkSpecs']>=t.noChecks?[]:Array.from({length:Math.max(0,t.useLevel-(t.school==='warrior'?stats.warrior_level:stats.magic_level))},()=>({purpose:'excess-level',modifier:0}));
  const a:ActionFrame={reclaimOwnerLifeId:lifeIdentity(actor),followerBundleId:id,sourceZone:resolved.sourceZone,id:actionId,eventId:actionId,parentWindowId:null,actorId:p.id,cardInstanceId:choice.cardInstanceId,kind:'attack',targetIds:[...choice.targetIds],technique:structuredClone(t),groupId:null,stage:'declaration',checks:checkSpecs.map(c=>c.modifier),checkSpecs,roll:null,canceled:false};
  // Dedicated selection is saved in the bundle's immutable source metadata.
  a.followerDedicated=choice.dedicated;
  acceptActionModifiers(s,a);
  (s.actions??={})[actionId]=a;bundle.actionIds.push(actionId);
 }
 const ability:AbilityFrame={followerBundleId:id,source:'ability',id:`ability-${s.nextEventId++}`,abilityId:c.abilityId,actorId:p.id,targetIds:[...new Set(c.sources.flatMap(c=>c.targetIds))],eventId:c.targetEventId,parentWindowId:null,useOrdinal:1,costs:{ownAction:true},stage:'declaration',canceled:false,rollIds:[],context:{kind:'own-action'}};
 (s.abilities??={})[ability.id]=ability;recordAbility(s,'ABILITY_DECLARED',ability.actorId,ability.abilityId,ability.targetIds.filter(id=>id!==ability.actorId));s.phase='combat';openWindow(s,'declaration',ability.eventId,{kind:'ability',id:ability.id});s.revision++;return {ok:true,state:s,events:[]};
}
export function discardBundle(s:GameState,b:FollowerBundle):boolean{
 // Every follower that was declared gets its ending, even when the whole bundle is thrown away.
 for(const id of b.actionIds){const a=s.actions?.[id];if(a)recordAttackEnded(s,a,'nullified');}
 b.reclaimCursor??=0;
 if(b.reclaimDecisionId&&s.reclaimDecisions?.find(d=>d.id===b.reclaimDecisionId)?.stage!=='closed')return false;
 while(b.reclaimCursor<b.actionIds.length){
  const a=s.actions?.[b.actionIds[b.reclaimCursor++]!];if(!a||!a.cardInstanceId||!s.resolution.includes(a.cardInstanceId))continue;
  const d=offerReclaim(s,{kind:'ordinary-disposition',fromZone:'resolution',sourceId:`${a.id}-${a.cardInstanceId}`,
   eventId:a.eventId,sourceActorId:a.actorId,sourceLifeId:a.reclaimOwnerLifeId??`initial-life:${a.actorId}`,
   cardInstanceId:a.cardInstanceId,trigger:'named-card-used',usedModeName:'technique'});
  b.reclaimDecisionId=d.id;if(d.stage!=='closed'){s.phase='combat';return false;}
 }
 for(const id of b.actionIds){const a=s.actions?.[id];if(!a||!a.cardInstanceId)continue;const at=s.resolution.indexOf(a.cardInstanceId);if(at>=0){s.resolution.splice(at,1);s.discard.push(a.cardInstanceId);}delete s.actions![id];}
 delete s.followerBundles![b.id];
 if(!s.windows?.length)s.phase='withdrawal';
 return true;
}
