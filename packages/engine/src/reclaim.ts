import {reuseClaims,beginReuse} from './abilities/reuse.js';
import {REUSE_ABILITIES,type ReuseAbilityId} from './abilities/reuse-sources.js';
import {discardPhysical} from './discard.js';
import {lifeIdentity} from './abilities/suppression-state.js';
import {hasPendingFatal,hasStatus, type GameState} from './state.js';
import {getAction} from '@madou/catalog';
import {canonicalOwnedNames} from './reclaim-names.js';
import {openWindow,participants,rootEventId,syncPriority} from './reactions/windows.js';
import type {GameCommand} from '@madou/protocol';
import type {EngineErrorCode} from './commands.js';
import {beginRoll} from './rolls/advance.js';

export interface ReclaimBudget {baseSpent:boolean;extraSpentByAbility:string[]}
/** Bind a nested physical disposition to its outer attack while parent links still exist. */
export function reclaimEventId(s:GameState,source:{eventId:string;parentWindowId:string|null}):string {
  return rootEventId(s,source);
}
export type ReclaimRight='base'|'extra'|'unlimited'|'printed';
export type ReclaimSource={eventId:string;sourceId:string;sourceActorId:string;cardInstanceId:string} & (
  {kind:'ordinary-disposition';fromZone:'resolution';sourceLifeId:string;
   trigger:'technique-resolved'|'follower-died'|'named-card-used';usedModeName?:string}
  | {kind:'courage-resolution';fromZone:'resolution';cardInstanceId:'a2-p01-r3c3';beneficiaryId:string;beneficiaryLifeId:string;cancellationSucceeded:true}
  | {kind:'actual-discard';fromZone:'discard';cardInstanceId:'a2-p04-r2c1';discardEventId:string;
     origin:{zone:'hand'|'attachments'|'deck'|'resolution'|'followers'|'chants'|'open'|'reclaimReservations'|'distanceMarkers';ownerId?:string}}
);
export interface ReclaimClaim {
  id:string;declaringActorId:string;chooserId:string;beneficiaryId:string;beneficiaryLifeId:string;abilityId?:ReuseAbilityId;
  budgetOwnerId?:string;normalizedName:string;right:ReclaimRight;printedRider?:'courage'|'fairy-sword';checkActorId?:string;
}
export interface ReclaimDecision {
  resume?:{kind:'followers';groupId:string;targetId:string}|{kind:'maai-payment';groupId:string;actorId:string;mode:'distance'|'advance';required:number;pendingCardInstanceIds?:string[];sourceLifeId?:string};resumed?:boolean;
  id:string;source:ReclaimSource;cardInstanceId:string;eventId:string;sourceId:string;sourceActorId:string;
  fromZone:'resolution'|'discard';stage:'responses'|'ability-declaration'|'printed-check'|'beneficiary-choice'|'reserved'|'closed';
  participants:string[];cursor:number;windowId:string;windowRevision:number;
  claims:ReclaimClaim[];attemptedClaimIds:string[];resolvedClaimIds:string[];checkAttempted:boolean;
  parentWindowId:string|null;
  selectedClaimId?:string;checkActorId?:string;checkRollId?:string;
  responseResume?:{participants:string[];cursor:number;passed:string[]};
}

function baseClaims(s:GameState,d:ReclaimDecision):ReclaimClaim[] {
  const source=d.source,p=s.players[source.sourceActorId];
  if(source.kind==='actual-discard')return [];
  const name=getAction(source.cardInstanceId)?.name;
  const sourceLifeId=source.kind==='courage-resolution'?source.beneficiaryLifeId:source.sourceLifeId;
  const kind=source.kind==='ordinary-disposition'&&source.trigger==='follower-died'?'follower':'technique';
  if(!p || !name || (p.presence??'active')!=='active' || lifeIdentity(p)!==sourceLifeId
    || source.kind==='ordinary-disposition'&&(source.trigger==='named-card-used'||source.usedModeName==='advance'||source.usedModeName==='distance')
    || !canonicalOwnedNames(p,kind).includes(name) || p.reclaimUsage?.[name]?.baseSpent)return [];
  return [{id:`${d.id}-${p.id}-base`,declaringActorId:p.id,chooserId:p.id,beneficiaryId:p.id,
    beneficiaryLifeId:sourceLifeId,budgetOwnerId:p.id,normalizedName:name,right:'base'}];
}

function eligibleClaims(s:GameState,d:ReclaimDecision):ReclaimClaim[] {
  if(d.stage==='beneficiary-choice')return d.claims.filter(c=>c.id===d.selectedClaimId&&c.printedRider==='courage');
  if(d.stage!=='responses')return [];
  const result=[...baseClaims(s,d),...reuseClaims(s,d.sourceActorId,d)],source=d.source;
  for(const id of d.participants){const p=s.players[id]!;
    if(!p.revealed||(p.presence??'active')!=='active'||hasStatus(p,'stopped')||hasPendingFatal(s,id))continue;
    if(source.kind==='courage-resolution'&&!d.checkAttempted&&p.characterId==='c2-p03-r2c1')result.push({
      id:`${d.id}-${id}-courage`,declaringActorId:id,chooserId:source.beneficiaryId,beneficiaryId:source.beneficiaryId,
      beneficiaryLifeId:source.beneficiaryLifeId,normalizedName:'勇気',right:'printed',printedRider:'courage',checkActorId:id});
    if(source.kind==='actual-discard'&&p.characterId==='c2-p01-r2c2'&&s.discard.includes(source.cardInstanceId))result.push({
      id:`${d.id}-${id}-sword`,declaringActorId:id,chooserId:id,beneficiaryId:id,beneficiaryLifeId:lifeIdentity(p),normalizedName:'ふぇありぃそぅど',right:'printed',printedRider:'fairy-sword'});
  }
  return result;
}

/** Offer every physical disposition publicly, including an empty private claim list. */
export function offerReclaim(s:GameState,source:ReclaimSource):ReclaimDecision {
  const previous=s.reclaimDecisions?.find(d=>d.sourceId===source.sourceId&&d.cardInstanceId===source.cardInstanceId);
  if(previous)return previous;
  const id=`reclaim-${s.nextEventId++}`;
  const w=openWindow(s,'reclaim',source.eventId,{kind:'reclaim',id},participants(s,s.seatOrder.indexOf(source.sourceActorId)));
  const d:ReclaimDecision={id,source:structuredClone(source),cardInstanceId:source.cardInstanceId,eventId:source.eventId,
    sourceId:source.sourceId,sourceActorId:source.sourceActorId,fromZone:source.fromZone,stage:'responses',
    participants:[...w.participants],cursor:0,windowId:w.id,windowRevision:w.revision,claims:[],attemptedClaimIds:[],resolvedClaimIds:[],checkAttempted:false,parentWindowId:w.parentId};
  d.claims=eligibleClaims(s,d);(s.reclaimDecisions??=[]).push(d);return d;
}

export function closeReclaim(s:GameState,id:string):void {
  const d=s.reclaimDecisions?.find(d=>d.id===id);if(!d||d.stage==='closed')return;
  if(d.stage!=='reserved'&&d.fromZone==='resolution') {
    discardPhysical(s,d.cardInstanceId,{zone:'resolution'},d.sourceActorId,d.eventId);
  }
  d.stage='closed';
}

export function syncReclaimWindow(s:GameState):void {
  for(const d of s.reclaimDecisions??[]) {
    const w=s.windows?.find(w=>w.id===d.windowId);if(!w)continue;
    d.cursor=w.cursor;d.windowRevision=w.revision;d.participants=[...w.participants];
  }
}

export function commitReclaim(s:GameState,decisionId:string,claimId:string):boolean {
  const d=s.reclaimDecisions?.find(d=>d.id===decisionId),w=s.windows?.at(-1);
  if(!d||!['responses','ability-declaration','beneficiary-choice'].includes(d.stage)||w?.id!==d.windowId)return false;
  const source=d.source;
  if(source.kind==='actual-discard'&&!s.discardOccurrences?.some(o=>o.id===source.discardEventId&&o.id===source.sourceId&&o.decisionId===d.id&&o.stage==='open'&&o.cardInstanceId===d.cardInstanceId))return false;
  const claim=(d.stage==='ability-declaration'?reuseClaims(s,d.sourceActorId,d,d.selectedClaimId):eligibleClaims(s,d)).find(c=>c.id===claimId);
  if(!claim||claim.chooserId!==w.participants[w.cursor]||claim.printedRider==='courage'&&d.stage!=='beneficiary-choice')return false;
  const beneficiary=s.players[claim.beneficiaryId];
  if(!beneficiary||(beneficiary.presence??'active')!=='active'||lifeIdentity(beneficiary)!==claim.beneficiaryLifeId)return false;
  if(!reserveReclaimCard(s,d.cardInstanceId,claim.beneficiaryId,d.eventId,claim.beneficiaryLifeId,d.fromZone))return false;
  if(claim.right==='base'&&claim.budgetOwnerId){const usage=s.players[claim.budgetOwnerId]!.reclaimUsage??={};
    usage[claim.normalizedName]={baseSpent:true,extraSpentByAbility:[...(usage[claim.normalizedName]?.extraSpentByAbility??[])]};}
  if(!d.claims.some(c=>c.id===claim.id))d.claims.push(claim);
  Object.assign(s.reclaim![d.cardInstanceId]!,{claimId:claim.id,decisionId:d.id,sourceId:d.sourceId,...(d.source.kind==='actual-discard'?{discardEventId:d.source.discardEventId}:{})});
  d.resolvedClaimIds.push(claim.id);d.stage='reserved';return true;
}

export function advanceResponse(s:GameState,d:ReclaimDecision):void {
  const w=s.windows?.find(w=>w.id===d.windowId);if(!w)return;
  if(d.stage==='beneficiary-choice'&&d.responseResume){
    w.participants=[...d.responseResume.participants];w.cursor=d.responseResume.cursor;w.passed=[...d.responseResume.passed];
    delete d.responseResume;d.stage='responses';
  }
  // A pass keeps the window generation; only an intervention invalidates the answers already given (G03).
  const actor=w.participants[w.cursor];if(actor&&!w.passed.includes(actor))w.passed.push(actor);syncPriority(w);syncReclaimWindow(s);
  if(w.cursor>=w.participants.length){s.windows=s.windows!.filter(x=>x.id!==w.id);closeReclaim(s,d.id);}
}
export function chooseReclaim(s:GameState,actorId:string,c:Extract<GameCommand,{type:'CHOOSE_RECLAIM'}>,dice:()=>number):EngineErrorCode|undefined {
  const w=s.windows?.at(-1),d=s.reclaimDecisions?.find(d=>d.id===c.decisionId);
  if(!w||w.kind!=='reclaim'||!d||d.windowId!==w.id||!['responses','beneficiary-choice'].includes(d.stage))return 'INVALID_TARGET';
  if(w.participants[w.cursor]!==actorId)return 'NOT_PRIORITY';
  if(c.choice==='decline') {advanceResponse(s,d);return;}
  if(c.choice==='request-check') {
    const claim=eligibleClaims(s,d).find(claim=>claim.id===c.claimId);
    if(d.stage!=='responses'||d.checkAttempted||claim?.printedRider!=='courage'||claim.checkActorId!==actorId)return 'INVALID_TARGET';
    if(!d.claims.some(c=>c.id===claim.id))d.claims.push(claim);
    d.selectedClaimId=claim.id;d.checkActorId=actorId;d.checkAttempted=true;d.attemptedClaimIds.push(claim.id);d.stage='printed-check';
    d.checkRollId=beginRoll(s,{eventId:d.eventId,rollerId:actorId,purpose:'activation',formula:'2d6',check:{modifier:0},resume:{kind:'reclaim-check',decisionId:d.id}},dice).id;
    return;
  }
  const abilityClaim=eligibleClaims(s,d).find(claim=>claim.id===c.claimId&&claim.abilityId);
  if(abilityClaim){if(abilityClaim.chooserId!==actorId)return 'INVALID_TARGET';beginReuse(s,d,abilityClaim);return;}
  if(!commitReclaim(s,d.id,c.claimId))return 'INVALID_TARGET';
  s.windows!.pop();closeReclaim(s,d.id);
}

export function resumeReclaimCheck(s:GameState,decisionId:string):void {
  const d=s.reclaimDecisions?.find(d=>d.id===decisionId);
  if(!d||d.stage!=='printed-check'||!d.checkAttempted)return;
  const roll=s.rolls?.find(r=>r.id===d.checkRollId),w=s.windows?.find(w=>w.id===d.windowId);
  if(roll?.stage!=='applied'||!w)return;
  if(!roll.success){d.stage='responses';advanceResponse(s,d);return;}
  const claim=d.claims.find(c=>c.id===d.selectedClaimId)!;
  d.responseResume={participants:[...w.participants],cursor:w.cursor,passed:[...w.passed]};
  d.stage='beneficiary-choice';w.participants=[claim.beneficiaryId];w.cursor=0;w.passed=[];w.revision++;syncReclaimWindow(s);
}

export function reclaimView(s:GameState,actorId:string) {
  const d=[...(s.reclaimDecisions??[])].reverse().find(d=>d.stage!=='closed');if(!d)return null;
  const w=s.windows?.find(w=>w.id===d.windowId);if(!w)return null;
  const pendingActorId=w.participants[w.cursor]!;
  const mine=pendingActorId===actorId&&s.windows?.at(-1)?.id===w.id&&['responses','beneficiary-choice'].includes(d.stage);
  return {decisionId:d.id,cardInstanceId:d.cardInstanceId,stage:d.stage,pendingActorId,canDecline:mine,
    claims:mine?eligibleClaims(s,d).filter(c=>(d.stage==='responses'&&c.printedRider==='courage'?c.checkActorId:c.chooserId)===actorId).map(c=>({claimId:c.id,right:c.right,
      label:c.abilityId?`${REUSE_ABILITIES[c.abilityId].name}で回収（${c.right==='extra'?'この名称は追加1回':'回数制限なし'}）`:c.printedRider==='courage'?(d.stage==='responses'?'レスターとして回収判定をする':'勇気を回収する'):c.printedRider==='fairy-sword'?'ふぇありぃそぅどを回収する':'通常回収（この名称は試合中1回）',
      action:(c.printedRider==='courage'&&d.stage==='responses'?'request-check':'take') as 'request-check'|'take'})):[]};
}

export interface ReclaimReservation {
  ownerId:string;
  eventId:string;
  /** Missing only in legacy saves made before life-bound reservations. */
  ownerLifeId?:string;claimId?:string;decisionId?:string;sourceId?:string;discardEventId?:string;
}

/** Move one physical source, never a snapshot, into the protected reservation zone. */
export function reserveReclaimCard(s:GameState, cardId:string, ownerId:string, eventId:string, ownerLifeId?:string,fromZone:'resolution'|'discard'='resolution'):boolean {
  const owner=s.players[ownerId], index=s[fromZone].indexOf(cardId);
  if (!owner || index<0 || s.reclaimReservations.includes(cardId) || s.reclaim?.[cardId]) return false;
  s[fromZone].splice(index,1);
  s.reclaimReservations.push(cardId);
  (s.reclaim??={})[cardId]={ownerId,eventId,ownerLifeId:ownerLifeId??lifeIdentity(owner)};
  return true;
}

export function eventPending(s:GameState,eventId:string):boolean {
  if(s.discardOccurrences?.some(d=>d.parentEventId===eventId&&d.stage!=='closed'))return true;
  if(s.reclaimDecisions?.some(d=>d.eventId===eventId&&d.stage!=='closed'))return true;
  if(Object.values(s.followerBundles??{}).some(b=>b.actionIds.includes(eventId)))return true;
  if (Object.values(s.actions??{}).some(a=>a.eventId===eventId)) return true;
  if (Object.values(s.abilities??{}).some(a=>a.eventId===eventId)) return true;
  if (s.windows?.some(w=>w.eventId===eventId)) return true;
  if (s.rolls?.some(r=>r.eventId===eventId && r.stage!=='applied')) return true;
  if (s.inspections?.some(d=>d.eventId===eventId)) return true;
  if (s.lifecycle?.some(t=>t.rootEventIds?.includes(eventId))) return true;
  return false;
}

/** Called after transition continuations settle, never by projection or a local action disposer. */
export function releaseReclaimReservations(s:GameState,eventId:string):void {
  if (eventPending(s,eventId)) return;
  for (const id of [...s.reclaimReservations]) {
    const reservation=s.reclaim?.[id];
    if (!reservation || reservation.eventId!==eventId) continue;
    const p=s.players[reservation.ownerId];
    const sameLife=!!p && lifeIdentity(p)===(reservation.ownerLifeId??`initial-life:${p.id}`);
    const alive=!!p && !['pending-death','dead','exited'].includes(p.presence??'active') && !hasPendingFatal(s,p.id);
    if (sameLife && alive){s.reclaimReservations.splice(s.reclaimReservations.indexOf(id),1);p.hand.push(id);}
    else discardPhysical(s,id,{zone:'reclaimReservations',ownerId:reservation.ownerId},reservation.ownerId,eventId);
    delete s.reclaim![id];
  }
}

export function finalizeReclaimReservations(s:GameState):void {
  for (const eventId of new Set(Object.values(s.reclaim??{}).map(r=>r.eventId))) releaseReclaimReservations(s,eventId);
}
