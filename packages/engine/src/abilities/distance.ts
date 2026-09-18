import {recordAbility} from '../public-record.js';
import {canUseCharacterAbility,type GameState} from '../state.js';
import {isActive} from '../lifecycle/objectives.js';
import {ownsAbility} from './ownership.js';
import {lifeIdentity} from './suppression-state.js';
import {effectiveHitTechnique} from './follower-entry.js';
import {currentHit,type AttackGroup,type ActionFrame} from '../reactions/continuations.js';
import {openWindow,participants} from '../reactions/windows.js';
import {ABILITIES,type AbilityFrame} from './frames.js';
export const MAAI_ABILITIES=['c2-p01-r2c2-ab01','c2-p02-r1c1-ab01','c2-p02-r2c1-ab03'] as const;
export type MaaiAbilityId=typeof MAAI_ABILITIES[number];
export interface MaaiElection {abilityId:MaaiAbilityId;actorId:string;lifeId:string;sourceActionId:string;originalAttackerId:string;returnedCounter:boolean}
export interface MaaiContext {kind:'maai';groupId:string;targetId:string;hitIndex:number;cardInstanceId:string;required:number;pendingCardInstanceIds?:string[];election:MaaiElection}
function live(s:GameState,actorId:string,id:MaaiAbilityId){const p=s.players[actorId];return !!p&&isActive(p)&&canUseCharacterAbility(p,s)&&ownsAbility(p,id);}
function returnedCounter(s:GameState,g:AttackGroup,actorId:string){const a=s.actions?.[g.actionId];return a?.kind==='attack'&&!a.fixedReceivedEffect&&a.technique.defense==='counter'&&!!a.resume&&s.groups?.[a.resume.groupId]?.attackerId===actorId;}
export function maaiAbilityOptions(s:GameState,actorId:string):{abilityId:MaaiAbilityId;name:string}[]{
 const w=s.windows?.at(-1);
 if(!w&&s.phase==='withdrawal'&&s.seatOrder[s.turnSeat]===actorId)return distanceOptions(s,actorId);
 if(w&&(w.kind==='approach'||w.kind==='withdrawal')&&w.continuation.kind==='action'&&w.participants[w.cursor]===actorId){const a=s.actions?.[w.continuation.id];if(a&&actorId===(a.distanceMode==='approach'?a.distanceTargetId:a.actorId))return distanceOptions(s,actorId,a);}
 if(w?.kind!=='normal-defense'||w.participants[w.cursor]!==actorId||w.continuation.kind!=='group'||w.continuation.targetId!==actorId)return [];
 const g=s.groups?.[w.continuation.id],t=g?.targets.find(t=>t.actorId===actorId),h=g&&currentHit(g,actorId);if(!g||!t||!h||h.defended||h.passedDefense||t.normalDefenseClosed||t.followerStarted||h.maaiElection||effectiveHitTechnique(s,g,t,h).maaiProhibited)return [];
 return MAAI_ABILITIES.filter(id=>live(s,actorId,id)&&!s.used?.includes(`${w.eventId}:${actorId}:${id}`)&&(id!=='c2-p02-r2c1-ab03'||returnedCounter(s,g,actorId))).map(abilityId=>({abilityId,name:ABILITIES[abilityId].name}));
}
/** Called only after finite offer validation and physical payment, retaining the original response. */
export function beginMaaiAbility(s:GameState,g:AttackGroup,actorId:string,cardInstanceId:string,abilityId:MaaiAbilityId,required:number,pendingCardInstanceIds:string[]=[]):void {
 const w=s.windows!.at(-1)!,a=s.actions![g.actionId]!,parent=a.resume&&s.groups?.[a.resume.groupId];
 const election:MaaiElection={abilityId,actorId,lifeId:lifeIdentity(s.players[actorId]!),sourceActionId:a.id,originalAttackerId:parent?.attackerId??g.attackerId,returnedCounter:returnedCounter(s,g,actorId)};
 const f:AbilityFrame={source:'ability',id:`ability-${s.nextEventId++}`,abilityId,actorId,targetIds:[actorId],eventId:w.eventId,parentWindowId:w.id,useOrdinal:1,costs:{cardInstanceId,ownAction:false},stage:'declaration',canceled:false,rollIds:[],context:{kind:'maai',groupId:g.id,targetId:actorId,hitIndex:g.hitCursor,cardInstanceId,required,...(pendingCardInstanceIds.length?{pendingCardInstanceIds:[...pendingCardInstanceIds]}:{}),election}};
 (s.abilities??={})[f.id]=f;(s.used??=[]).push(`${w.eventId}:${actorId}:${abilityId}`);
 recordAbility(s,'ABILITY_DECLARED',actorId,abilityId);
 openWindow(s,'declaration',w.eventId,{kind:'ability',id:f.id},participants(s,(s.seatOrder.indexOf(actorId)+1)%s.seatOrder.length));
}
export function resolveMaaiAbility(s:GameState,f:AbilityFrame):void {
 if(f.context.kind!=='maai')return;const c=f.context,g=s.groups?.[c.groupId],t=g?.targets.find(t=>t.actorId===c.targetId),h=t?.hits.find(h=>h.index===c.hitIndex);
 if(f.canceled||!g||!t||!h||g.hitCursor!==c.hitIndex||h.defended||h.passedDefense||t.followerStarted||!live(s,f.actorId,c.election.abilityId)||lifeIdentity(s.players[f.actorId]!)!==c.election.lifeId)return;
 h.maaiElection=c.election;
 const technique=effectiveHitTechnique(s,g,t,h);if(f.abilityId==='c2-p02-r1c1-ab01'&&technique.school==='magic'&&technique.attributes.includes('地'))h.defended=true;
}
/** null means the elected returned-counter maai cannot be canceled by advances. */
export function maaiAdvanceFactor(s:GameState,g:AttackGroup,actorId:string):number|null {
 const e=currentHit(g,actorId)?.maaiElection;
 if(!e||!live(s,actorId,e.abilityId)||lifeIdentity(s.players[actorId]!)!==e.lifeId)return 1;
 return e.abilityId==='c2-p02-r2c1-ab03'&&e.returnedCounter?null:2;
}
export function uncanceledMaai(s:GameState,g:AttackGroup,actorId:string):number {
 const n=g.maai?.submissions[actorId]?.length??0,factor=maaiAdvanceFactor(s,g,actorId);
 return factor===null?n:Math.max(0,n-Math.floor((g.maai?.advances.length??0)/factor));
}
export function maaiAdvanceLimit(s:GameState,g:AttackGroup):number {
 return Math.max(0,...g.targets.map(t=>{const h=currentHit(g,t.actorId),factor=maaiAdvanceFactor(s,g,t.actorId);return !h||h.defended||h.passedDefense||t.normalDefenseClosed||factor===null?0:(g.maai?.submissions[t.actorId]?.length??0)*factor;}));
}

export interface DistanceMaaiContext {kind:'distance-maai';actionId:string;election:MaaiElection}
function distanceOptions(s:GameState,actorId:string,a?:ActionFrame):{abilityId:MaaiAbilityId;name:string}[]{return a?.distanceElection?[]:MAAI_ABILITIES.filter(id=>id!=='c2-p02-r2c1-ab03'&&live(s,actorId,id)&&(!a||!s.used?.includes(`${a.eventId}:${actorId}:${id}`))).map(abilityId=>({abilityId,name:ABILITIES[abilityId].name}));}
export function distanceAdvanceFactor(s:GameState,a:ActionFrame):number {const e=a.distanceElection;return e&&live(s,e.actorId,e.abilityId)&&lifeIdentity(s.players[e.actorId]!)===e.lifeId?2:1;}
export function startDistanceMaai(s:GameState,a:ActionFrame,actorId:string):void {
 a.distanceMaai={actorId,advanceActorId:actorId===a.actorId?a.distanceTargetId!:a.actorId,advanceBaseline:a.distanceAdvances?.length??0,responseComplete:false};
 syncDistanceMaai(s);
}
export function beginDistanceMaaiAbility(s:GameState,a:ActionFrame,actorId:string,cardInstanceId:string,abilityId:MaaiAbilityId):void {
 const w=s.windows!.at(-1)!,election:MaaiElection={abilityId,actorId,lifeId:lifeIdentity(s.players[actorId]!),sourceActionId:a.id,originalAttackerId:a.actorId,returnedCounter:false};
 const f:AbilityFrame={source:'ability',id:`ability-${s.nextEventId++}`,abilityId,actorId,targetIds:[actorId],eventId:a.eventId,parentWindowId:w.id,useOrdinal:1,costs:{cardInstanceId,ownAction:false},stage:'declaration',canceled:false,rollIds:[],context:{kind:'distance-maai',actionId:a.id,election}};
 (s.abilities??={})[f.id]=f;(s.used??=[]).push(`${a.eventId}:${actorId}:${abilityId}`);recordAbility(s,'ABILITY_DECLARED',actorId,abilityId);openWindow(s,'declaration',a.eventId,{kind:'ability',id:f.id},participants(s,(s.seatOrder.indexOf(actorId)+1)%s.seatOrder.length));
}
export function resolveDistanceMaaiAbility(s:GameState,f:AbilityFrame):void {if(f.context.kind!=='distance-maai')return;const c=f.context,a=s.actions?.[c.actionId];if(!a||f.canceled||!live(s,f.actorId,c.election.abilityId)||lifeIdentity(s.players[f.actorId]!)!==c.election.lifeId)return;a.distanceElection=c.election;}
/** Commit a completed response once; later suppression never rewinds already answered exchanges. */
export function syncDistanceMaai(s:GameState):void {
 const w=s.windows?.at(-1);if(!w||!['approach','withdrawal'].includes(w.kind)||w.continuation.kind!=='action')return;
 const a=s.actions?.[w.continuation.id],m=a?.distanceMaai;if(!a||!m)return;
 if(!m.responseComplete&&(a.distanceAdvances?.length??0)-m.advanceBaseline>=distanceAdvanceFactor(s,a))m.responseComplete=true;
 const actor=m.responseComplete?m.actorId:m.advanceActorId;if(w.participants.length!==1||w.participants[0]!==actor||w.cursor!==0){w.participants=[actor];w.cursor=0;w.passed=[];w.revision++;}a.distanceNextActorId=actor;
}
export function distanceExchangeView(s:GameState){const w=s.windows?.at(-1);if(!w||!['approach','withdrawal'].includes(w.kind)||w.continuation.kind!=='action')return null;const a=s.actions?.[w.continuation.id],m=a?.distanceMaai;if(!a||!m)return null;return {actionId:a.id,maaiActorId:m.actorId,advanceActorId:m.advanceActorId,requiredAdvances:distanceAdvanceFactor(s,a),paidAdvances:(a.distanceAdvances?.length??0)-m.advanceBaseline,responseComplete:m.responseComplete};}
