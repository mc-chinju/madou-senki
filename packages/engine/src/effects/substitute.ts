import {recordCardPlayed} from '../public-record.js';
import type {GameCommand} from '@madou/protocol';
import type {GameState} from '../state.js';
import {hasPendingFatal,hasStatus} from '../state.js';
import {isActive} from '../lifecycle/objectives.js';
import {lifeIdentity} from '../abilities/suppression-state.js';
import {effectiveHitTechnique} from '../abilities/follower-entry.js';
import type {ActionFrame,AttackGroup,AttackTarget,Technique} from '../reactions/continuations.js';
import type {AnytimeCardOption} from './remaining-anytime-cards.js';
import type {EngineErrorCode} from '../commands.js';
import {enqueueLifecycle} from '../lifecycle/events.js';
import {refillHand} from '../setup.js';
import {techniqueFor} from './registry.js';
export const SUBSTITUTE='a2-p02-r2c1';
export interface SubstituteBinding {sadLoveSource?:import('../abilities/sad-love-state.js').SadLoveSource;groupId:string;targetId:string;hitIndex:number;sourceActionId:string;targetLifeId:string}
export interface SubstituteTransfer {binding:SubstituteBinding;technique:Technique;hit:AttackTarget['hits'][number]}
/** The nearest received group determines restrictions; an actual returned counter has its own group. */
export function substituteRestricted(s:GameState,actorId:string):boolean {
 for(const w of [...(s.windows??[])].reverse())if(w.continuation.kind==='group'){
  const g=s.groups?.[w.continuation.id];return !!g?.substituteOrigin&&g.targets.some(t=>t.actorId===actorId);
 }
 return false;
}
export function attackScopeGroups(s:GameState,a:ActionFrame):AttackGroup[]{return Object.values(s.groups??{}).filter(g=>g.actionId===a.id||g.substituteOrigin?.sourceActionId===a.id);}
export function hitPaymentGroups(s:GameState,g:AttackGroup):AttackGroup[]{const id=g.substituteOrigin?.groupId??g.id;return Object.values(s.groups??{}).filter(group=>group.id===id||group.substituteOrigin?.groupId===id);}
export function substituteCandidates(s:GameState,actorId:string):AnytimeCardOption[]{
 const p=s.players[actorId],w=s.windows?.at(-1);
 if(!p||!w||!isActive(p)||hasPendingFatal(s,actorId)||hasStatus(p,'stopped')||w.participants[w.cursor]!==actorId||substituteRestricted(s,actorId)||!['attack-abilities','normal-defense','follower-entry-abilities','follower-start','hit','hit-abilities','declaration','before-roll','after-roll','effect-level','damage'].includes(w.kind))return [];
 const result:AnytimeCardOption[]=[];
 for(const g of Object.values(s.groups??{})){
  const source=s.actions?.[g.actionId];if(!source||source.canceled||source.disposition||g.substituteOrigin)continue;
  for(const t of g.targets){if(t.actorId===actorId||!isActive(s.players[t.actorId]!))continue;
   for(const h of t.hits)if(!h.hit&&!h.defended&&!h.substitutedBy)result.push({cardInstanceId:SUBSTITUTE,targetEventId:g.actionId,targetId:t.actorId,groupId:g.id,hitIndex:h.index,label:`身代わりを使う（${s.players[t.actorId]!.name}への${h.index+1}発目を引き受ける）`});
  }
 }
 return result;
}
export function substituteOptions(s:GameState,actorId:string):AnytimeCardOption[]{return s.players[actorId]?.hand.includes(SUBSTITUTE)?substituteCandidates(s,actorId).filter(o=>!s.used?.includes(`${o.targetEventId}:${actorId}:${SUBSTITUTE}`)):[];}
export function acceptSubstitute(s:GameState,actorId:string,c:Extract<GameCommand,{type:'PLAY_ANYTIME_CARD'}>,random:()=>number,now:number):EngineErrorCode|undefined {
 if(!substituteOptions(s,actorId).some(o=>o.cardInstanceId===c.cardInstanceId&&o.targetEventId===c.targetEventId&&o.targetId===c.targetId&&o.groupId===c.groupId&&o.hitIndex===c.hitIndex))return 'INVALID_TARGET';
 const p=s.players[actorId]!,w=s.windows!.at(-1)!,source=s.actions![c.targetEventId]!,id=`a-${s.nextEventId++}`;
 (s.used??=[]).push(`${source.id}:${actorId}:${SUBSTITUTE}`);p.hand.splice(p.hand.indexOf(SUBSTITUTE),1);s.resolution.push(SUBSTITUTE);recordCardPlayed(s,actorId,SUBSTITUTE,'anytime',[c.targetId!]);
 s.actions![id]={id,eventId:source.eventId,parentWindowId:w.id,actorId,cardInstanceId:SUBSTITUTE,kind:'reaction',targetIds:[c.targetId!],technique:techniqueFor('a2-p05-r3c1')!,groupId:null,stage:'declaration',checks:[],roll:null,canceled:false,reclaimOwnerLifeId:lifeIdentity(p),substituteBinding:{groupId:c.groupId!,targetId:c.targetId!,hitIndex:c.hitIndex!,sourceActionId:source.id,targetLifeId:lifeIdentity(s.players[c.targetId!]!)}};
 enqueueLifecycle(s,{kind:'declaration',id:`declare-${id}`,actionId:id,rootEventIds:[source.eventId]});refillHand(s,p,p.hand.length+1,random,now);
}
export function resolveSubstitute(s:GameState,a:Pick<ActionFrame,'id'|'actorId'|'reclaimOwnerLifeId'|'substituteBinding'|'substituteTransfer'>):void {
 const b=a.substituteBinding!,g=s.groups?.[b.groupId],t=g?.targets.find(t=>t.actorId===b.targetId),h=t?.hits.find(h=>h.index===b.hitIndex),p=s.players[a.actorId]!;
 if(!g||!t||!h||h.hit||h.defended||h.substitutedBy||!isActive(p)||lifeIdentity(p)!==a.reclaimOwnerLifeId||!isActive(s.players[t.actorId]!)||lifeIdentity(s.players[t.actorId]!)!==b.targetLifeId)return;
 a.substituteTransfer={binding:{...b},technique:structuredClone(effectiveHitTechnique(s,g,t,h)),hit:structuredClone(h)};h.substitutedBy=a.id;h.defended=true;
}
