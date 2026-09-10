import {getCharacter} from '@madou/catalog';
import {canUseCharacterAbility,type GameState} from '../state.js';
import {isActive} from '../lifecycle/objectives.js';
import type {ActionFrame,AttackGroup,AttackTarget,Technique} from '../reactions/continuations.js';
import type {AbilityFrame,AbilityId,AbilityOption} from './frames.js';
import {ownsAbility} from './ownership.js';
export const DESTRUCTION_ABILITIES={
 'c2-p02-r2c1-ab02':'dragon',
 'c2-p02-r2c2-ab02':'white-sword',
 'c2-p04-r1c2-ab01':'wind-sword',
 'c2-p06-r1c1-ab03':'frenzy',
} as const;
export type DestructionAbilityId=keyof typeof DESTRUCTION_ABILITIES;
/** Selected provenance is never stored in printed Technique predicates. */
export interface SelectedDestructionModifier {abilityId:DestructionAbilityId;actorId:string}
export function isDestructionAbility(id:string):id is DestructionAbilityId{return Object.hasOwn(DESTRUCTION_ABILITIES,id);}
function active(s:GameState,m:SelectedDestructionModifier):boolean {const p=s.players[m.actorId];return !!p&&isActive(p)&&canUseCharacterAbility(p,s)&&ownsAbility(p,m.abilityId);}
function qualifies(t:Technique,id:DestructionAbilityId):boolean {
 switch(DESTRUCTION_ABILITIES[id]){
  case 'dragon':return t.school==='warrior';
  case 'white-sword':return t.attributes.includes('剣');
  case 'wind-sword':return t.attributes.includes('剣')||t.attributes.includes('風');
  case 'frenzy':return true;
 }
}
function actualAttack(a:ActionFrame):boolean{return !a.fixedReceivedEffect&&!a.followerOrigin&&(a.kind==='attack'||a.kind==='defense'&&a.technique.defense==='counter');}
function hitSource(s:GameState,g:AttackGroup,h:AttackTarget['hits'][number]):ActionFrame|undefined{return s.actions?.[h.sourceActionId??g.actionId];}
function groupQualifies(s:GameState,g:AttackGroup,id:DestructionAbilityId):boolean{return g.targets.some(t=>t.hits.some(h=>{const a=hitSource(s,g,h);return !!a&&a.actorId===g.attackerId&&actualAttack(a)&&qualifies(h.technique??a.technique,id);}));}
export function destructionAbilityOptions(s:GameState,actorId:string,add:(id:AbilityId,extra?:Partial<AbilityOption>)=>void):void {
 const w=s.windows?.at(-1);if(!w)return;
 if(w.kind==='damage'&&w.continuation.kind==='action'){
  const a=s.actions?.[w.continuation.id];const id='c2-p02-r2c2-ab02';
  if(a&&a.actorId===actorId&&!a.canceled&&!a.modifiers?.damageFrozen&&actualAttack(a)&&qualifies(a.technique,id)&&ownsAbility(s.players[actorId]!,id))add(id);
 }
 if(w.kind!=='attack-abilities'||w.continuation.kind!=='group')return;
 const g=s.groups?.[w.continuation.id];if(!g||g.attackerId!==actorId)return;
 for(const id of Object.keys(DESTRUCTION_ABILITIES) as DestructionAbilityId[])if(id!=='c2-p02-r2c2-ab02'&&ownsAbility(s.players[actorId]!,id)&&groupQualifies(s,g,id))add(id);
}
export function validDestructionAbility(s:GameState,f:AbilityFrame):boolean {
 if(!isDestructionAbility(f.abilityId))return false;
 if(f.context.kind==='action'){
  const a=s.actions?.[f.context.actionId];return f.abilityId==='c2-p02-r2c2-ab02'&&!!a&&!a.canceled&&a.actorId===f.actorId&&!a.modifiers?.damageFrozen&&actualAttack(a)&&qualifies(a.technique,f.abilityId);
 }
 if(f.context.kind!=='group')return false;
 const g=s.groups?.[f.context.groupId];return !!g&&g.attackerId===f.actorId&&g.stage==='defense'&&!g.targets.some(t=>t.followerStarted)&&groupQualifies(s,g,f.abilityId);
}
export function resolveDestructionAbility(s:GameState,f:AbilityFrame):void {
 if(!isDestructionAbility(f.abilityId))throw Error('INVALID_DESTRUCTION_ABILITY');
 const m={abilityId:f.abilityId,actorId:f.actorId};
 if(f.context.kind==='action')(s.actions![f.context.actionId]!.destructionModifiers??=[]).push(m);
 else if(f.context.kind==='group')(s.groups![f.context.groupId]!.destructionModifiers??=[]).push(m);
}
/** This component commits at numeric cutoff independently of live destruction. */
export function freezeDestructionDamage(s:GameState,a:ActionFrame):void {
 a.whiteSwordDamageMultiplier=!!a.destructionModifiers?.some(m=>m.abilityId==='c2-p02-r2c2-ab02'&&active(s,m));
}
export function destructionTargetMultiplier(s:GameState,a:ActionFrame,targetId:string):number {
 return !a.fixedReceivedEffect&&a.whiteSwordDamageMultiplier&&getCharacter(s.players[targetId]!.characterId)?.id==='c2-p06-r1c1'?2:1;
}
/** Compose a fresh effective value; intrinsic predicates are never removed on suppression. */
export function destructionTechnique(s:GameState,g:AttackGroup,t:AttackTarget,h:AttackTarget['hits'][number],base:Technique):Technique {
 if(t.followerDefense)return base;
 const a=hitSource(s,g,h);if(!a||!actualAttack(a))return base;
 const selected=[...(g.destructionModifiers??[]),...(a.destructionModifiers??[])].filter(m=>m.actorId===a.actorId&&active(s,m)&&qualifies(base,m.abilityId));
 if(!selected.length)return base;
 const result=structuredClone(base);
 for(const m of selected){
  const kind=DESTRUCTION_ABILITIES[m.abilityId];
  if(kind==='wind-sword')result.destroyFollowersAtOrBelow=Math.max(result.destroyFollowersAtOrBelow??-Infinity,6);
  else result.destroyFollowerAttributes=[...new Set([...(result.destroyFollowerAttributes??[]),...(kind==='dragon'?['竜']:kind==='white-sword'?['黒','死']:['人'])])];
 }
 return result;
}
/** Returned effects already include target damage and active incoming properties exactly once. */
export function fixedReflectedTechnique(incoming:Technique,damage:number|null):Technique {
 const result=structuredClone(incoming);result.hitCount=1;result.damage=damage;delete result.characterDamageMultipliers;return result;
}
/** Public game capabilities, never ability source identity. */
export function destructionEffects(t:Technique):string[] {
 const effects:string[]=[];
 if(t.destroyFollowerAttributes?.length)effects.push(`${t.destroyFollowerAttributes.join('・')}属性の従者を破壊`);
 if(t.destroyFollowerAttributesAtOrBelowEffectLevel?.length)effects.push(`効果Lv以下の${t.destroyFollowerAttributesAtOrBelowEffectLevel.join('・')}属性の従者を破壊`);
 if(t.destroyAllFollowers)effects.push('従者を破壊');
 if(t.destroyAllFollowersExceptAttributes)effects.push(`${t.destroyAllFollowersExceptAttributes.join('・')}属性以外の従者を破壊`);
 const exempt=t.destroyFollowerExemptAttributes?.length?`（${t.destroyFollowerExemptAttributes.join('・')}属性を除く）`:'';
 if(t.destroyFollowersAtOrBelow!==undefined)effects.push(`従者Lv${t.destroyFollowersAtOrBelow}以下を破壊${exempt}`);
 if(t.destroyFollowersAtOrBelowEffectLevel)effects.push(`効果Lv以下の従者を破壊${exempt}`);
 return effects;
}
