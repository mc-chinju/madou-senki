import {getAction} from '@madou/catalog';
import type {GameInput,TransitionResult} from '../commands.js';
import {hasPendingFatal,hasStatus,type GameState} from '../state.js';
import type {ActionFrame} from '../reactions/continuations.js';
import type {LifecycleTask} from '../lifecycle/types.js';
import {openWindow} from '../reactions/windows.js';
import {enqueueLifecycle} from '../lifecycle/events.js';
import {revealOpen} from '../lifecycle/advance.js';
import {finishTurnCardDraw} from '../combat/attack.js';
import {canRemoveFollower} from '../combat/follower-placement.js';
import {lifeIdentity} from '../abilities/suppression-state.js';
import {gameStats} from '../game-stats.js';
import {appendEvent,shuffle} from '../setup.js';
import {discardPhysical} from '../discard.js';
import {payTurnCardBatch} from './remaining-turn-cards.js';
const WISHES=['a2-p04-r3c2','a2-p04-r3c3'] as const;
type PublicZone='open'|'attachments'|'chants'|'followers';
interface PublicSource {cardInstanceId:string;ownerId:string;zone:PublicZone;position:number;name?:string}
export interface WishDecision {
 id:string;actionId:string;actorId:string;sourceLifeId:string;stage:'selection'|'settling'|'complete';
 acquisition?:{cardInstanceId:string;ownerId?:string;zone:'hand'|'deck'|PublicZone;randomIndex?:number};
}
export interface WishView {decisionId:string;deckNames:{cardName:string;count:number}[];handOwners:{ownerId:string;count:number}[];publicSources:PublicSource[]}
/** One hidden acquisition as the two seats it concerned may read it back. The record is a window now, so
 *  what this seat learned is kept beside the game instead of on a line that scrolls out of reach. */
export interface WishAcquisition {eventId:number;actorId:string;ownerId?:string;cardInstanceId:string}
export interface WishCapacityView {decisionId:string;actorId:string;followerCount:number;chantCount:number;followerIds:string[];chantIds:string[]}
export function wishOptions(s:GameState,actorId:string){const p=s.players[actorId];return p&&!s.windows?.length&&s.phase==='action'&&s.seatOrder[s.turnSeat]===actorId&&(p.presence??'active')==='active'&&!hasPendingFatal(s,actorId)&&!hasStatus(p,'stopped')?WISHES.filter(id=>p.hand.includes(id)):[];}
export function playWish(state:GameState,actorId:string,id:typeof WISHES[number]):TransitionResult{
 if(!wishOptions(state,actorId).includes(id))return {ok:false,code:'UNSUPPORTED_CARD'};
 const s=structuredClone(state);payTurnCardBatch(s,actorId,[id],'wish');s.revision++;return {ok:true,state:s,events:[]};
}
export function beginWish(s:GameState,a:ActionFrame):void{
 if(s.wishes?.some(d=>d.actionId===a.id))return;
 const d:WishDecision={id:`wish-${s.nextEventId++}`,actionId:a.id,actorId:a.actorId,sourceLifeId:lifeIdentity(s.players[a.actorId]!),stage:'selection'};
 (s.wishes??=[]).push(d);a.stage='resolve';openWindow(s,'wish',a.eventId,{kind:'action',id:a.id},[a.actorId]);
}
function publicSources(s:GameState,d:WishDecision){
 const sources:(PublicSource&{physicalId:string;publicIdentity:boolean})[]=[];
 for(const [seat,ownerId] of s.seatOrder.entries()){
  const p=s.players[ownerId]!;if(p.presence==='otherworld')continue;
  for(const zone of ['open','attachments','chants','followers'] as const){
   if(zone==='followers'&&ownerId!==d.actorId)continue;
   p[zone].forEach((entry,position)=>{
    const id=typeof entry==='string'?entry:entry.cardInstanceId;
    if(!getAction(id)||s.resolution.includes(id)||s.reclaimReservations.includes(id))return;
    const known=typeof entry==='string'||entry.revealed||ownerId===d.actorId;
    sources.push({cardInstanceId:known?id:`${d.id}-slot-${seat}-${zone}-${position}`,physicalId:id,publicIdentity:typeof entry==='string'||entry.revealed,ownerId,zone,position,...(known?{name:getAction(id)!.name}:{})});
   });
  }
 }
 return sources;
}
export function wishView(s:GameState,actorId:string):WishView|null{
 const d=s.wishes?.find(d=>d.actorId===actorId&&d.stage==='selection');if(!d)return null;
 const names=new Map<string,number>();for(const id of s.deck){const name=getAction(id)?.name;if(name)names.set(name,(names.get(name)??0)+1);}
 return {decisionId:d.id,deckNames:[...names].map(([cardName,count])=>({cardName,count})).sort((a,b)=>a.cardName.localeCompare(b.cardName,'ja')),
  handOwners:s.seatOrder.filter(id=>s.players[id]!.presence!=='otherworld'&&s.players[id]!.hand.length).map(ownerId=>({ownerId,count:s.players[ownerId]!.hand.length})),
  publicSources:publicSources(s,d).map(({physicalId,publicIdentity,...source})=>source)};
}
function capacity(s:GameState,d:WishDecision,actorId:string):WishCapacityView|null{
 const p=s.players[actorId]!,stats=gameStats(s,actorId),followerIds=p.followers.filter(f=>canRemoveFollower(f.cardInstanceId)).map(f=>f.cardInstanceId),chantIds=p.chants.map(c=>c.cardInstanceId);
 const followerCount=Math.min(followerIds.length,Math.max(0,p.followers.length-stats.followerLimit)),chantCount=Math.max(0,p.chants.length-stats.chantLimit);
 return followerCount||chantCount?{decisionId:d.id,actorId,followerCount,chantCount,followerIds,chantIds}:null;
}
export function wishCapacityView(s:GameState,actorId:string):WishCapacityView|null{
 const w=s.windows?.at(-1);if(w?.kind!=='wish-capacity'||w.participants[w.cursor]!==actorId)return null;
 const task=s.lifecycle?.find(t=>t.id===w.continuation.id);if(task?.kind!=='wish-complete')return null;
 const d=s.wishes?.find(d=>d.id===task.decisionId);return d?capacity(s,d,actorId):null;
}
/** Runs after the acquired OPEN's children, before disposing the original Wish source. */
export function advanceWishCompletion(s:GameState,task:Extract<LifecycleTask,{kind:'wish-complete'}>):boolean{
 const d=s.wishes!.find(d=>d.id===task.decisionId)!;
 const owner=s.seatOrder.find(id=>s.players[id]!.presence!=='otherworld'&&(s.players[id]!.presence??'active')==='active'&&capacity(s,d,id));
 if(owner){task.waiting=true;openWindow(s,'wish-capacity',s.actions![d.actionId]!.eventId,{kind:'lifecycle',id:task.id},[owner]);return false;}
 s.lifecycle!.pop();d.stage='complete';finishTurnCardDraw(s,d.actionId);return true;
}
export function transitionWish(state:GameState,input:GameInput,random:()=>number,now:number):TransitionResult|undefined{
 const c=input.command;if(c.type!=='CHOOSE_WISH'&&c.type!=='CHOOSE_WISH_CAPACITY')return;
 const w=state.windows?.at(-1),d=state.wishes?.find(d=>d.id===c.decisionId);
 if(!d||!w||!state.actions?.[d.actionId])return {ok:false,code:'INVALID_TARGET'};
 if(w.participants[w.cursor]!==input.actorId)return {ok:false,code:'NOT_PRIORITY'};
 if(c.type==='CHOOSE_WISH_CAPACITY'){
  const offered=wishCapacityView(state,input.actorId);if(!offered||offered.decisionId!==d.id)return {ok:false,code:'WRONG_PHASE'};
  if(c.followerIds.length!==offered.followerCount||c.chantIds.length!==offered.chantCount||c.followerIds.some(id=>!offered.followerIds.includes(id))||c.chantIds.some(id=>!offered.chantIds.includes(id)))return {ok:false,code:'INVALID_DISCARD'};
  const s=structuredClone(state),eventId=s.actions![d.actionId]!.eventId;
  // The capacity discard (G11) is announced by name to the whole table below, so a face-down placement is
  // turned face up as it goes: the pile records the face the table saw, and never less than that.
  for(const [zone,ids] of [['followers',c.followerIds],['chants',c.chantIds]] as const)for(const id of ids){const placed=s.players[input.actorId]![zone].find(card=>card.cardInstanceId===id);if(placed)placed.revealed=true;discardPhysical(s,id,{zone,ownerId:input.actorId},input.actorId,eventId);appendEvent(s,now,{type:'WISH_DISCARDED',actorId:input.actorId,audience:'public',cardInstanceId:id});}
  s.windows!.pop();const task=s.lifecycle!.find(t=>t.id===w.continuation.id)!;if(task.kind==='wish-complete')task.waiting=false;s.revision++;return {ok:true,state:s,events:[]};
 }
 if(w.kind!=='wish'||w.continuation.id!==d.actionId||d.stage!=='selection'||d.actorId!==input.actorId||lifeIdentity(state.players[d.actorId]!)!==d.sourceLifeId)return {ok:false,code:'INVALID_TARGET'};
 const source=c.source;let ids:string[],ownerId:string|undefined,zone:'hand'|'deck'|PublicZone;
 if(source.kind==='deck'){ids=state.deck.filter(id=>getAction(id)?.name===source.cardName);zone='deck';}
 else if(source.kind==='hand'){const p=state.players[source.ownerId];if(!p||p.presence==='otherworld')return {ok:false,code:'INVALID_TARGET'};ids=[...p.hand];ownerId=p.id;zone='hand';}
 else{const match=publicSources(state,d).find(o=>o.cardInstanceId===source.cardInstanceId);if(!match)return {ok:false,code:'INVALID_TARGET'};ids=[match.physicalId];ownerId=match.ownerId;zone=match.zone;}
 if(!ids.length)return {ok:false,code:'INVALID_TARGET'};
 const randomIndex=source.kind==='public'?undefined:Math.floor(random()*ids.length),id=ids[randomIndex??0]!;
 const s=structuredClone(state),saved=s.wishes!.find(x=>x.id===d.id)!,p=s.players[d.actorId]!;
 // Selection, shuffled remainder, transfer and result commit in the same accepted command.
 saved.acquisition={cardInstanceId:id,...(ownerId?{ownerId}:{}),zone,...(randomIndex!==undefined?{randomIndex}:{})};saved.stage='settling';
 if(zone==='deck')s.deck=shuffle(s.deck.filter(x=>x!==id),random);
 else {const old=s.players[ownerId!]!;if(zone==='hand'||zone==='open'||zone==='attachments')old[zone]=old[zone].filter(x=>x!==id);else old[zone]=old[zone].filter(x=>x.cardInstanceId!==id);}
 s.windows!.pop();const a=s.actions![d.actionId]!;enqueueLifecycle(s,{kind:'wish-complete',id:`${d.id}-complete`,decisionId:d.id,rootEventIds:[a.eventId]});
 const publicIdentity=source.kind==='public'&&!!publicSources(state,d).find(o=>o.cardInstanceId===source.cardInstanceId)?.publicIdentity;
 appendEvent(s,now,{type:'WISH_ACQUIRED',actorId:p.id,...(ownerId?{targetId:ownerId}:{}),audience:'public',...(publicIdentity?{cardInstanceId:id}:{})});
 // The private copies and the history are the same knowledge: the first copy's id names the entry, so a
 // reader can tell one acquisition from the next even when the same card is taken twice.
 if(!publicIdentity){(s.wishHistory??=[]).push({eventId:s.nextEventId,actorId:p.id,...(ownerId?{ownerId}:{}),cardInstanceId:id});
  for(const viewer of [...new Set([p.id,...(ownerId?[ownerId]:[])])])appendEvent(s,now,{type:'WISH_ACQUIRED',actorId:p.id,...(ownerId?{targetId:ownerId}:{}),audience:{playerId:viewer},cardInstanceId:id});}
 if(getAction(id)!.category==='open'){if(zone==='open')p.open.push(id);else revealOpen(s,p,id,random,now);}else p.hand.push(id);
 s.revision++;return {ok:true,state:s,events:[]};
}
