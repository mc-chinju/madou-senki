import {recordAbility} from '../public-record.js';
import type {GameState} from '../state.js';
import {canUseCharacterAbility,hasPendingFatal} from '../state.js';
import type {GameInput,TransitionResult} from '../commands.js';
import {isActive} from '../lifecycle/objectives.js';
import {ownsAbility} from './ownership.js';
import {publicAbilityOpportunity} from './conditional-selection.js';
import {lifeIdentity} from './suppression-state.js';
import {SAD_LOVE,ARNES,sadLoveAuraActive} from './sad-love-state.js';
import {substituteCandidates,resolveSubstitute,type SubstituteBinding} from '../effects/substitute.js';
import {openWindow,participants} from '../reactions/windows.js';
import type {AbilityFrame} from './frames.js';
import type {ActionFrame} from '../reactions/continuations.js';
export interface SadLoveContext {kind:'sad-love';mode:'aura'|'substitute';opportunityId:string;sourceLifeId:string;binding?:SubstituteBinding}
export interface SadLoveView {auraEnabled:boolean;auraActive:boolean;canActivate:boolean;canDeactivate:boolean;targetEventId:string|null;substitutionSpent:boolean;substitutions:{targetEventId:string;targetId:string;groupId:string;hitIndex:number}[]}
export function sadLoveView(s:GameState,actorId:string):SadLoveView|null {
 const p=s.players[actorId];if(!p||!ownsAbility(p,SAD_LOVE))return null;
 const event=publicAbilityOpportunity(s,actorId),available=!!event&&isActive(p)&&!hasPendingFatal(s,actorId),canUse=canUseCharacterAbility(p,s);
 return {auraEnabled:!!p.sadLoveAura,auraActive:sadLoveAuraActive(s,p)&&Object.values(s.players).some(t=>isActive(t)&&t.revealed&&t.characterId===ARNES),canActivate:available&&canUse&&!p.sadLoveAura&&!s.used?.includes(`${event}:${actorId}:${SAD_LOVE}:aura`),canDeactivate:available&&!!p.sadLoveAura,targetEventId:event,substitutionSpent:!!p.sadLoveSubstitutionSpent,
  substitutions:!p.sadLoveSubstitutionSpent&&canUse?substituteCandidates(s,actorId).filter(o=>s.players[o.targetId!]!.characterId===ARNES).map(o=>({targetEventId:o.targetEventId,targetId:o.targetId!,groupId:o.groupId!,hitIndex:o.hitIndex!})):[]};
}
export function transitionSadLove(state:GameState,input:GameInput):TransitionResult|undefined {
 const c=input.command;if(c.type!=='USE_ABILITY'||c.abilityId!==SAD_LOVE)return;
 const o=sadLoveView(state,input.actorId);if(!o)return {ok:false,code:'ABILITY_DISABLED'};
 if(c.mode==='aura'){
  if(c.enabled?!o.canActivate:!o.canDeactivate)return {ok:false,code:'ABILITY_DISABLED'};
  if(c.targetEventId!==o.targetEventId)return {ok:false,code:'INVALID_TARGET'};
 }else if(c.mode!=='substitute'||!o.substitutions.some(o=>o.targetEventId===c.targetEventId&&o.targetId===c.targetId&&o.groupId===c.groupId&&o.hitIndex===c.hitIndex))return {ok:false,code:'INVALID_TARGET'};
 const s=structuredClone(state),p=s.players[input.actorId]!,w=s.windows?.at(-1);
 if(c.mode==='aura'&&!c.enabled){delete p.sadLoveAura;for(const f of Object.values(s.abilities??{}))if(f.actorId===p.id&&f.context.kind==='sad-love'&&f.context.mode==='aura')f.canceled=true;recordAbility(s,'ABILITY_CANCELED',p.id,SAD_LOVE);}
 else{
  const context:SadLoveContext={kind:'sad-love',mode:c.mode,opportunityId:c.targetEventId,sourceLifeId:lifeIdentity(p)};
  if(c.mode==='substitute'){p.sadLoveSubstitutionSpent=true;context.binding={groupId:c.groupId!,targetId:c.targetId!,hitIndex:c.hitIndex!,sourceActionId:c.targetEventId,targetLifeId:lifeIdentity(s.players[c.targetId!]!)};}
  const f:AbilityFrame={source:'ability',id:`ability-${s.nextEventId++}`,abilityId:SAD_LOVE,actorId:p.id,targetIds:[c.mode==='substitute'?c.targetId!:p.id],eventId:c.targetEventId,parentWindowId:w?.id??null,useOrdinal:1,costs:{ownAction:false},stage:'declaration',canceled:false,rollIds:[],context};
  if(context.binding)context.binding.sadLoveSource={substitutionEventId:f.id,originalTargetId:c.targetId!,substituteId:p.id,substituteLifeId:context.sourceLifeId};
  (s.abilities??={})[f.id]=f;(s.used??=[]).push(`${c.targetEventId}:${p.id}:${SAD_LOVE}:${c.mode}`);recordAbility(s,'ABILITY_DECLARED',p.id,f.abilityId,f.targetIds.filter(id=>id!==p.id));openWindow(s,'declaration',f.eventId,{kind:'ability',id:f.id},w?participants(s,(s.seatOrder.indexOf(p.id)+1)%s.seatOrder.length):participants(s));
 }
 s.revision++;return {ok:true,state:s,events:[]};
}
export function resolveSadLove(s:GameState,f:AbilityFrame):Pick<ActionFrame,'id'|'actorId'|'parentWindowId'|'substituteTransfer'>|undefined {
 const c=f.context,p=s.players[f.actorId];if(c.kind!=='sad-love'||f.canceled||!p||!isActive(p)||hasPendingFatal(s,p.id)||!ownsAbility(p,SAD_LOVE)||!canUseCharacterAbility(p,s)||lifeIdentity(p)!==c.sourceLifeId)return;
 if(c.mode==='aura'){p.sadLoveAura={sourceLifeId:c.sourceLifeId};return;}
 const carrier:Pick<ActionFrame,'id'|'actorId'|'parentWindowId'|'reclaimOwnerLifeId'|'substituteBinding'|'substituteTransfer'>={id:f.id,actorId:p.id,parentWindowId:f.parentWindowId,reclaimOwnerLifeId:c.sourceLifeId,substituteBinding:c.binding!};
 resolveSubstitute(s,carrier);return carrier.substituteTransfer?carrier:undefined;
}
