import {canUseCharacterAbility,type GameState} from '../state.js';
import {isActive} from '../lifecycle/objectives.js';
import {ownsAbility} from './ownership.js';
import type {AbilityFrame,AbilityId,AbilityOption} from './frames.js';
import {currentHit,type ActionFrame,type AttackGroup,type AttackTarget,type Technique} from '../reactions/continuations.js';
export const LANCASTER_WIND='c2-p02-r2c1-ab01';
export const BLACK_BOW='c2-p03-r2c2-ab03';
export interface SelectedWind {abilityId:typeof LANCASTER_WIND;actorId:string}
export function actualPropertyAttack(a:ActionFrame):boolean {return !a.canceled&&!a.fixedReceivedEffect&&!a.followerOrigin&&(a.kind==='attack'||a.kind==='defense'&&a.technique.defense==='counter');}
function active(s:GameState,actorId:string,id:AbilityId):boolean {const p=s.players[actorId];return !!p&&isActive(p)&&canUseCharacterAbility(p)&&ownsAbility(p,id);}
function warriorSource(s:GameState,g:AttackGroup,h:AttackTarget['hits'][number],base:Technique):boolean {const a=s.actions?.[h.sourceActionId??g.actionId];return !!a&&actualPropertyAttack(a)&&a.actorId===g.attackerId&&base.school==='warrior';}
export function windAbilityOptions(s:GameState,actorId:string,add:(id:AbilityId,extra?:Partial<AbilityOption>)=>void):void {
 const w=s.windows?.at(-1);if(w?.kind!=='attack-abilities'||w.continuation.kind!=='group')return;
 const g=s.groups?.[w.continuation.id];if(g&&g.attackerId===actorId&&active(s,actorId,LANCASTER_WIND)&&g.targets.some(t=>t.hits.some(h=>warriorSource(s,g,h,h.technique??g.technique))))add(LANCASTER_WIND);
}
export function validWindAbility(s:GameState,f:AbilityFrame):boolean {if(f.context.kind!=='group')return false;const g=s.groups?.[f.context.groupId];return !!g&&g.attackerId===f.actorId&&g.stage==='defense'&&!g.targets.some(t=>t.followerStarted)&&g.targets.some(t=>t.hits.some(h=>warriorSource(s,g,h,h.technique??g.technique)));}
export function resolveWindAbility(s:GameState,f:AbilityFrame):void {if(f.context.kind==='group')s.groups![f.context.groupId]!.selectedWind={abilityId:LANCASTER_WIND,actorId:f.actorId};}
/** Provenance is separate from printed properties; each live hit resolves its actual source. */
export function attackPropertyTechnique(s:GameState,g:AttackGroup,t:AttackTarget,h:AttackTarget['hits'][number],base:Technique):Technique {
 if(t.followerDefense)return base;
 const a=s.actions?.[h.sourceActionId??g.actionId];if(!a||!actualPropertyAttack(a)||a.actorId!==g.attackerId)return base;
 const wind=g.selectedWind&&g.selectedWind.actorId===a.actorId&&active(s,a.actorId,LANCASTER_WIND)&&warriorSource(s,g,h,base);
 const bow=base.attributes.includes('弓')&&a.modifiers?.selected.some(m=>m.abilityId===BLACK_BOW&&m.actorId===a.actorId&&active(s,m.actorId,BLACK_BOW));
 return wind||bow?{...base,...(wind?{maaiRequired:(base.maaiRequired??1)+1}:{}),...(bow?{evadeProhibited:true}:{})}:base;
}
export interface MaaiDefenseView {groupId:string;attackerId:string;hitIndex:number;targetId:string|null;responding:boolean;sharedAdvances:number;targets:{actorId:string;hitIndex:number;required:number;prohibited:boolean;carried:number;submitted:number;effective:number;remaining:number;closed:boolean}[]}
/** Allowlisted public current-exchange counts; never expose physical submissions or private sources. */
export function maaiDefenseView(s:GameState,effectiveTechnique:(s:GameState,g:AttackGroup,t:AttackTarget,h:AttackTarget['hits'][number])=>Technique):MaaiDefenseView|null {
 const w=s.windows?.at(-1);if(!w||!['normal-defense','defense-advance'].includes(w.kind)||w.continuation.kind!=='group')return null;
 const g=s.groups?.[w.continuation.id];if(!g?.maai)return null;const exchange=g.maai;
 return {groupId:g.id,attackerId:g.attackerId,hitIndex:g.hitCursor,targetId:w.continuation.targetId,responding:w.kind==='defense-advance',sharedAdvances:exchange.advances.length,targets:g.targets.flatMap(t=>{
  const h=currentHit(g,t.actorId);if(!h)return [];const technique=effectiveTechnique(s,g,t,h);const required=technique.maaiRequired??1,carried=h.maaiProgress??0,submitted=exchange.submissions[t.actorId]?.length??0,effective=carried+Math.max(0,submitted-exchange.advances.length);
  return [{actorId:t.actorId,hitIndex:h.index,required,prohibited:!!technique.maaiProhibited,carried,submitted,effective,remaining:Math.max(0,required-effective),closed:t.normalDefenseClosed||h.defended||!!h.passedDefense}];
 })};
}
