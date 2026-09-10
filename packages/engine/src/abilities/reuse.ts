import {getAction} from '@madou/catalog';
import {canUseCharacterAbility,hasPendingFatal,type GameState} from '../state.js';
import {canonicalOwnedNames} from '../reclaim-names.js';
import {commitReclaim,closeReclaim,advanceResponse,type ReclaimDecision,type ReclaimClaim} from '../reclaim.js';
import {openWindow} from '../reactions/windows.js';
import {lifeIdentity} from './suppression-state.js';
import {ownsAbility} from './ownership.js';
import type {AbilityFrame} from './frames.js';
import {REUSE_PACKAGES,type ReuseAbilityId} from './reuse-sources.js';
export interface ReuseContext {kind:'reclaim';decisionId:string;claimId:string;cardInstanceId:string;sourceCharacterId:string;ownerLifeId:string}
export function reuseClaims(s:GameState,ownerId:string,d:ReclaimDecision,acceptedClaimId?:string):ReclaimClaim[]{
 const p=s.players[ownerId],source=d.source,name=getAction(d.cardInstanceId)?.name;
 if(!p||!name||source.kind!=='ordinary-disposition'||source.sourceActorId!==p.id||lifeIdentity(p)!==source.sourceLifeId||(p.presence??'active')!=='active'||!canUseCharacterAbility(p,s)||hasPendingFatal(s,p.id)||['advance','distance','failed-morale'].includes(source.usedModeName??''))return [];
 return (Object.keys(REUSE_PACKAGES) as ReuseAbilityId[]).flatMap(abilityId=>{
  const rule=REUSE_PACKAGES[abilityId],id=`${d.id}-${p.id}-${abilityId}`,accepted=id===acceptedClaimId;
  if(!ownsAbility(p,abilityId)||rule.revealed&&!p.revealed||d.attemptedClaimIds.includes(id)&&!accepted||d.resolvedClaimIds.includes(id))return [];
  const death=source.trigger==='follower-died';
  if(rule.names?!rule.names.includes(name):(!death&&source.trigger!=='technique-resolved'||death&&!rule.followers||!canonicalOwnedNames(p,death?'follower':'technique').includes(name)))return [];
  if(rule.right==='extra'&&p.reclaimUsage?.[name]?.extraSpentByAbility.includes(abilityId)&&!accepted)return [];
  return [{id,declaringActorId:p.id,chooserId:p.id,beneficiaryId:p.id,beneficiaryLifeId:source.sourceLifeId,budgetOwnerId:p.id,normalizedName:name,right:rule.right,abilityId}];
 });
}
/** A server-issued finite claim selects the entire printed ability and consumes its attempt. */
export function beginReuse(s:GameState,d:ReclaimDecision,claim:ReclaimClaim):void{
 const p=s.players[claim.declaringActorId]!,abilityId=claim.abilityId!;
 if(claim.right==='extra'){const usage=p.reclaimUsage??={},entry=usage[claim.normalizedName]??={baseSpent:false,extraSpentByAbility:[]};entry.extraSpentByAbility.push(abilityId);}
 if(!d.claims.some(c=>c.id===claim.id))d.claims.push(claim);
 d.attemptedClaimIds.push(claim.id);d.selectedClaimId=claim.id;d.stage='ability-declaration';
 const f:AbilityFrame={source:'ability',id:`ability-${s.nextEventId++}`,abilityId,actorId:p.id,targetIds:[p.id],eventId:d.eventId,parentWindowId:d.windowId,useOrdinal:1,costs:{ownAction:false},stage:'declaration',canceled:false,rollIds:[],context:{kind:'reclaim',decisionId:d.id,claimId:claim.id,cardInstanceId:d.cardInstanceId,sourceCharacterId:p.characterId,ownerLifeId:lifeIdentity(p)}};
 (s.abilities??={})[f.id]=f;openWindow(s,'declaration',d.eventId,{kind:'ability',id:f.id});
}
/** Finish the saved response without resetting already answered seats in its parent window. */
export function resolveReuse(s:GameState,f:AbilityFrame):void{
 if(f.context.kind!=='reclaim')return;const context=f.context,d=s.reclaimDecisions?.find(d=>d.id===context.decisionId),p=s.players[f.actorId];
 f.stage='applied';delete s.abilities![f.id];
 if(!d||d.stage!=='ability-declaration'||d.selectedClaimId!==context.claimId)return;
 const live=!f.canceled&&p&&p.characterId===context.sourceCharacterId&&lifeIdentity(p)===context.ownerLifeId&&d.cardInstanceId===context.cardInstanceId&&reuseClaims(s,f.actorId,d,context.claimId).some(c=>c.id===context.claimId);
 if(live&&commitReclaim(s,d.id,context.claimId)){s.windows=s.windows!.filter(w=>w.id!==d.windowId);closeReclaim(s,d.id);return;}
 d.resolvedClaimIds.push(context.claimId);d.stage='responses';advanceResponse(s,d);
}
