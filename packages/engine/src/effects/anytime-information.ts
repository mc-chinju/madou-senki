import {getAction} from '@madou/catalog';
import type {GameCommand} from '@madou/protocol';
import type {AnytimeCardOption} from './remaining-anytime-cards.js';
import type {EngineErrorCode} from '../commands.js';
import {isActive} from '../lifecycle/objectives.js';
import {hasPendingFatal,hasStatus,type GameState} from '../state.js';
import type {ActionFrame} from '../reactions/continuations.js';
import {lifeIdentity} from '../abilities/suppression-state.js';
import {beginInspection} from '../abilities/private-inspection.js';
import {enqueueLifecycle} from '../lifecycle/events.js';
import {refillHand} from '../setup.js';
import {reclaimEventId} from '../reclaim.js';
import {techniqueFor} from './registry.js';
export const PEACE='a2-p02-r1c1',REVELATION='a2-p02-r1c2';
export function informationAnytimeOptions(s:GameState,actorId:string):AnytimeCardOption[]{
 const p=s.players[actorId],w=s.windows?.at(-1);
 if(!p||s.outcome||s.phase==='setup'||!isActive(p)||hasStatus(p,'stopped')||hasPendingFatal(s,actorId)||w&&(w.participants[w.cursor]!==actorId||!['declaration','before-roll','after-roll','effect-level','damage','attack-abilities','normal-defense','follower-entry-abilities','hit','hit-abilities','follower-start','approach','withdrawal'].includes(w.kind))||!w&&s.lifecycle?.length)return [];
 const targetEventId=w?`${w.id}-${w.revision}`:`idle-${s.turnNumber??0}-${s.revision}-${s.phase}`;
 const usageEvent=w?reclaimEventId(s,{eventId:w.eventId,parentWindowId:w.id}):targetEventId;
 return [PEACE,REVELATION].flatMap(cardInstanceId=>!p.hand.includes(cardInstanceId)||s.used?.includes(`${usageEvent}:${actorId}:${cardInstanceId}`)||cardInstanceId===PEACE&&p.faction!=='GOOD'?[]:s.seatOrder.filter(id=>isActive(s.players[id]!)&&!hasPendingFatal(s,id)&&(cardInstanceId!==PEACE||id!==actorId)).map(targetId=>({cardInstanceId,targetEventId,targetId,label:`${getAction(cardInstanceId)!.name}を使う（${s.players[targetId]!.name}）`})));
}
export function acceptInformationAnytime(s:GameState,actorId:string,c:Extract<GameCommand,{type:'PLAY_ANYTIME_CARD'}>,random:()=>number,now:number):EngineErrorCode|undefined {
 if(c.groupId!==undefined||c.hitIndex!==undefined||!informationAnytimeOptions(s,actorId).some(o=>o.cardInstanceId===c.cardInstanceId&&o.targetEventId===c.targetEventId&&o.targetId===c.targetId))return 'INVALID_TARGET';
 const p=s.players[actorId]!,w=s.windows?.at(-1),id=`a-${s.nextEventId++}`,eventId=w?.eventId??id;
 (s.used??=[]).push(`${w?reclaimEventId(s,{eventId:w.eventId,parentWindowId:w.id}):c.targetEventId}:${actorId}:${c.cardInstanceId}`);
 const current=Object.values(s.actions??{}).filter(a=>a.actorId===c.targetId&&['attack','defense','turn-technique','turn-card','distance'].includes(a.kind)&&!a.disposition).at(-1)
  ??Object.values(s.abilities??{}).filter(a=>a.actorId===c.targetId).at(-1);
 p.hand.splice(p.hand.indexOf(c.cardInstanceId),1);s.resolution.push(c.cardInstanceId);
 (s.actions??={})[id]={id,eventId,parentWindowId:w?.id??null,actorId,cardInstanceId:c.cardInstanceId,kind:'reaction',anytimeEffect:c.cardInstanceId===PEACE?'peace':'revelation',anytimeReturnPhase:s.phase,
  ...(c.cardInstanceId===PEACE?{peaceExpiry:current?{eventId:reclaimEventId(s,current)}:{awaitingOwnAction:true}}:{}),reclaimOwnerLifeId:lifeIdentity(p),turnCardTargetLifeId:lifeIdentity(s.players[c.targetId!]!),targetIds:[c.targetId!],technique:techniqueFor('a2-p05-r3c1')!,groupId:null,stage:'declaration',checks:[],roll:null,canceled:false};
 enqueueLifecycle(s,{kind:'declaration',id:`declare-${id}`,actionId:id,rootEventIds:[eventId]});refillHand(s,p,p.hand.length+1,random,now);
}
export function resolveInformationAnytime(s:GameState,a:ActionFrame):boolean {
 const p=s.players[a.actorId]!,target=s.players[a.targetIds[0]!]!;
 if(!isActive(p)||!isActive(target)||hasPendingFatal(s,p.id)||hasPendingFatal(s,target.id)||lifeIdentity(p)!==a.reclaimOwnerLifeId||lifeIdentity(target)!==a.turnCardTargetLifeId)return true;
 if(a.anytimeEffect==='peace'){
  if(p.faction!=='GOOD')return true;
  (target.spiritReplacements??=[]).push({id:a.id,base:12,sourceCardInstanceId:PEACE,expiresOnActorId:target.id,timing:'action-end',...(a.peaceExpiry?.eventId?{expiresAfterEventId:a.peaceExpiry.eventId}:{awaitingOwnAction:true})});return true;
 }
 if(!a.turnCardInspectionStarted){a.turnCardInspectionStarted=true;beginInspection(s,{eventId:a.eventId,actorId:p.id,targetIds:[target.id],parentWindowId:a.parentWindowId,cardActionId:a.id},'all','none');}
 return false;
}
