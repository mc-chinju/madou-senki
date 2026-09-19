import type {GameEvent, GameState, PlayerId, PublicRollRecord} from './state.js';
import type {RollFrame} from './rolls/frames.js';
import type {ActionFrame} from './reactions/continuations.js';

export type CardUse = NonNullable<GameEvent['use']>;

function record(s: GameState, event: Omit<GameEvent, 'id' | 'at'>): void {
  // transition() stamps the committed time on every event of the step.
  s.events.push({...event, id: s.nextEventId++, at: s.events.at(-1)?.at ?? 0});
}

/** Only for a card that is face up in resolution (or on the table) at this moment. */
export function recordCardPlayed(s: GameState, actorId: PlayerId, cardInstanceId: string, use: CardUse, targetIds: readonly PlayerId[] = []): void {
  record(s, {type: 'CARD_PLAYED', actorId, audience: 'public', cardInstanceId, use, ...(targetIds.length ? {targetIds: [...targetIds]} : {})});
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
  record(s, {type: 'ROLL_RESOLVED', actorId: frame.rollerId, audience: 'public', roll, ...(frame.concealedRoller ? {concealed: true} : {})});
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
