import {getAction} from '@madou/catalog';
import type {GameEvent, GameState, PlayerId, PublicRollRecord} from './state.js';
import type {RollFrame} from './rolls/frames.js';
import type {ActionFrame} from './reactions/continuations.js';

export type CardUse = NonNullable<GameEvent['use']>;

function record(s: GameState, event: Omit<GameEvent, 'id' | 'at'>): void {
  // transition() stamps the committed time on every event of the step.
  s.events.push({...event, id: s.nextEventId++, at: s.events.at(-1)?.at ?? 0});
}

/** Every card printed 複合 is paid alongside a technique rather than declaring one, so they all read alike
 *  wherever they are played: the combination components, 全軍突撃せよ and 必勝の祈り. */
function printedUse(cardInstanceId: string, use: CardUse): CardUse {
  const printed = getAction(cardInstanceId)?.printed_category;
  return (Array.isArray(printed) ? printed.includes('複合') : printed === '複合') ? 'combination' : use;
}

/** Only for a card that is face up in resolution (or on the table) at this moment. */
export function recordCardPlayed(s: GameState, actorId: PlayerId, cardInstanceId: string, use: CardUse, targetIds: readonly PlayerId[] = []): void {
  record(s, {type: 'CARD_PLAYED', actorId, audience: 'public', cardInstanceId, use: printedUse(cardInstanceId, use), ...(targetIds.length ? {targetIds: [...targetIds]} : {})});
}

/** A hidden character's ability stays anonymous to others; the actor still sees its own record. */
export function recordAbility(s: GameState, type: 'ABILITY_DECLARED' | 'ABILITY_CANCELED', actorId: PlayerId, abilityId: string, targetIds: readonly PlayerId[] = []): void {
  record(s, {type, actorId, audience: 'public', abilityId, ...(targetIds.length ? {targetIds: [...targetIds]} : {}), ...(s.players[actorId]?.revealed ? {} : {concealed: true})});
}

/** An attack with no card behind it (a virtual follower); the ability name follows the same rule as recordAbility. */
export function recordAbilityAttack(s: GameState, actorId: PlayerId, abilityId: string, targetIds: readonly PlayerId[]): void {
  record(s, {type: 'ATTACK_DECLARED', actorId, audience: 'public', abilityId, ...(targetIds.length ? {targetIds: [...targetIds]} : {}), ...(s.players[actorId]?.revealed ? {} : {concealed: true})});
}

/** Whether a usage check was needed is visible at the table, so the fact is public even when the reason is not. */
export function recordCheckSkipped(s: GameState, actorId: PlayerId, checkSkip: NonNullable<GameEvent['checkSkip']>, abilityId?: string): void {
  record(s, {type: 'CHECK_SKIPPED', actorId, audience: 'public', checkSkip,
    ...(abilityId ? {abilityId} : {}), ...(s.players[actorId]?.revealed ? {} : {concealed: true})});
}

/** How a declared attack ended. Landing, being blocked, fizzling and being cancelled are all seen at the table.
 *  The source pairs the ending with its declaration: a card that was already named in public, or, for a
 *  card-less attack, the ability under the same rule `recordAbility` uses. */
export function recordAttackOutcome(s: GameState, actorId: PlayerId, attackOutcome: NonNullable<GameEvent['attackOutcome']>,
  targetIds: readonly PlayerId[], source: {cardInstanceId?: string; abilityId?: string} = {}): void {
  record(s, {type: 'ATTACK_RESOLVED', actorId, audience: 'public', attackOutcome,
    ...(targetIds.length ? {targetIds: [...targetIds]} : {}),
    ...(source.cardInstanceId ? {cardInstanceId: source.cardInstanceId} : {}),
    ...(source.abilityId ? {abilityId: source.abilityId} : {}),
    ...(s.players[actorId]?.revealed ? {} : {concealed: true})});
}

/** A declared attack says how it ended, once, whichever exit it takes (G03 判定の公開範囲). The ending names
 *  what was declared, because a follower bundle or 全軍突撃 puts several declarations in flight at once. */
export function recordAttackEnded(s: GameState, a: ActionFrame, attackOutcome: NonNullable<GameEvent['attackOutcome']>, targetIds: readonly PlayerId[] = a.targetIds): void {
  if (a.kind !== 'attack' || a.attackOutcomeRecorded || a.substituteOrigin || a.substituteTransfer) return;
  a.attackOutcomeRecorded = true;
  recordAttackOutcome(s, a.actorId, attackOutcome, targetIds,
    a.cardInstanceId ? {cardInstanceId: a.cardInstanceId} : a.source?.kind === 'ability' ? {abilityId: a.source.abilityId} : {});
}

export function recordPass(s: GameState, actorId: PlayerId, windowKind: string): void {
  record(s, {type: 'PASSED', actorId, audience: 'public', windowKind});
}

/** One record per throw; a reroll repeats the same roll with the next attempt number. */
export function recordRoll(s: GameState, frame: RollFrame): void {
  const roll: PublicRollRecord = {rollId: frame.id, kind: frame.purpose, faces: [...frame.faces], total: frame.total ?? 0, attempt: frame.attempts.length,
    ...(frame.threshold !== undefined ? {threshold: frame.threshold} : {}), ...(frame.comparison ? {comparison: frame.comparison} : {}), ...(frame.success !== undefined ? {success: frame.success} : {}), ...(frame.forcedFailure ? {forcedFailure: true} : {})};
  // The record keeps the reading the roll was thrown under, so revealing later does not reopen past thresholds.
  const open = frame.rollerRevealed ?? false;
  record(s, {type: 'ROLL_RESOLVED', actorId: frame.rollerId, audience: 'public', roll, ...(open ? {} : {concealed: true})});
}

export function recordDamage(s: GameState, targetId: PlayerId, amount: number): void {
  record(s, {type: 'DAMAGE_APPLIED', actorId: targetId, audience: 'public', amount});
}

export function recordTurn(s: GameState, type: 'TURN_STARTED' | 'TURN_ENDED', actorId: PlayerId, turnNumber: number): void {
  record(s, {type, actorId, audience: 'public', turnNumber});
}

export function recordRest(s: GameState, actorId: PlayerId, count: number): void {
  record(s, {type: 'REST', actorId, audience: 'public', count});
}

/** A card nobody saw still leaves a trace: the table learns one more card left this seat, its owner which one. */
export function recordFaceDownDiscard(s: GameState, ownerId: PlayerId, cardInstanceId: string): void {
  record(s, {type: 'CARDS_DISCARDED', actorId: ownerId, audience: 'public', count: 1});
  record(s, {type: 'CARDS_DISCARDED', actorId: ownerId, audience: {playerId: ownerId}, cardInstanceId, count: 1});
}

/** A chant goes down face down, so only the act is public; the card is named when something turns it over. */
export function recordChanted(s: GameState, actorId: PlayerId): void {
  record(s, {type: 'CHANTED', actorId, audience: 'public'});
}

/** How many followers the seat ended up with is already visible at the table; which cards they are is not. */
export function recordFollowersArranged(s: GameState, actorId: PlayerId, count: number): void {
  record(s, {type: 'FOLLOWERS_ARRANGED', actorId, audience: 'public', count});
}

/** A follower that meets an attack is turned face up first, so its name travels with what it did. */
export function recordFollowerDefended(s: GameState, actorId: PlayerId, followerOutcome: NonNullable<GameEvent['followerOutcome']>, cardInstanceId?: string): void {
  record(s, {type: 'FOLLOWER_DEFENDED', actorId, audience: 'public', followerOutcome, ...(cardInstanceId ? {cardInstanceId} : {})});
}

/** The throw itself is a ROLL_RESOLVED record; this says which follower it was thrown for. */
export function recordMoraleCheck(s: GameState, actorId: PlayerId, success: boolean, cardInstanceId?: string): void {
  record(s, {type: 'MORALE_CHECKED', actorId, audience: 'public', success, ...(cardInstanceId ? {cardInstanceId} : {})});
}

/** Taking a card back is public; the discard pile is not, so a card from it is named only to its taker (G11). */
export function recordReclaim(s: GameState, actorId: PlayerId, cardInstanceId: string, faceUp: boolean): void {
  record(s, {type: 'CARD_RECLAIMED', actorId, audience: 'public', ...(faceUp ? {cardInstanceId} : {})});
  if (!faceUp) record(s, {type: 'CARD_RECLAIMED', actorId, audience: {playerId: actorId}, cardInstanceId});
}

/** The pile going back under the deck is done in the open; the order it lands in is not recorded. */
export function recordReshuffle(s: GameState, actorId: PlayerId, count: number): void {
  record(s, {type: 'DECK_RESHUFFLED', actorId, audience: 'public', count});
}

/** Status and distance changes are compared once per committed step, so every producer is covered. */
export function recordStepChanges(before: GameState, s: GameState): void {
  const active = (state: GameState, id: PlayerId) => (state.players[id]?.presence ?? 'active') === 'active';
  for (const id of s.seatOrder) {
    const was = before.players[id]?.statuses ?? [], now = s.players[id]?.statuses ?? [];
    for (const status of now) if (!was.some(old => old.id === status.id)) record(s, {type: 'STATUS_CHANGED', actorId: id, audience: 'public', status: {kind: status.kind, change: 'applied'}});
    if (!active(s, id)) continue;
    for (const status of was) if (!now.some(current => current.id === status.id)) record(s, {type: 'STATUS_CHANGED', actorId: id, audience: 'public', status: {kind: status.kind, change: 'removed'}});
  }
  for (const [i, a] of s.seatOrder.entries()) for (const b of s.seatOrder.slice(i + 1)) {
    const distance = s.distances[a]?.[b];
    if (!distance || before.distances[a]?.[b] === distance || !active(s, a) || !active(s, b)) continue;
    record(s, {type: 'DISTANCE_CHANGED', actorId: a, targetId: b, audience: 'public', distance});
  }
}
