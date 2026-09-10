import {printedHarpBonus} from '../effects/printed-combinations.js';
import {conditionalTechniqueAdditions} from './conditional-stats.js';
import {gameStats} from '../game-stats.js';
import {declarationNumbers} from './declaration-resolution.js';
import {actualPropertyAttack} from './attack-properties.js';
import {freezeDestructionDamage} from './follower-destruction.js';
import type {GameState} from '../state.js';
import {canUseCharacterAbility} from '../state.js';
import {isActive} from '../lifecycle/objectives.js';
import type {ActionFrame} from '../reactions/continuations.js';
import {ownsAbility} from './ownership.js';
import type {AbilityFrame,AbilityId,AbilityOption} from './frames.js';
import {beginRoll} from '../rolls/advance.js';
export const VALUE_ABILITIES = {
 'c2-p02-r1c2-ab03':'fairy-bow',
 'c2-p03-r2c2-ab03':'black-bow',
 'c2-p01-r1c1-ab02':'staff', 'c2-p01-r1c2-ab02':'fist', 'c2-p01-r2c1-ab03':'spirit',
 'c2-p03-r1c1-ab03':'axe', 'c2-p05-r1c1-ab02':'power',
} as const;
export type ValueAbilityId=keyof typeof VALUE_ABILITIES;
export interface SelectedActionModifier {abilityId:ValueAbilityId;actorId:string;amount?:number;damageRollId?:string;damageSkipped?:boolean}
export interface ActionModifiers {
 targetEffectLevels?:Record<string,number>;targetDamages?:Record<string,number|null>;
 declarationWarrior:number;usageRequirement:number;effectBase:number;prayerAddition:number;
 selected:SelectedActionModifier[];effectFrozen:boolean;damageFrozen:boolean;damageBase?:number|null;printedDamageDouble?:boolean;
}
export type CalculationReadiness={effectLevel:'pending'|'final';damage:'pending'|'final'};
export function isValueAbility(id:string):id is ValueAbilityId{return Object.hasOwn(VALUE_ABILITIES,id);}
export function realTechnique(a:ActionFrame):boolean{return !a.fixedReceivedEffect&&['attack','defense','turn-technique'].includes(a.kind)&&!a.followerOrigin&&a.technique.attributes.some(attribute=>attribute==='戦'||attribute==='魔');}
/** Saved at real acceptance, before any child can alter the actor's generic warrior level. */
export function acceptActionModifiers(s:GameState,a:ActionFrame):ActionModifiers {
 return a.modifiers??={declarationWarrior:gameStats(s,a.actorId,{provenance:{kind:'action',id:a.id}}).warrior_level,usageRequirement:a.technique.useLevel,effectBase:a.technique.effectLevel,prayerAddition:0,selected:[],effectFrozen:false,damageFrozen:false};
}
function live(s:GameState,m:SelectedActionModifier):boolean {const p=s.players[m.actorId];return !!p&&isActive(p)&&canUseCharacterAbility(p,s)&&ownsAbility(p,m.abilityId);}
function qualifies(a:ActionFrame,id:ValueAbilityId):boolean {
 const t=a.technique;
 switch(VALUE_ABILITIES[id]){
  case 'fairy-bow':return t.attributes.includes('弓');
  case 'black-bow':return actualPropertyAttack(a)&&t.attributes.includes('弓');
  case 'staff':return t.school==='magic';
  case 'fist':return t.attributes.includes('格');
  case 'spirit':return true;
  case 'power':return t.school==='magic'&&t.attributes.includes('黒');
  case 'axe':return t.school==='warrior'&&!t.attributes.includes('弓')&&!!a.modifiers&&a.modifiers.usageRequirement<=a.modifiers.declarationWarrior;
 }
}
export function actionModifierOptions(s:GameState,actorId:string,add:(id:AbilityId,extra?:Partial<AbilityOption>)=>void):void {
 const w=s.windows?.at(-1);if(w?.continuation.kind!=='action')return;
 const a=s.actions?.[w.continuation.id];if(!a||a.actorId!==actorId||a.canceled||!realTechnique(a))return;
 for(const id of Object.keys(VALUE_ABILITIES) as ValueAbilityId[]){
  const damage=VALUE_ABILITIES[id]==='axe';
  if(w.kind!==(damage?'damage':'effect-level')||(damage?a.modifiers?.damageFrozen:a.modifiers?.effectFrozen)||!ownsAbility(s.players[actorId]!,id)||!qualifies(a,id))continue;
  add(id);
 }
}
export function validActionModifier(s:GameState,f:AbilityFrame):boolean {
 if(f.context.kind!=='action'||!isValueAbility(f.abilityId))return false;
 const a=s.actions?.[f.context.actionId];return !!a&&!a.canceled&&a.actorId===f.actorId&&realTechnique(a)&&qualifies(a,f.abilityId)&&!(VALUE_ABILITIES[f.abilityId]==='axe'?a.modifiers?.damageFrozen:a.modifiers?.effectFrozen);
}
/** Return true when the ability is complete; rolls preserve the child until resumed. */
export function resolveActionModifier(s:GameState,f:AbilityFrame,dice:()=>number):boolean {
 if(f.context.kind!=='action'||!isValueAbility(f.abilityId))throw Error('INVALID_ACTION_MODIFIER');
 const a=s.actions![f.context.actionId]!;const kind=VALUE_ABILITIES[f.abilityId];
 if((kind==='spirit'||kind==='power'||kind==='fairy-bow')&&f.stage==='declaration'){
  f.stage=kind==='spirit'?'self-check':'numeric';
  f.rollIds.push(beginRoll(s,{eventId:f.eventId,rollerId:f.actorId,purpose:kind==='spirit'?'ability-check':'ability-value',beforeRoll:kind==='fairy-bow',formula:kind==='spirit'?'2d6':'d6',...(kind==='spirit'?{check:{modifier:0}}:{}),resume:{kind:'ability',abilityId:f.id}},dice).id);
  return false;
 }
 const roll=s.rolls?.find(r=>r.id===f.rollIds.at(-1));
 if(kind==='spirit'&&!roll?.success)return true;
 acceptActionModifiers(s,a).selected.push({abilityId:f.abilityId,actorId:f.actorId,...(kind==='power'||kind==='fairy-bow'?{amount:roll!.total!}:kind==='spirit'||kind==='staff'||kind==='black-bow'?{amount:1}:{})});
 refreshEffectLevel(s,a);return true;
}
/** Arithmetic helper: replacements precede additions; clamp/floor only at final multiplication. */
export function composeValue(base:number|null,floor:number|null,additions:number[],multipliers:number[]=[]):number|null {
 if(base===null)return null;
 return Math.max(0,Math.floor((Math.max(base,floor??base)+additions.reduce((sum,x)=>sum+x,0))*multipliers.reduce((product,x)=>product*x,1)));
}
export function effectPreview(s:GameState,a:ActionFrame,targetId:string|undefined=a.targetIds.length===1?a.targetIds[0]:undefined):number {
 const m=a.modifiers;if(!m||m.effectFrozen)return targetId?m?.targetEffectLevels?.[targetId]??a.technique.effectLevel:a.technique.effectLevel;
 const selected=m.selected.filter(x=>live(s,x));
 const floor=selected.some(x=>VALUE_ABILITIES[x.abilityId]==='fist')?gameStats(s,a.actorId,{provenance:{kind:'action',id:a.id}}).warrior_level:null;
 const declaration=declarationNumbers(s,a);
 return composeValue(declaration.replacement??m.effectBase,floor,[printedHarpBonus(a,'effect'),m.prayerAddition,declaration.effectAddition,conditionalTechniqueAdditions(s,a,targetId).effect,...selected.filter(x=>['staff','spirit','power','black-bow','fairy-bow'].includes(VALUE_ABILITIES[x.abilityId])).map(x=>x.amount??0)])!;
}
export function refreshEffectLevel(s:GameState,a:ActionFrame):void {a.technique.effectLevel=effectPreview(s,a);}
export function addPrayer(s:GameState,a:ActionFrame,amount:number):void {const m=acceptActionModifiers(s,a);m.prayerAddition+=amount;refreshEffectLevel(s,a);}
export function freezeEffectLevel(s:GameState,a:ActionFrame):void {const m=acceptActionModifiers(s,a);if(m.effectFrozen)return;m.targetEffectLevels=Object.fromEntries(a.targetIds.map(id=>[id,effectPreview(s,a,id)]));refreshEffectLevel(s,a);m.effectFrozen=true;}
/** Each selected modifier owns its later die; native damage and other sources keep their IDs. */
export function prepareModifierDamage(s:GameState,a:ActionFrame,dice:()=>number):boolean {
 for(const selected of a.modifiers?.selected??[]){
  const kind=VALUE_ABILITIES[selected.abilityId];if(!['fist','fairy-bow'].includes(kind)||selected.damageSkipped)continue;
  if(!selected.damageRollId){
   if(!live(s,selected)){selected.damageSkipped=true;continue;}
   selected.damageRollId=beginRoll(s,{eventId:a.eventId,rollerId:a.actorId,purpose:'ability-value',formula:'d6',beforeRoll:kind==='fairy-bow',resume:{kind:'action-value',actionId:a.id,value:'ability-damage'}},dice).id;return false;
  }
  if(s.rolls?.find(r=>r.id===selected.damageRollId)?.stage!=='applied')return false;
 }
 return true;
}
export function damagePreview(s:GameState,a:ActionFrame,targetId:string|undefined=a.targetIds.length===1?a.targetIds[0]:undefined):number|null {
 const m=a.modifiers;if(m?.damageFrozen)return targetId&&m.targetDamages&&Object.hasOwn(m.targetDamages,targetId)?m.targetDamages[targetId]!:a.technique.damage;
 const selected=m?.selected.filter(x=>live(s,x))??[];
 const numericAdditions=selected.filter(x=>['fist','fairy-bow'].includes(VALUE_ABILITIES[x.abilityId])&&!x.damageSkipped).map(x=>s.rolls?.find(r=>r.id===x.damageRollId)).filter(r=>r?.stage==='applied').map(r=>r!.total??0);
 const declaration=declarationNumbers(s,a);
 const p=s.players[a.actorId]!,chamHalf=realTechnique(a)&&a.technique.school==='warrior'&&p.characterId==='c2-p01-r2c2'&&!p.attachments.includes('a2-p04-r2c1')?0.5:1;
 return composeValue(m?.damageBase!==undefined?m.damageBase:a.technique.damage,null,[printedHarpBonus(a,'damage'),conditionalTechniqueAdditions(s,a,targetId).damage,declaration.damageAddition,a.technique.damageAdditive??0,selected.some(x=>VALUE_ABILITIES[x.abilityId]==='black-bow')?2:0,...numericAdditions],
  [declaration.damageMultiplier,a.technique.damageMultiplier??1,a.fromChant?a.technique.chantDamageMultiplier??1:1,selected.some(x=>VALUE_ABILITIES[x.abilityId]==='axe')?2:1,m?.printedDamageDouble?2:1,chamHalf]);
}
export function freezeDamage(s:GameState,a:ActionFrame):void {const m=acceptActionModifiers(s,a);if(m.damageFrozen)return;m.targetDamages=Object.fromEntries(a.targetIds.map(id=>[id,damagePreview(s,a,id)]));a.technique.damage=damagePreview(s,a);freezeDestructionDamage(s,a);m.damageFrozen=true;}
export function calculationReadiness(a:ActionFrame):CalculationReadiness{return {effectLevel:a.modifiers?.effectFrozen?'final':'pending',damage:a.modifiers?.damageFrozen?'final':'pending'};}
