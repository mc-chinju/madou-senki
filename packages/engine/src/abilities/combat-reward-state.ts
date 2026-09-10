import type {GameState} from '../state.js';
import {gameStats} from '../game-stats.js';
import {lifeIdentity} from './suppression-state.js';
import type {DamageIntent} from '../lifecycle/types.js';
export const DIA_ABSORB='c2-p06-r1c2-ab03',YOTSURM_HUNGER='c2-p06-r2c2-ab04';
export interface CombatDamageSnapshot {sourceLifeId:string;targetLifeId:string;targetSpirit:number;remainingEndurance:number;actualDamage:number;killingBlow:boolean}
export interface CombatRewardTask {kind:'combat-reward';id:string;batchId:string;mode:'damage'|'kill';actorId:string;targetId:string;sourceLifeId:string;targetLifeId:string;targetSpirit:number;amount:number;sourceEventId:string;sourceActionId?:string;sourceCardInstanceId?:string;sourceAbilityId?:string;attempted?:boolean;confirmed?:boolean;waiting?:boolean}
/** Freeze every target before applying damage or clearing conditional sources for simultaneous death. */
export function snapshotCombatDamage(s:GameState,intents:DamageIntent[]):void {
 const values=new Map<string,{spirit:number;remaining:number;lifeId:string;killed:boolean}>();
 for(const i of intents){const p=s.players[i.targetId];if(p&&!values.has(p.id)){const stats=gameStats(s,p.id);values.set(p.id,{spirit:stats.spirit,remaining:Math.max(0,stats.endurance-p.damage),lifeId:lifeIdentity(p),killed:false});}}
 for(const i of intents){const target=values.get(i.targetId),source=i.sourceActorId?s.players[i.sourceActorId]:undefined;if(!target)continue;
  const actual=Math.min(target.remaining,Math.max(0,i.damage)),kill=!target.killed&&(!!i.instantDeath||target.remaining>0&&i.damage>=target.remaining);
  if(source)i.rewardSnapshot={sourceLifeId:lifeIdentity(source),targetLifeId:target.lifeId,targetSpirit:target.spirit,remainingEndurance:target.remaining,actualDamage:actual,killingBlow:kill};
  target.remaining=Math.max(0,target.remaining-Math.max(0,i.damage));if(kill)target.killed=true;
 }
}
/** Public damage/death facts create opportunities; hidden ownership never changes response order. */
export function queueCombatRewards(s:GameState,intents:DamageIntent[],doomed:string[],batchId:string,mode:'damage'|'kill'):void {
 const tasks:CombatRewardTask[]=[];
 for(const i of intents){const snap=i.rewardSnapshot;if(!snap||!i.sourceActorId||i.sourceActorId===i.targetId||i.cause==='self-damage'||i.cause==='maximum-endurance')continue;
  if(mode==='damage'?i.damage<=0:!snap.killingBlow||!doomed.includes(i.targetId))continue;
  const previous=tasks.find(t=>t.actorId===i.sourceActorId&&t.targetId===i.targetId&&t.targetLifeId===snap.targetLifeId);if(previous){previous.amount+=snap.actualDamage;continue;}
  tasks.push({kind:'combat-reward',id:`reward-${s.nextEventId++}`,batchId,mode,actorId:i.sourceActorId,targetId:i.targetId,sourceLifeId:snap.sourceLifeId,targetLifeId:snap.targetLifeId,targetSpirit:snap.targetSpirit,amount:snap.actualDamage,sourceEventId:i.eventId,...(i.actionId?{sourceActionId:i.actionId}:{}),...(i.sourceCardInstanceId?{sourceCardInstanceId:i.sourceCardInstanceId}:{}),...(i.sourceAbilityId?{sourceAbilityId:i.sourceAbilityId}:{})});
 }
 for(const task of tasks.reverse())(s.lifecycle??=[]).push({...task,rootEventIds:[task.sourceEventId]});
}
