import type {PlayerId,GameState} from '../state.js';
export type Presence = 'active'|'pending-death'|'dead'|'wandering'|'otherworld'|'exited';
export type Faction = 'GOOD'|'EVIL'|'ヴァンミール';
export type CurrentObjective = {kind:'extinction';enemyFactions:Faction[];label?:string};
export interface Protection {characterIds:string[];description?:string}
export type LifecycleAbility = 'lancelot-transform'|'vanmil-subordinates'|'arseil-conspiracy';
export interface Outcome {kind:'victory'|'draw';reason:'objectives'|'mutual-extinction'|'vanmil-death'|'stalemate';winnerIds:PlayerId[];results:Record<PlayerId,'won'|'lost'|'draw'>}
export interface DeathIdentity {characterId:string;faction:Faction;objective:string;currentObjective:CurrentObjective;protection:Protection}
export interface DamageIntent {targetId:PlayerId;damage:number;instantDeath?:boolean;cause:'attack'|'self-damage'|'instant-death'|'maximum-endurance'|'petrification';sourceActorId?:PlayerId;sourceCardInstanceId?:string;groupId?:string;actionId?:string;eventId:string}
export type LifecycleTask =
 | import('../abilities/beast-empathy.js').BeastCaptureTask
 | {kind:'technique-revival';id:string;sourceActorId:string;targetIds:string[];convertTargetIds:string[];cursor:number}
 | {kind:'post-death-heal';id:string;actorId:string;targetIds:string[];sinceEventId:number}
 | {kind:'draw';id:string;actorId:PlayerId;target:number}
 | {kind:'resume-phase';id:string;phase:GameState['phase'];turnSeat?:number}
 | {kind:'protection';id:string}
 | {kind:'declaration';id:string;actionId:string}
 | {kind:'fusen';id:string;actorId:PlayerId;sourceCardInstanceId:string;targetIds:PlayerId[];cursor:number;rollId?:string;waiting?:boolean}
 | {kind:'death-batch';id:string;actorIds:PlayerId[];cursor:number;intents:DamageIntent[];waiting?:boolean}
 | {kind:'re-setup';id:string;actorId:PlayerId;waiting?:boolean}
 | {kind:'boundary';id:string;trigger:'lia-revealed'|'vanmil-awakened';waiting?:boolean};
export interface LifecycleDecision {kind:'death-gift'|'revival'|'lifecycle-boundary'|'re-setup';actorId:PlayerId;eligibleTargetIds:PlayerId[];sourceCardInstanceId?:string}
