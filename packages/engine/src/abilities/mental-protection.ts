import type {GameState} from '../state.js';
import type {AttackGroup,AttackTarget,Technique} from '../reactions/continuations.js';
import {currentHit} from '../reactions/continuations.js';
import {activeAbilitySource,effectiveHitTechnique} from './follower-entry.js';
import {ABILITIES,type AbilityFrame,type AbilityId,type AbilityOption} from './frames.js';
import {isMentalDefense,validMentalDefense} from './mental-defense.js';
export const GARWIN_TENACITY='c2-p05-r2c1-ab02';
export const GAD_DEAD='c2-p06-r1c1-ab02';
const GUARDS=['c2-p01-r1c2-ab04','c2-p01-r2c1-ab04',GARWIN_TENACITY] as const;
export function isMentalProtection(id:AbilityId):boolean{return id===GAD_DEAD||(GUARDS as readonly string[]).includes(id);}
/** A single source invocation and its saved roll survive reroll generations. */
function guardSource(s:GameState,sourceId:string,rollId:string,actorId:string):AbilityFrame|undefined {
 const source=s.abilities?.[sourceId],roll=s.rolls?.find(r=>r.id===rollId);
 if(!source||!isMentalDefense(source.abilityId)||source.canceled||source.stage!=='enemy-check'||!validMentalDefense(s,source)||!activeAbilitySource(s,source.actorId,source.abilityId)||!roll||roll.stage!=='after-roll'||roll.rollerId!==actorId||roll.resume.kind!=='ability'||roll.resume.abilityId!==source.id||source.rollIds.at(-1)!==rollId)return;
 return source;
}
function applicable(id:AbilityId,technique:Technique):boolean {
 return technique.attributes.includes('精')&&!(id===GAD_DEAD&&technique.characterImmunityExceptions?.some(e=>e.characterName==='不死王ガドューラ'&&e.immunity==='spirit-techniques'));
}
export function mentalProtectionOptions(s:GameState,actorId:string):AbilityOption[]{
 const w=s.windows?.at(-1);if(!w)return [];
 if(w.kind==='after-roll'&&w.continuation.kind==='roll'){
  const roll=s.rolls?.find(r=>r.id===w.continuation.id);if(!roll||roll.resume.kind!=='ability')return [];
  const source=guardSource(s,roll.resume.abilityId,roll.id,actorId);if(!source)return [];
  return GUARDS.filter(id=>activeAbilitySource(s,actorId,id)&&!s.used?.includes(`${source.id}:${actorId}:${id}`)).map(id=>({abilityId:id,name:ABILITIES[id].name,targetEventId:source.id,description:'今回の精神力判定のゾロ目による追加効果を無効にする（通常失敗は有効）。'}));
 }
 if(w.kind!=='normal-defense'||w.continuation.kind!=='group'||w.continuation.targetId!==actorId)return [];
 const g=s.groups?.[w.continuation.id],t=g?.targets.find(t=>t.actorId===actorId),h=g&&currentHit(g,actorId);
 if(!g||!t||!h||g.attackerId===actorId||g.stage!=='defense'||t.normalDefenseClosed||t.followerStarted||h.defended||h.passedDefense)return [];
 return ([GARWIN_TENACITY,GAD_DEAD] as const).filter(id=>activeAbilitySource(s,actorId,id)&&!h.mentalProtectionAttempts?.includes(id)&&applicable(id,effectiveHitTechnique(s,g,t,h))).map(id=>({abilityId:id,name:ABILITIES[id].name,targetEventId:w.eventId,description:id===GARWIN_TENACITY?'今回受ける精神技による停止だけを防ぐ。ダメージや抵抗判定は残る。':'今回受ける精神技の効果をすべて無効にする。'}));
}
export function validMentalProtection(s:GameState,f:AbilityFrame):boolean {
 const c=f.context;
 if(c.kind==='mental-guard')return !!guardSource(s,c.sourceAbilityId,c.rollId,f.actorId);
 if(c.kind!=='group'||c.targetId!==f.actorId)return false;
 const g=s.groups?.[c.groupId],t=g?.targets.find(t=>t.actorId===c.targetId),h=t?.hits.find(h=>h.index===c.hitIndex);
 return !!g&&!!t&&!!h&&g.stage==='defense'&&g.hitCursor===c.hitIndex&&!t.normalDefenseClosed&&!t.followerStarted&&!h.defended&&!h.passedDefense&&applicable(f.abilityId,effectiveHitTechnique(s,g,t,h));
}
export function mentalProtectionAttempt(s:GameState,f:AbilityFrame):void {
 if(!isMentalProtection(f.abilityId)||f.context.kind!=='group')return;
 const c=f.context,h=s.groups![c.groupId]!.targets.find(t=>t.actorId===c.targetId)!.hits.find(h=>h.index===c.hitIndex)!;
 (h.mentalProtectionAttempts??=[]).push(f.abilityId);
}
export function resolveMentalProtection(s:GameState,f:AbilityFrame):void {
 const c=f.context;
 if(c.kind==='mental-guard'){
  const source=s.abilities![c.sourceAbilityId]!;(source.mentalGuards??=[]).push({actorId:f.actorId,abilityId:f.abilityId,rollId:c.rollId});return;
 }
 if(c.kind!=='group')return;
 const h=s.groups![c.groupId]!.targets.find(t=>t.actorId===c.targetId)!.hits.find(h=>h.index===c.hitIndex)!;
 if(f.abilityId===GAD_DEAD)h.defended=true;
 else h.mentalStopReserved=true;
}
export function hasMentalDoubleGuard(s:GameState,f:AbilityFrame,rollId:string):boolean {
 return f.mentalGuards?.some(guard=>guard.rollId===rollId&&activeAbilitySource(s,guard.actorId,guard.abilityId))??false;
}
/** Called at each producer's status commit, never used to remove an existing stop.
 * Omitted hit means the group's status producer: each reached hit of that exact
 * source must be protected. Mixed source slots do not borrow the head's 精. */
export function preventsMentalStop(s:GameState,g:AttackGroup,t:AttackTarget,hit?:AttackTarget['hits'][number]):boolean {
 const hits=hit?[hit]:t.hits.filter(h=>!h.defended&&(!h.sourceActionId||h.sourceActionId===g.actionId));
 return hits.length>0&&hits.every(h=>h.mentalStopCommitted||!!h.mentalStopReserved&&activeAbilitySource(s,t.actorId,GARWIN_TENACITY)&&effectiveHitTechnique(s,g,t,h).attributes.includes('精'));
}
export function commitMentalStopPrevention(s:GameState,g:AttackGroup,t:AttackTarget,hit?:AttackTarget['hits'][number]):boolean {
 if(!preventsMentalStop(s,g,t,hit))return false;
 for(const h of hit?[hit]:t.hits.filter(h=>!h.defended&&(!h.sourceActionId||h.sourceActionId===g.actionId)))h.mentalStopCommitted=true;
 return true;
}
