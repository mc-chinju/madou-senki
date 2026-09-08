import {expireTurnEnd} from './abilities/spirit-lifetime.js';
import type {AbilityFrame} from './abilities/frames.js';
import type {Presence,CurrentObjective,Protection,DeathIdentity,LifecycleTask,Outcome,DamageIntent} from './lifecycle/types.js';
import type { RollFrame, TurnRollContinuation } from './rolls/frames.js';
import type { ActionFrame, AttackGroup, ReactionWindow } from './reactions/continuations.js';
import type { CharacterBaseStats } from '@madou/catalog';
export type PlayerId = string;
export interface Entropy { now: number; dice: readonly number[]; random?: readonly number[] }
export interface SetupOptions { distribution?: 'balanced' | 'random'; startingSeat?: number }
export interface PlacedCard { cardInstanceId: string; revealed: boolean }
export type StatusKind = 'stopped' | 'silenced' | 'ability-disabled';
interface StatusSource {id:string;sourceActorId?:PlayerId;sourceCardInstanceId?:string;targetId?:PlayerId}
export type PersistentStatus = StatusSource & (
 | {kind:StatusKind;timing?:'recovery';modifiers:number[];nextCheck:number}
 | {kind:'stopped';timing:'deadly-recovery';modifiers:number[];nextCheck:number}
 | {kind:'stopped';timing:'next-own-seat';sourceActorId:string;sourceAbilityId:string;expiresOnActorId:string}
 | {kind:'stopped';timing:'source-turn';sourceActorId:string;sourceCardInstanceId:string}
 | {kind:'stopped';timing:'fixed-turns';remainingTurns:number}
 | {kind:'stat-drain';timing:'until-death';amount:number}
);
/** Called exactly once when an arriving turn completes, including whole-turn skips. */
export function completeOwnTurn(player:PlayerState,state?:GameState):void{
 if(state)expireTurnEnd(state,player.id);
 if(player.statuses)player.statuses=player.statuses.filter(status=>status.timing!=='fixed-turns'||--status.remainingTurns>0);
}
export interface RandomRollRecord {
  id:string; eventId:string; actionId:string; kind:'damage';
  formula:'d6'|'d6-product-min10'|'d6x5'|'d6x2'|'d6x4'|'2d6x2'|'2d6'|'3d6'|'4d6+1'; faces:number[]; modifier:number; total:number;
}
export interface PlayerState {
  conditionalSelections?:import('./abilities/conditional-sources.js').ConditionalSelection[];
  spiritReplacements?:import('./abilities/spirit-lifetime.js').SpiritReplacement[];
  skipTurns?:number; statuses?: PersistentStatus[]; presence?: Presence; currentObjective?:CurrentObjective; protection?:Protection; deathIdentity?:DeathIdentity; permanent?:Partial<CharacterBaseStats>; abilityCharacterIds?:string[];
  id: PlayerId; name: string; characterId: string; revealed: boolean;
  faction: 'GOOD' | 'EVIL' | 'ヴァンミール'; objective: string; damage: number;
  hand: string[]; followers: PlacedCard[]; chants: PlacedCard[]; open: string[]; attachments: string[];
}
export interface GameEvent {
  death?:Pick<DamageIntent,'cause'|'eventId'|'sourceActorId'|'sourceCardInstanceId'>;
  id: number; at: number; audience: 'public' | { playerId: PlayerId };
  type: 'BEAST_CAPTURED' | 'CHARACTER_ASSIGNED' | 'CARD_DRAWN' | 'OPEN' | 'FOLLOWER_PLACED' | 'SETUP_PASSED' | 'CHARACTER_REVEALED' | 'SETUP_COMPLETE' | 'DEATH_PENDING' | 'PLAYER_DIED' | 'PLAYER_REVIVED' | 'PLAYER_WANDERING' | 'PLAYER_RETURNED' | 'PLAYER_EXITED' | 'CHARACTER_TRANSFORMED' | 'FACTION_CHANGED' | 'CARD_GIFTED' | 'GAME_COMPLETED';
  actorId: PlayerId; cardInstanceId?: string; characterId?: string; targetId?:string; count?:number;
}
export interface GameState {
  inspections?:import('./abilities/private-inspection.js').PrivateInspection[];
  followerBundles?:Record<string,import('./combat/follower-bundles.js').FollowerBundle>;
  abilities?:Record<string,AbilityFrame>;
  initialFactions?:('GOOD'|'EVIL'|'ヴァンミール')[];turnNumber?:number; lifecycle?:LifecycleTask[]; outcome?:Outcome; individualResults?:Record<string,'won'>; vanmilDeath?:boolean; lifecycleTriggers?:string[];
  windows?: ReactionWindow[]; actions?: Record<string, ActionFrame>; groups?: Record<string, AttackGroup>; used?: string[];
  rolls?: RollFrame[]; turnRoll?: TurnRollContinuation;
  randomRolls?: RandomRollRecord[];
  reclaim?: Record<string,{ownerId:PlayerId;eventId:string}>;
  rulesetVersion: string; revision: number; phase: 'setup' | 'turn-start' | 'draw' | 'action' | 'hand-adjustment' | 'combat' | 'withdrawal';
  seatOrder: PlayerId[]; players: Record<PlayerId, PlayerState>; turnSeat: number;
  setupCursor: number; pending: { kind: 'initial-followers'; actorId: PlayerId; seat: number } | null;
  distances: Record<PlayerId, Record<PlayerId, 'near' | 'far'>>;
  distanceMarkers?: Record<string,{ a:PlayerId; b:PlayerId; ownerId:PlayerId; cardInstanceId:string }>;
  deck: string[]; discard: string[]; resolution: string[]; reclaimReservations: string[];
  nextEventId: number; events: GameEvent[];
}
export interface DerivedStats extends CharacterBaseStats { handLimit: number; followerLimit: number; chantLimit: number; followerLevelBonus: number; moraleBonus: number }
export function hasStatus(player: PlayerState, kind: StatusKind): boolean {
  return player.statuses?.some(status => status.kind === kind) ?? false;
}
export function canUseCharacterAbility(player: PlayerState): boolean {
  return !hasStatus(player, 'stopped') && !hasStatus(player, 'ability-disabled');
}
export function allCardInstanceIds(state: GameState): string[] {
  return [...state.deck, ...state.discard, ...state.resolution, ...state.reclaimReservations,
    ...Object.values(state.distanceMarkers??{}).map(marker=>marker.cardInstanceId),
    ...state.seatOrder.flatMap(id => { const p = state.players[id]!; return [...p.hand, ...p.open, ...p.attachments, ...p.followers.map(c => c.cardInstanceId), ...p.chants.map(c => c.cardInstanceId)]; })];
}

/** Irrevocable ability death waits for its already-declared group to settle. */
export function hasPendingFatal(s:GameState,actorId:string):boolean {
  return Object.values(s.groups??{}).some(g=>g.pendingFatalIntents?.some(intent=>intent.targetId===actorId));
}
