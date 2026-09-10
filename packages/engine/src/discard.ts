import type {GameState} from './state.js';
import {offerReclaim,type ReclaimSource} from './reclaim.js';
export const FAIRY_SWORD='a2-p04-r2c1';
export type DiscardOrigin=Extract<ReclaimSource,{kind:'actual-discard'}>['origin'];
export interface DiscardOccurrence {
  id:string;parentEventId:string;actorId:string;cardInstanceId:typeof FAIRY_SWORD;origin:DiscardOrigin;
  decisionId?:string;stage:'pending'|'open'|'closed';
}
/** Move the exact physical card first; record a sword occurrence only for that real movement. */
export function discardPhysical(s:GameState,cardInstanceId:string,origin:DiscardOrigin,actorId:string,eventId:string):boolean {
  const zone=origin.zone,p=origin.ownerId?s.players[origin.ownerId]:undefined;
  if(zone==='hand'||zone==='attachments'||zone==='open'){
    if(!p)return false;const at=p[zone].indexOf(cardInstanceId);if(at<0)return false;p[zone].splice(at,1);
  }else if(zone==='followers'||zone==='chants'){
    if(!p)return false;const at=p[zone].findIndex(c=>c.cardInstanceId===cardInstanceId);if(at<0)return false;p[zone].splice(at,1);
  }else if(zone==='distanceMarkers'){
    const entry=Object.entries(s.distanceMarkers??{}).find(([,m])=>m.cardInstanceId===cardInstanceId);if(!entry)return false;delete s.distanceMarkers![entry[0]];
  }else{
    const at=s[zone].indexOf(cardInstanceId);if(at<0)return false;s[zone].splice(at,1);
  }
  s.discard.push(cardInstanceId);
  if(cardInstanceId===FAIRY_SWORD)(s.discardOccurrences??=[]).push({id:`discard-${s.nextEventId++}`,parentEventId:eventId,actorId,cardInstanceId,origin:{...origin},stage:'pending'});
  return true;
}
export function discardPlayerCards(s:GameState,ownerId:string,actorId:string,eventId:string):void {
  const p=s.players[ownerId]!;
  for(const zone of ['hand','chants','followers','open','attachments'] as const){
    const ids=zone==='followers'||zone==='chants'?p[zone].map(c=>c.cardInstanceId):[...p[zone]];
    for(const id of ids)discardPhysical(s,id,{zone,ownerId},actorId,eventId);
  }
}
/** Discard responses precede any causally following lifecycle draw, Dawn, or rebuild. */
export function advanceDiscardResponses(s:GameState):boolean {
  for(const occurrence of s.discardOccurrences??[]){
    if(occurrence.stage==='closed')continue;
    if(occurrence.stage==='open'){
      if(s.reclaimDecisions?.find(d=>d.id===occurrence.decisionId)?.stage==='closed'){occurrence.stage='closed';continue;}
      return true;
    }
    const d=offerReclaim(s,{kind:'actual-discard',fromZone:'discard',eventId:occurrence.parentEventId,sourceId:occurrence.id,sourceActorId:occurrence.actorId,
      cardInstanceId:FAIRY_SWORD,discardEventId:occurrence.id,origin:occurrence.origin});
    occurrence.decisionId=d.id;occurrence.stage='open';return true;
  }
  return false;
}
