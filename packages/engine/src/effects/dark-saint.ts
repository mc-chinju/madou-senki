import {hasPendingFatal,type GameState} from '../state.js';
import {isActive} from '../lifecycle/objectives.js';
import type {AttackGroup,AttackTarget,Technique} from '../reactions/continuations.js';
const DIA='c2-p06-r1c2';
/** Printed card permission, independent of character-ability suppression and hidden follower identity. */
export function canChooseDarkSaintIgnore(s:GameState,actorId:string):boolean {
 const w=s.windows?.at(-1);
 if(w?.kind!=='follower-entry-abilities'||w.continuation.kind!=='group'||w.participants[w.cursor]!==actorId)return false;
 const g=s.groups?.[w.continuation.id],p=s.players[actorId];
 if(!g||!p||g.attackerId!==actorId||p.characterId!==DIA||!isActive(p)||hasPendingFatal(s,actorId)||s.actions?.[g.actionId]?.fixedReceivedEffect)return false;
 const targetId=w.continuation.targetId,t=g.targets.find(t=>t.actorId===targetId);
 return !!t&&!t.followerStarted&&t.darkSaintIgnoreChoice===undefined&&s.players[t.actorId]!.followers.length>0;
}
/** Freeze only this target's printed permission into its hits; reflected hits retain the same effect. */
export function darkSaintIgnoreTechnique(s:GameState,g:AttackGroup,t:AttackTarget,technique:Technique):Technique {
 const p=s.players[g.attackerId];
 return t.darkSaintIgnoreChoice&&p?.characterId===DIA&&isActive(p)&&!s.actions?.[g.actionId]?.fixedReceivedEffect?{...technique,ignoreDarkSaint:true}:technique;
}
