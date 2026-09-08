import {gameStats} from '../game-stats.js';
import {receivedTechnique} from './received-defense.js';
import {attackPropertyTechnique} from './attack-properties.js';
import {beastTechnique,liveBeastSelection} from './beast-empathy.js';
import {destructionTechnique} from './follower-destruction.js';
import {getAction} from '@madou/catalog';
import {canUseCharacterAbility,type GameState} from '../state.js';
import {isActive} from '../lifecycle/objectives.js';
import {followerBottomFor} from '../effects/follower-attacks.js';
import {techniqueFor} from '../effects/registry.js';
import type {AttackGroup,AttackTarget,Technique} from '../reactions/continuations.js';
import type {AbilityFrame,AbilityId,AbilityOption,AbilityEffectId} from './frames.js';
import {ownsAbility} from './ownership.js';
export const ARNES_GUARD='c2-p03-r2c2-ab02';
export const LESTER_ILLUSION='c2-p03-r2c1-ab02';
export const TIA_SURPRISE='c2-p02-r1c1-ab02';
export const ILLUSION_EFFECTS: {id:AbilityEffectId;name:string}[]=[
 {id:'spirit-conversion',name:'技に精属性を追加'},
 {id:'human-invalidation',name:'物理の人従者を無効'},
 {id:'arnes-suppression',name:'公開済みアーネスの仮想親衛隊を無効'},
];
export function activeAbilitySource(s:GameState,actorId:string,id:AbilityId):boolean {
 const p=s.players[actorId];return !!p&&isActive(p)&&canUseCharacterAbility(p)&&ownsAbility(p,id);
}
/** Per-hit actual source; never reuse the first source's printed level for a bundle. */
export function qualifiesForSpirit(s:GameState,g:AttackGroup,h:AttackTarget['hits'][number],magicLevel:number):boolean {
 const action=s.actions?.[h.sourceActionId??g.actionId];
 const sourceId=h.sourceCardInstanceId??action?.effectSourceCardInstanceId??action?.cardInstanceId;
 const printed=sourceId?techniqueFor(sourceId)??followerBottomFor(sourceId):undefined;
 if(!printed)return false;
 const printedLevel=printed.useLevelSource||printed.effectLevelFormula?(h.technique??g.technique).useLevel:printed.useLevel;
 return printedLevel<=magicLevel;
}
export function spiritTechnique(technique:Technique):Technique {
 return {...structuredClone(technique),attributes:[...new Set([...technique.attributes,'精'])]};
}
export function illusionActive(s:GameState,g:AttackGroup,effect:AbilityEffectId):boolean {
 return !!g.illusion&&g.illusion.effectIds.includes(effect)&&activeAbilitySource(s,g.illusion.actorId,LESTER_ILLUSION);
}
/** Acceptance qualifies hits once; only the added modifier remains live until snapshot. */
export function effectiveHitTechnique(s:GameState,g:AttackGroup,t:AttackTarget,h:AttackTarget['hits'][number]):Technique {
 const technique=receivedTechnique(h,h.technique??g.technique);
 const liveSpirit=t.followerDefense||!h.illusionSpiritAdded||illusionActive(s,g,'spirit-conversion')?technique:{...technique,attributes:technique.attributes.filter(attribute=>attribute!=='精')};
 return attackPropertyTechnique(s,g,t,h,beastTechnique(s,g,t,h,destructionTechnique(s,g,t,h,liveSpirit)));
}
/** Shared incoming values for all pre-snapshot defense consumers. */
export function currentEffectiveTechnique(s:GameState,g:AttackGroup,actorId?:string):Technique {
 for(const t of g.targets){
  if(actorId!==undefined&&t.actorId!==actorId)continue;
  const hit=t.hits.find(h=>h.index===g.hitCursor);
  if(hit)return effectiveHitTechnique(s,g,t,hit);
 }
 return g.technique;
}
export function virtualGuardWillEnter(s:GameState,g:AttackGroup,t:AttackTarget):boolean {
 if(!t.virtualGuardActorId||t.virtualGuardActorId!==t.actorId||!activeAbilitySource(s,t.actorId,ARNES_GUARD))return false;
 const p=s.players[t.actorId]!;
 return !(p.revealed&&p.characterId==='c2-p03-r2c2'&&illusionActive(s,g,'arnes-suppression'));
}
export function followerAbilityOptions(s:GameState,actorId:string,add:(id:AbilityId,extra?:Partial<AbilityOption>)=>void):void {
 const w=s.windows?.at(-1);if(w?.continuation.kind!=='group')return;
 const g=s.groups?.[w.continuation.id];if(!g)return;
 const p=s.players[actorId]!;const mayEnhance=!s.actions?.[g.actionId]?.fixedReceivedEffect;const targetId=w.continuation.targetId;const t=g.targets.find(t=>t.actorId===targetId);
 if(mayEnhance&&w.kind==='attack-abilities'&&g.attackerId===actorId&&ownsAbility(p,LESTER_ILLUSION)){
  const magic=gameStats(s,p.id).magic_level;
  add(LESTER_ILLUSION,{effectOptions:ILLUSION_EFFECTS.filter(e=>e.id!=='spirit-conversion'||g.targets.some(t=>t.hits.some(h=>qualifiesForSpirit(s,g,h,magic)))).map(e=>({...e}))});
 }
 if(w.kind!=='follower-entry-abilities'||!t||t.followerStarted)return;
 if(t.actorId===actorId&&ownsAbility(p,ARNES_GUARD))add(ARNES_GUARD);
 if(mayEnhance&&g.attackerId===actorId&&p.revealed&&ownsAbility(p,TIA_SURPRISE)&&(s.players[t.actorId]!.followers.length>0||virtualGuardWillEnter(s,g,t))){
  const costs=p.hand.filter(id=>getAction(id)?.modes?.some(m=>m.playMode==='advance'));
  if(costs.length)add(TIA_SURPRISE,{costCardInstanceIds:costs});
 }
}
export function validFollowerAbility(s:GameState,f:AbilityFrame):boolean|undefined {
 if(f.abilityId===LESTER_ILLUSION){
  if(f.context.kind!=='group')return false;
  const g=s.groups?.[f.context.groupId];return !!g&&g.attackerId===f.actorId&&g.stage==='defense'&&!g.targets.some(t=>t.followerStarted);
 }
 if(f.abilityId!==ARNES_GUARD&&f.abilityId!==TIA_SURPRISE)return;
 if(f.context.kind!=='follower-entry')return false;
 const g=s.groups?.[f.context.groupId],targetId=f.context.targetId;const t=g?.targets.find(t=>t.actorId===targetId);
 if(!g||!t||t.followerStarted||!isActive(s.players[t.actorId]!)||!isActive(s.players[g.attackerId]!))return false;
 if(f.abilityId===ARNES_GUARD)return t.actorId===f.actorId;
 return g.attackerId===f.actorId&&s.players[f.actorId]!.revealed&&(s.players[t.actorId]!.followers.length>0||virtualGuardWillEnter(s,g,t));
}
export function resolveFollowerAbility(s:GameState,f:AbilityFrame):boolean {
 if(f.abilityId===LESTER_ILLUSION&&f.context.kind==='group'){
  const g=s.groups![f.context.groupId]!;
  g.illusion={actorId:f.actorId,effectIds:[...f.abilityEffectIds!]};
  if(f.abilityEffectIds!.includes('spirit-conversion'))for(const t of g.targets)for(const h of t.hits){
   if(!f.spiritSourceHitKeys?.includes(`${t.actorId}:${h.index}`))continue;
   const base=h.technique??g.technique;h.illusionSpiritAdded=!base.attributes.includes('精');h.technique=spiritTechnique(base);
  }
  return true;
 }
 if(f.context.kind==='follower-entry'){
  const targetId=f.context.targetId;const t=s.groups![f.context.groupId]!.targets.find(t=>t.actorId===targetId)!;
  if(f.abilityId===ARNES_GUARD){t.virtualGuardActorId=f.actorId;return true;}
  if(f.abilityId===TIA_SURPRISE){t.surpriseActorId=f.actorId;return true;}
 }
 return false;
}
/** Live modifiers are fixed once at entry. Subsequent child resumes use saved values. */
export function freezeEntryModifiers(s:GameState,g:AttackGroup,t:AttackTarget):void {
 t.frozenAbilityIgnore=!!(t.surpriseActorId&&activeAbilitySource(s,t.surpriseActorId,TIA_SURPRISE)||g.abilityFollowerIgnore&&activeAbilitySource(s,g.abilityFollowerIgnore,'c2-p04-r2c2-ab02'));
 t.physicalHumansInvalid=illusionActive(s,g,'human-invalidation');
 for(const h of t.hits){const selected=liveBeastSelection(s,g,h,h.technique??g.technique);if(selected)h.frozenBeastEmpathy={...selected};h.technique=effectiveHitTechnique(s,g,t,h);if(h.receivedDefense)h.receivedDefense.snapshotApplied=true;}
}
