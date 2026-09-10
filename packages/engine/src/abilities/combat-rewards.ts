import type {GameState} from '../state.js';
import {canUseCharacterAbility} from '../state.js';
import {isActive} from '../lifecycle/objectives.js';
import {ownsAbility} from './ownership.js';
import {lifeIdentity} from './suppression-state.js';
import {DIA_ABSORB,YOTSURM_HUNGER,type CombatRewardTask} from './combat-reward-state.js';
import type {AbilityFrame,AbilityId,AbilityOption} from './frames.js';
export interface CombatRewardContext {kind:'combat-reward';taskId:string;sourceLifeId:string}
function key(t:CombatRewardTask){return `${t.mode}:${t.batchId}:${t.actorId}:${t.targetLifeId}`;}
function eligible(s:GameState,t:CombatRewardTask):boolean {const p=s.players[t.actorId];return !!p&&isActive(p)&&lifeIdentity(p)===t.sourceLifeId&&canUseCharacterAbility(p,s)&&ownsAbility(p,t.mode==='damage'?DIA_ABSORB:YOTSURM_HUNGER)&&!p.combatRewardIds?.includes(key(t))&&(t.mode==='damage'?t.amount>0:t.confirmed===true&&t.targetSpirit>=8);}
export function combatRewardOptions(s:GameState,actorId:string,add:(id:AbilityId,extra?:Partial<AbilityOption>)=>void):void {
 const w=s.windows?.at(-1);if(w?.kind!=='lifecycle-boundary'||w.continuation.kind!=='lifecycle')return;
 const t=s.lifecycle?.find(t=>t.id===w.continuation.id);if(t?.kind!=='combat-reward'||t.actorId!==actorId||t.attempted||!eligible(s,t))return;
 add(t.mode==='damage'?DIA_ABSORB:YOTSURM_HUNGER,{description:t.mode==='damage'?`実際に与えたダメージ${t.amount}点まで耐久力を回復します。`:'耐久力を全回復し、戦士Lvと魔法Lvがそれぞれ2増えます。'});
}
export function initializeCombatReward(s:GameState,f:AbilityFrame):void {
 if(f.abilityId!==DIA_ABSORB&&f.abilityId!==YOTSURM_HUNGER)return;
 const t=s.lifecycle?.find(t=>t.id===f.eventId);if(t?.kind!=='combat-reward')throw Error('MISSING_COMBAT_REWARD');t.attempted=true;f.targetIds=[t.targetId];f.context={kind:'combat-reward',taskId:t.id,sourceLifeId:t.sourceLifeId};
}
export function resolveCombatReward(s:GameState,f:AbilityFrame):void {
 if(f.context.kind!=='combat-reward'||f.canceled)return;const t=s.lifecycle?.find(t=>t.id===(f.context as CombatRewardContext).taskId);if(t?.kind!=='combat-reward'||t.actorId!==f.actorId||!eligible(s,t))return;
 const p=s.players[f.actorId]!;if(t.mode==='damage')p.damage=Math.max(0,p.damage-t.amount);else{p.damage=0;(p.permanent??={}).warrior_level=(p.permanent.warrior_level??0)+2;p.permanent.magic_level=(p.permanent.magic_level??0)+2;}
 (p.combatRewardIds??=[]).push(key(t));
}
