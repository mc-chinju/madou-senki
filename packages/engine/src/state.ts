import {expireTurnEnd} from './abilities/spirit-lifetime.js';
import {vanmilSuppressed} from './abilities/suppression-state.js';
import type {AbilityFrame} from './abilities/frames.js';
import type {Presence,CurrentObjective,Protection,DeathIdentity,LifecycleTask,Outcome,DamageIntent} from './lifecycle/types.js';
import type { RollFrame, TurnRollContinuation } from './rolls/frames.js';
import type { ActionFrame, AttackGroup, ReactionWindow } from './reactions/continuations.js';
import type { CharacterBaseStats } from '@madou/catalog';
export type PlayerId = string;
export interface Entropy { now: number; dice: readonly number[]; random?: readonly number[] }
export interface SetupOptions { distribution?: 'balanced' | 'random'; startingSeat?: number }
export interface PlacedCard { placedById?:string;placedLifeId?:string;cardInstanceId: string; revealed: boolean }
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
  combatRewardIds?:string[];
  sadLoveAura?:{sourceLifeId:string};sadLoveSubstitutionSpent?:boolean;sadLoveRewardIds?:string[];
  reclaimUsage?:Record<string,import('./reclaim.js').ReclaimBudget>;
  lifeId?:string;
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
  type: 'WISH_ACQUIRED' | 'WISH_DISCARDED' | 'FOLLOWER_DESTROYED' | 'CHARACTER_INSPECTED' | 'BEAST_CAPTURED' | 'CHARACTER_ASSIGNED' | 'CARD_DRAWN' | 'OPEN' | 'FOLLOWER_PLACED' | 'SETUP_PASSED' | 'CHARACTER_REVEALED' | 'SETUP_COMPLETE' | 'DEATH_PENDING' | 'PLAYER_DIED' | 'PLAYER_REVIVED' | 'PLAYER_WANDERING' | 'PLAYER_RETURNED' | 'PLAYER_EXITED' | 'CHARACTER_TRANSFORMED' | 'FACTION_CHANGED' | 'CARD_GIFTED' | 'GAME_COMPLETED'
    | 'TURN_STARTED' | 'TURN_ENDED' | 'REST' | 'CARD_PLAYED' | 'ATTACK_DECLARED' | 'CHECK_SKIPPED' | 'ABILITY_DECLARED' | 'ABILITY_CANCELED' | 'ROLL_RESOLVED' | 'DAMAGE_APPLIED' | 'STATUS_CHANGED' | 'DISTANCE_CHANGED' | 'PASSED';
  actorId: PlayerId; cardInstanceId?: string; characterId?: string; targetId?:string; count?:number;
  /** Public record fields. The text is built by the screen, never by the engine. */
  targetIds?: PlayerId[]; use?: 'attack' | 'defense' | 'counter' | 'maai' | 'advance' | 'anytime' | 'turn'; abilityId?: string;
  /** Why a usage check never happened: the level was enough, or an ability or the card's own text waived it. */
  checkSkip?: 'level' | 'ability' | 'card';
  roll?: PublicRollRecord; amount?: number; windowKind?: string; turnNumber?: number;
  status?: { kind: PersistentStatus['kind']; change: 'applied' | 'removed' }; distance?: 'near' | 'far';
  /** The actor's character was hidden when this happened; others see neither the ability name nor the check threshold. */
  concealed?: true;
}
/** `attempt` counts throws of the same roll, starting at 1. */
export interface PublicRollRecord { rollId: string; kind: import('./rolls/frames.js').RollPurpose; faces: number[]; total: number; threshold?: number; success?: boolean; forcedFailure?: true; attempt: number }
export interface GameState {
  combinationSpirit?:import('./effects/printed-combinations.js').CombinationSpirit[];
  wishes?:import('./effects/wish.js').WishDecision[];
  discardOccurrences?:import('./discard.js').DiscardOccurrence[];
  reclaimDecisions?:import('./reclaim.js').ReclaimDecision[];
  suppressionDesignations?:import('./abilities/suppression-state.js').SuppressionDesignation[];
  blessingLeases?:import('./abilities/suppression-state.js').BlessingLease[];
  inspectionHistory?:import('./abilities/private-inspection.js').InspectionView[];
  inspections?:import('./abilities/private-inspection.js').PrivateInspection[];
  followerBundles?:Record<string,import('./combat/follower-bundles.js').FollowerBundle>;
  abilities?:Record<string,AbilityFrame>;
  initialFactions?:('GOOD'|'EVIL'|'ヴァンミール')[];turnNumber?:number; lifecycle?:LifecycleTask[]; outcome?:Outcome; individualResults?:Record<string,'won'>; vanmilDeath?:boolean; lifecycleTriggers?:string[];
  windows?: ReactionWindow[]; actions?: Record<string, ActionFrame>; groups?: Record<string, AttackGroup>; used?: string[];
  /** Seats that left the whole root action to the others (G03); cleared by any accepted intervention. */
  standingPasses?: { rootEventId: string; actorIds: PlayerId[] };
  rolls?: RollFrame[]; turnRoll?: TurnRollContinuation;
  randomRolls?: RandomRollRecord[];
  reclaim?: Record<string,import('./reclaim.js').ReclaimReservation>;
  earlyTurnBook?:{actorId:string;closed:boolean};
  rulesetVersion: string; revision: number; phase: 'setup' | 'turn-start' | 'draw' | 'action' | 'hand-adjustment' | 'combat' | 'withdrawal';
  seatOrder: PlayerId[]; players: Record<PlayerId, PlayerState>; turnSeat: number;
  /** Concurrent setup round (G10): every participant places in any order, then the round refills in seat order. */
  pending: { kind: 'initial-followers'; round: number; participantIds: PlayerId[]; readyIds: PlayerId[]; placedIds: PlayerId[] } | null;
  distances: Record<PlayerId, Record<PlayerId, 'near' | 'far'>>;
  distanceMarkers?: Record<string,{ a:PlayerId; b:PlayerId; ownerId:PlayerId; cardInstanceId:string }>;
  deck: string[]; discard: string[]; resolution: string[]; reclaimReservations: string[];
  nextEventId: number; events: GameEvent[];
}
export interface DerivedStats extends CharacterBaseStats { handLimit: number; followerLimit: number; chantLimit: number; followerLevelBonus: number; moraleBonus: number }
export function hasStatus(player: PlayerState, kind: StatusKind): boolean {
  return player.statuses?.some(status => status.kind === kind) ?? false;
}
export function canUseCharacterAbility(player: PlayerState, state: GameState): boolean {
  return !hasStatus(player, 'stopped') && !hasStatus(player, 'ability-disabled') && !vanmilSuppressed(state,player.id);
}
export function allCardInstanceIds(state: GameState): string[] {
  return [...state.deck, ...state.discard, ...state.resolution, ...state.reclaimReservations,
    ...Object.values(state.distanceMarkers??{}).map(marker=>marker.cardInstanceId),
    ...state.seatOrder.flatMap(id => { const p = state.players[id]!; return [...p.hand, ...p.open, ...p.attachments, ...p.followers.map(c => c.cardInstanceId), ...p.chants.map(c => c.cardInstanceId)]; })];
}

/** Irrevocable ability death waits for its already-declared group to settle. */
export function hasPendingFatal(s:GameState,actorId:string):boolean {
  const groups=Object.values(s.groups??{});
  for(let i=0;i<groups.length;i++){const g=groups[i]!;if(g.pendingFatalIntents?.some(intent=>intent.targetId===actorId))return true;groups.push(...(g.substituteResults??[]).map(result=>result.group));}
  return false;
}
