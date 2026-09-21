import {finishCardInspection} from '../combat/attack.js';
import {lifeIdentity} from './suppression-state.js';
import {discardPhysical} from '../discard.js';
import type {GameState} from '../state.js';
import type {GameInput,TransitionResult} from '../commands.js';
import type {AbilityFrame} from './frames.js';
import {openWindow,resetParent} from '../reactions/windows.js';
import {canUseCharacterAbility} from '../state.js';
import {ownsAbility} from './ownership.js';
import {isActive} from '../lifecycle/objectives.js';
export type InspectionZone='all'|'hand'|'followers'|'chants'|'character';
export type InspectionChoice='finish'|'discard-one'|'discard-all';
export interface InspectionView {decisionId:string;actorId:string;targetId:string;zone:InspectionZone;cards:{zone?:'hand'|'followers'|'chants';position:number;cardInstanceId:string}[];characterId?:string;discardMode:'none'|'one'|'all';choices:InspectionChoice[]}
export interface PrivateInspection extends InspectionView {abilityId?:string;cardActionId?:string;sourceLifeId?:string;targetLifeId?:string;sourceCharacterId:string;eventId:string;turnNumber:number;parentWindowId:string|null;windowId:string;phase:GameState['phase']}
export function beginInspection(s:GameState,f:Pick<AbilityFrame,'eventId'|'actorId'|'targetIds'|'parentWindowId'>&({abilityId:string}|{cardActionId:string}),zone:InspectionZone,discardMode:InspectionView['discardMode']):void{
 const target=s.players[f.targetIds[0]!]!;const decisionId=`inspection-${s.nextEventId++}`;
 const cards:InspectionView['cards']=zone==='all'?(['hand','followers','chants'] as const).flatMap<InspectionView['cards'][number]>(part=>part==='hand'?target.hand.map((cardInstanceId,position)=>({zone:part,cardInstanceId,position})):target[part].map((c,position)=>({zone:part,cardInstanceId:c.cardInstanceId,position}))):zone==='character'?[]:zone==='hand'?target.hand.map((cardInstanceId,position)=>({position,cardInstanceId})):target[zone].map((c,position)=>({position,cardInstanceId:c.cardInstanceId}));
 const w=openWindow(s,'private-inspection',f.eventId,{kind:'inspection',id:decisionId},[f.actorId]);
 (s.inspections??=[]).push({decisionId,actorId:f.actorId,targetId:target.id,zone,cards,...(zone==='character'?{characterId:target.characterId}:{}),discardMode,choices:['finish',...(cards.length&&discardMode==='one'?['discard-one' as const]:cards.length&&discardMode==='all'?['discard-all' as const]:[])],...('abilityId' in f?{abilityId:f.abilityId}:{cardActionId:f.cardActionId,sourceLifeId:lifeIdentity(s.players[f.actorId]!),targetLifeId:lifeIdentity(target)}),sourceCharacterId:s.players[f.actorId]!.characterId,eventId:f.eventId,turnNumber:s.turnNumber??0,parentWindowId:f.parentWindowId,windowId:w.id,phase:s.phase});
 // What a card let this seat see is knowledge it keeps, not a line in the record: the record is read through
 // a window now, so a history hung on it would empty itself as the table plays on. The identity a card
 // named is kept the same way as the cards a card named, and the panels read the zone they belong to.
 if('cardActionId' in f&&(zone==='all'||zone==='character'))(s.inspectionHistory??=[]).push(inspectionView(s,f.actorId)!);
 if('cardActionId' in f&&zone==='character'){
  s.events.push({id:s.nextEventId++,at:0,type:'CHARACTER_INSPECTED',actorId:f.actorId,targetId:target.id,audience:'public'},
   {id:s.nextEventId++,at:0,type:'CHARACTER_INSPECTED',actorId:f.actorId,targetId:target.id,characterId:target.characterId,audience:{playerId:f.actorId}});
 }
}
export function inspectionView(s:GameState,actorId:string):InspectionView|null{const d=[...(s.inspections??[])].reverse().find(d=>d.actorId===actorId);return d?{decisionId:d.decisionId,actorId:d.actorId,targetId:d.targetId,zone:d.zone,cards:d.cards.map(c=>({...c})),...(d.characterId?{characterId:d.characterId}:{}),discardMode:d.discardMode,choices:[...d.choices]}:null;}
function discardable(s:GameState,d:PrivateInspection):boolean {const p=s.players[d.actorId],t=s.players[d.targetId];return !!p&&!!t&&isActive(p)&&isActive(t)&&(d.cardActionId?!!s.actions?.[d.cardActionId]&&lifeIdentity(p)===d.sourceLifeId&&lifeIdentity(t)===d.targetLifeId:canUseCharacterAbility(p,s)&&p.characterId===d.sourceCharacterId&&!!d.abilityId&&ownsAbility(p,d.abilityId));}
export function finishInspection(s:GameState,id:string):void{const d=s.inspections?.find(d=>d.decisionId===id);if(!d)return;s.inspections=s.inspections!.filter(x=>x!==d);s.phase=d.phase;resetParent(s,d.parentWindowId);if(d.cardActionId)finishCardInspection(s,d.cardActionId);}
/** PASS is an explicit acknowledgement; off-owner/stale decisions are never accepted. */
export function transitionInspection(s:GameState,input:GameInput):TransitionResult|undefined{
 const w=s.windows?.at(-1),c=input.command;
 if(c.type!=='CHOOSE_INSPECTION'&&!(c.type==='PASS'&&w?.kind==='private-inspection'))return;
 if(!w||w.kind!=='private-inspection'||w.continuation.kind!=='inspection')return {ok:false,code:'WRONG_PHASE'};
 const d=s.inspections?.find(d=>d.decisionId===w.continuation.id);
 if(!d||d.actorId!==input.actorId)return {ok:false,code:'NOT_PRIORITY'};
 if(c.type==='CHOOSE_INSPECTION'&&c.decisionId!==d.decisionId)return {ok:false,code:'INVALID_TARGET'};
 const choice=c.type==='PASS'?'finish':c.choice;
 if(!d.choices.includes(choice))return {ok:false,code:'INVALID_COMMAND'};
 const selected=c.type==='CHOOSE_INSPECTION'?c.cardInstanceId:undefined;
 if(choice==='discard-one'&&!d.cards.some(card=>card.cardInstanceId===selected))return {ok:false,code:'INVALID_DISCARD'};
 const next=structuredClone(s);const target=next.players[d.targetId];
 if(choice!=='finish'&&discardable(next,d)&&target){
  const ids=d.cards.filter(card=>choice==='discard-all'||card.cardInstanceId===selected).map(card=>card.cardInstanceId);
  for(const id of ids)if(d.zone==='hand'||d.zone==='chants')discardPhysical(next,id,{zone:d.zone,ownerId:target.id},d.actorId,d.eventId);
 }
 next.windows!.pop();finishInspection(next,d.decisionId);next.revision++;return {ok:true,state:next,events:[]};
}
/** Remove orphaned/unusable choices at the next accepted boundary; nested children remain intact. */
export function cleanInspections(s:GameState):void{const w=s.windows?.at(-1);if(w?.continuation.kind!=='inspection')return;const d=s.inspections?.find(d=>d.decisionId===w.continuation.id);if(!d||!discardable(s,d)){s.windows!.pop();if(d)finishInspection(s,d.decisionId);}}
