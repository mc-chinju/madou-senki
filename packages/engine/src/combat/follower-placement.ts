import { followerFor } from '../effects/follower-descriptors.js';
import type { GameState, PlayerState } from '../state.js';
/** Shared initial, re-setup, arrangement, acquisition and maintenance condition. */
export function canPlaceFollower(p: PlayerState, id: string): boolean { const d = followerFor(id); return !!d && (!d.placementFaction || d.placementFaction === p.faction); }
export function canRemoveFollower(id: string): boolean { return !!followerFor(id) && !followerFor(id)!.nonremovable; }
export function maintainFollowers(s: GameState): void {
    for (const p of Object.values(s.players))
        p.followers = p.followers.filter(f => { if (canPlaceFollower(p, f.cardInstanceId))
            return true; f.revealed = true; s.discard.push(f.cardInstanceId); return false; });
}
export function followerPlacementOptions(p: PlayerState) { return { placeableCardInstanceIds: p.hand.filter(id => canPlaceFollower(p, id)), removableCardInstanceIds: p.followers.filter(f => canRemoveFollower(f.cardInstanceId)).map(f => f.cardInstanceId) }; }
