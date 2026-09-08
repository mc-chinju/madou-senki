import {hasMentalDoubleGuard} from './mental-protection.js';
import {beginRoll} from '../rolls/advance.js';
import {replaceAllegiance} from '../lifecycle/objectives.js';
import {currentHit} from '../reactions/continuations.js';
import type {AttackGroup,AttackTarget} from '../reactions/continuations.js';
import type {GameState} from '../state.js';
import type {Faction} from '../lifecycle/types.js';
import {activeAbilitySource} from './follower-entry.js';
import type {AbilityFrame,AbilityId,AbilityOption} from './frames.js';

export const MENTAL_DEFENSES=['c2-p03-r2c1-ab01','c2-p06-r1c1-ab01','c2-p06-r1c2-ab01'] as const;
export type MentalDefenseId=typeof MENTAL_DEFENSES[number];
export function isMentalDefense(id:string):id is MentalDefenseId{return (MENTAL_DEFENSES as readonly string[]).includes(id);}
/** Printed counter permission is not a returned attack. Saved continuation lineage is. */
function ordinaryIncoming(s:GameState,g:AttackGroup,t:AttackTarget):boolean {
 const h=currentHit(g,t.actorId),a=s.actions?.[h?.sourceActionId??g.actionId];
 return !!a&&!a.resume&&!a.followerOrigin&&!a.abilityReflection&&g.attackerId!==t.actorId;
}
export function mentalDefenseOptions(s:GameState,actorId:string,add:(id:AbilityId,extra?:Partial<AbilityOption>)=>void):void {
 const w=s.windows?.at(-1);
 if(w?.kind!=='normal-defense'||w.continuation.kind!=='group'||w.continuation.targetId!==actorId)return;
 const g=s.groups?.[w.continuation.id],t=g?.targets.find(t=>t.actorId===actorId),h=g&&currentHit(g,actorId);
 if(!g||!t||!h||g.stage!=='defense'||t.normalDefenseClosed||t.followerStarted||h.defended||h.passedDefense||!ordinaryIncoming(s,g,t))return;
 for(const id of MENTAL_DEFENSES)if(activeAbilitySource(s,actorId,id)&&!t.mentalDefenseAttempts?.includes(id))add(id);
}
export function validMentalDefense(s:GameState,f:AbilityFrame):boolean {
 const c=f.context;if(c.kind!=='group'||c.targetId!==f.actorId)return false;
 const g=s.groups?.[c.groupId],t=g?.targets.find(t=>t.actorId===c.targetId),h=t?.hits.find(h=>h.index===c.hitIndex);
 return !!g&&!!t&&!!h&&g.stage==='defense'&&g.hitCursor===c.hitIndex&&!t.normalDefenseClosed&&!t.followerStarted&&!h.defended&&!h.passedDefense&&ordinaryIncoming(s,g,t);
}
export function mentalDefenseAttempt(s:GameState,f:AbilityFrame):void {
 if(!isMentalDefense(f.abilityId)||f.context.kind!=='group')return;
 const c=f.context,t=s.groups![c.groupId]!.targets.find(t=>t.actorId===c.targetId)!;
 (t.mentalDefenseAttempts??=[]).push(f.abilityId);
}
/** The final saved roll commits all clauses together; no second acceptance window. */
export function resolveMentalDefense(s:GameState,f:AbilityFrame,dice:()=>number):boolean {
 if(f.context.kind!=='group')throw Error('INVALID_MENTAL_CONTEXT');
 const c=f.context,g=s.groups![c.groupId]!,t=g.targets.find(t=>t.actorId===c.targetId)!;
 if(f.stage==='declaration'){
  f.stage='enemy-check';
  f.rollIds.push(beginRoll(s,{eventId:f.eventId,rollerId:g.attackerId,purpose:'ability-check',formula:'2d6',check:{modifier:-1},resume:{kind:'ability',abilityId:f.id}},dice).id);
  return false;
 }
 const roll=s.rolls!.find(r=>r.id===f.rollIds.at(-1))!;
 if(roll.stage!=='applied')return false;
 const doubles=!hasMentalDoubleGuard(s,f,roll.id)&&roll.faces.length===2&&roll.faces[0]===roll.faces[1];
 if(!roll.success||doubles)for(const hit of t.hits)if(hit.index>=c.hitIndex&&!hit.hit)hit.defended=true;
 if(!doubles)return true;
 const attacker=s.players[g.attackerId]!,source=s.players[f.actorId]!;
 (attacker.statuses??=[]).push({id:`${f.id}:stop`,kind:'stopped',timing:'next-own-seat',sourceActorId:f.actorId,sourceAbilityId:f.abilityId,expiresOnActorId:attacker.id,targetId:attacker.id});
 if(roll.faces[0]!==6)return true;
 if(f.abilityId==='c2-p06-r1c1-ab01'){
  (g.pendingFatalIntents??=[]).push({targetId:attacker.id,damage:0,instantDeath:true,cause:'instant-death',sourceActorId:source.id,groupId:g.id,actionId:g.actionId,eventId:f.eventId});
 }else{
  const lester=f.abilityId==='c2-p03-r2c1-ab01';
  const enemyFactions:Faction[]=lester?['EVIL']:(['GOOD','EVIL','ヴァンミール'] as Faction[]).filter(faction=>faction!==source.faction);
  replaceAllegiance(attacker,source.faction,{kind:'extinction',enemyFactions,label:lester?'EVILの全滅':'ディアと敵対するものの全滅'},{characterIds:[lester?'c2-p03-r1c2':'c2-p06-r1c2'],description:lester?'リーア姫の死亡':'愛しいディアの死亡'});
 }
 return true;
}
