import {gameStats} from '../game-stats.js';
import type { GameCommand } from '@madou/protocol';
import type { ActionFrame } from '../reactions/continuations.js';
import type { GameState } from '../state.js';
import { hasStatus } from '../state.js';
import { isActive } from './objectives.js';
import { canPlaceFollower, canRemoveFollower } from '../combat/follower-placement.js';
type Transfer = NonNullable<Extract<GameCommand, {
    type: 'PLAY_TURN_TECHNIQUE';
}>['followerTransfer']>;
export function validMagicGate(s: GameState, actorId: string, donorId: string, choice: Transfer): boolean {
    const p = s.players[actorId]!;
    const donor = s.players[donorId];
    const f = donor?.followers[choice.targetPosition];
    if (!donor || donorId === actorId || !isActive(donor) || !f || f.revealed && !canPlaceFollower(p, f.cardInstanceId))
        return false;
    const full = p.followers.length >= gameStats(s,p.id).followerLimit;
    const replacement = choice.replacementCardInstanceId;
    if (full ? (!replacement || !p.followers.some(f => f.cardInstanceId === replacement) || !canRemoveFollower(replacement)) : replacement !== undefined)
        return false;
    const surviving = p.followers.length - (replacement ? 1 : 0);
    return surviving < gameStats(s,p.id).followerLimit && choice.destinationPosition <= surviving;
}
export function acceptMagicGate(s: GameState, actorId: string, donorId: string, choice: Transfer): NonNullable<ActionFrame['followerTransfer']> {
    const p = s.players[actorId]!;
    if (choice.replacementCardInstanceId) {
        p.followers = p.followers.filter(f => f.cardInstanceId !== choice.replacementCardInstanceId);
        s.discard.push(choice.replacementCardInstanceId);
    }
    return { donorId, cardInstanceId: s.players[donorId]!.followers[choice.targetPosition]!.cardInstanceId, destinationPosition: choice.destinationPosition };
}
export function resolveMagicGate(s: GameState, a: ActionFrame): void {
    const binding = a.followerTransfer;
    if (!binding)
        return;
    const p = s.players[a.actorId]!;
    const donor = s.players[binding.donorId]!;
    const at = donor.followers.findIndex(f => f.cardInstanceId === binding.cardInstanceId);
    if (!isActive(p) || !isActive(donor) || at < 0 || !canPlaceFollower(p, binding.cardInstanceId) || p.followers.length >= gameStats(s,p.id).followerLimit || binding.destinationPosition > p.followers.length)
        return;
    const [card] = donor.followers.splice(at, 1);
    p.followers.splice(binding.destinationPosition, 0, card!);
}
export function magicGateTargets(s: GameState, actorId: string): {
    actorId: string;
    positions: number[];
}[] {
    const p = s.players[actorId]!;
    if (s.outcome || s.windows?.length || s.phase !== 'action' || s.seatOrder[s.turnSeat] !== actorId || !isActive(p) || hasStatus(p, 'stopped') || hasStatus(p, 'silenced') || !p.hand.includes('a2-p17-r3c3'))
        return [];
    return s.seatOrder.filter(id => id !== actorId && isActive(s.players[id]!)).map(id => ({ actorId: id, positions: s.players[id]!.followers.flatMap((f, i) => !f.revealed || canPlaceFollower(p, f.cardInstanceId) ? [i] : []) })).filter(v => v.positions.length > 0);
}
