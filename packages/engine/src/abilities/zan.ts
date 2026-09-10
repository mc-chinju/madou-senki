import {canUseCharacterAbility,type GameState} from '../state.js';
import {isActive} from '../lifecycle/objectives.js';
import {ownsAbility} from './ownership.js';
import {lifeIdentity} from './suppression-state.js';
import {actualPropertyAttack} from './attack-properties.js';
import {composeValue} from './action-modifiers.js';
import type {AttackGroup,AttackTarget} from '../reactions/continuations.js';
import type {AbilityFrame,AbilityId,AbilityOption} from './frames.js';
export const ZAN='c2-p04-r1c2-ab02';
export interface ZanSelection {abilityId:typeof ZAN;actorId:string;lifeId:string;sourceActionId:string;targetId:string;hitIndex:number}
function live(s:GameState,actorId:string){const p=s.players[actorId];return !!p&&isActive(p)&&canUseCharacterAbility(p,s)&&ownsAbility(p,ZAN);}
function eligible(s:GameState,g:AttackGroup,h:AttackTarget['hits'][number]){const a=s.actions?.[h.sourceActionId??g.actionId];return !h.defended&&!h.maaiWasSubmitted&&!h.zanSelection&&!!a&&actualPropertyAttack(a)&&a.actorId===g.attackerId&&(h.technique??a.technique).attributes.includes('剣');}
export function zanOptions(s:GameState,actorId:string,add:(id:AbilityId,extra?:Partial<AbilityOption>)=>void):void{
 const w=s.windows?.at(-1);if(w?.kind!=='follower-entry-abilities'||w.continuation.kind!=='group'||!live(s,actorId))return;const g=s.groups?.[w.continuation.id],targetId=w.continuation.targetId,t=g?.targets.find(t=>t.actorId===targetId);if(g&&g.attackerId===actorId&&t&&!t.followerStarted&&t.hits.some(h=>eligible(s,g,h)))add(ZAN);
}
export function validZan(s:GameState,f:AbilityFrame):boolean{if(f.context.kind!=='follower-entry')return false;const c=f.context,g=s.groups?.[c.groupId],t=g?.targets.find(t=>t.actorId===c.targetId);return !!g&&g.attackerId===f.actorId&&!!t&&!t.followerStarted&&isActive(s.players[t.actorId]!)&&t.hits.some(h=>eligible(s,g,h));}
export function resolveZan(s:GameState,f:AbilityFrame):void{if(f.context.kind!=='follower-entry')return;const c=f.context,g=s.groups![c.groupId]!,t=g.targets.find(t=>t.actorId===c.targetId)!;for(const h of t.hits)if(eligible(s,g,h))h.zanSelection={abilityId:ZAN,actorId:f.actorId,lifeId:lifeIdentity(s.players[f.actorId]!),sourceActionId:h.sourceActionId??g.actionId,targetId:t.actorId,hitIndex:h.index};}
/** Freeze conditional damage before any follower HP is deducted; later child resumes never multiply again. */
export function freezeZan(s:GameState,g:AttackGroup,t:AttackTarget):void{
 for(const h of t.hits){const z=h.zanSelection;if(!z||h.zanCommitted!==undefined)continue;const a=s.actions?.[h.sourceActionId??g.actionId];h.zanCommitted=!h.defended&&!h.maaiWasSubmitted&&!!a&&a.id===z.sourceActionId&&a.actorId===z.actorId&&actualPropertyAttack(a)&&z.targetId===t.actorId&&z.hitIndex===h.index&&live(s,z.actorId)&&lifeIdentity(s.players[z.actorId]!)===z.lifeId;
  if(h.zanCommitted){h.damage=composeValue(h.damage,null,[],[2]);h.damageMultiplier=(h.damageMultiplier??1)*2;}
 }
}
