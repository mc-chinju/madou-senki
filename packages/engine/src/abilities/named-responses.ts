import type {GameState} from '../state.js';
import {currentHit} from '../reactions/continuations.js';
import {activeAbilitySource} from './follower-entry.js';
import {ABILITIES,type AbilityFrame,type AbilityId,type AbilityOption} from './frames.js';

export const MIRROR_HEART='c2-p01-r2c1-ab05';
export const SORROW='c2-p07-r1c1-ab02';
const RESPONSES=[MIRROR_HEART,SORROW,'c2-p01-r2c2-ab04','c2-p02-r1c1-ab03','c2-p02-r2c2-ab03','c2-p05-r1c1-ab03','c2-p06-r1c1-ab02'] as const;
const SHADOW='c2-p04-r2c2-ab01';
const MAJESTY='c2-p05-r2c2-ab02';
export function isNamedResponse(id:AbilityId):boolean{return (RESPONSES as readonly string[]).includes(id);}

/** The source frame, not the shared attack event, owns each response entitlement. */
function eligible(s:GameState,actorId:string,id:AbilityId,source:AbilityFrame):boolean {
 if(!activeAbilitySource(s,actorId,id)||source.stage!=='declaration'||source.canceled)return false;
 if(!s.windows?.some(w=>w.kind==='declaration'&&w.continuation.kind==='ability'&&w.continuation.id===source.id))return false;
 const responder=s.players[actorId]!;
 const owner=s.players[source.actorId];
 if(!owner||!activeAbilitySource(s,source.actorId,source.abilityId)||source.context.kind!=='group')return false;
 const context=source.context;
 const group=s.groups?.[context.groupId];
 const target=group?.targets.find(t=>t.actorId===context.targetId);
 const hit=group&&currentHit(group,context.targetId??undefined);
 if(!group||!target||!hit||hit.index!==context.hitIndex||hit.defended||target.followerStarted||context.targetId!==source.actorId)return false;
 if(id===MIRROR_HEART)return owner.revealed&&responder.revealed&&owner.characterId==='c2-p04-r2c2'&&source.abilityId===SHADOW;
 if(id===SORROW)return owner.revealed&&owner.characterId==='c2-p05-r2c2'&&source.abilityId===MAJESTY&&group.attackerId===actorId;
 const mental=owner.characterId===source.abilityId.slice(0,-5)&&['c2-p03-r2c1-ab01','c2-p06-r1c1-ab01','c2-p06-r1c2-ab01'].includes(source.abilityId);
 if(!mental)return false;
 if(id==='c2-p01-r2c2-ab04')return responder.revealed&&owner.revealed;
 if(group.attackerId!==actorId)return false;
 if(id==='c2-p02-r1c1-ab03')return owner.revealed&&source.abilityId==='c2-p06-r1c2-ab01';
 if(id==='c2-p02-r2c2-ab03')return true;
 if(id==='c2-p05-r1c1-ab03')return owner.revealed&&source.abilityId==='c2-p03-r2c1-ab01';
 return id==='c2-p06-r1c1-ab02'&&source.abilityId!=='c2-p06-r1c1-ab01';
}
export function namedResponseOptions(s:GameState,actorId:string):AbilityOption[] {
 const window=s.windows?.at(-1);
 if(window?.kind!=='declaration'||window.continuation.kind!=='ability')return [];
 const source=s.abilities?.[window.continuation.id];
 if(!source)return [];
 return RESPONSES
  .filter(id=>eligible(s,actorId,id,source)&&!s.used?.includes(`${source.id}:${actorId}:${id}`))
  .map(id=>({abilityId:id,name:ABILITIES[id].name,targetEventId:source.id,...(id!==MIRROR_HEART&&id!==SORROW?{description:'宣言中の特殊能力を取り消す。'}:{})}));
}
export function validNamedResponse(s:GameState,frame:AbilityFrame):boolean {
 if(frame.context.kind!=='ability-response')return false;
 const source=s.abilities?.[frame.context.sourceAbilityId];
 return !!source&&eligible(s,frame.actorId,frame.abilityId,source);
}
export function resolveNamedResponse(s:GameState,frame:AbilityFrame):void {
 if(frame.context.kind==='ability-response')s.abilities![frame.context.sourceAbilityId]!.canceled=true;
}
