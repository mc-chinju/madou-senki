import { lifeIdentity } from '../abilities/suppression-state.js';
import { followerFor } from '../effects/follower-descriptors.js';
import { moveToDiscard } from '../discard.js';
import type { GameState, PlacedCard, PlayerState } from '../state.js';
/** Index 0 is the front line (G10): `front` puts the new follower ahead of the existing ones. */
export function placeFollower(p: PlayerState, cardInstanceId: string, position?: 'front' | 'back'): PlacedCard {
  const card: PlacedCard = { cardInstanceId, revealed: false, placedById: p.id, placedLifeId: lifeIdentity(p) };
  if (position === 'front') p.followers.unshift(card); else p.followers.push(card);
  return card;
}
/** Shared initial, re-setup, arrangement, acquisition and maintenance condition. */
export function canPlaceFollower(p: PlayerState, id: string): boolean { const d = followerFor(id); return !!d && (!d.placementFaction || d.placementFaction === p.faction); }
export function canRemoveFollower(id: string): boolean { return !!followerFor(id) && !followerFor(id)!.nonremovable; }
// Maintenance runs after every transition with no event and no clock, so it announces nothing: the other
// seats see the follower count fall, not which card left. A placement that never turned face up (G10 places
// face down) therefore stays hidden in the pile, matching `faceUp` = what the table saw, never a new
// publication. Nothing in the rules asks an illegal placement to be published as it is removed.
export function maintainFollowers(s: GameState): void {
    for (const p of Object.values(s.players))
        p.followers = p.followers.filter(f => { if (canPlaceFollower(p, f.cardInstanceId))
            return true; moveToDiscard(s, f.cardInstanceId, { ownerId: p.id, faceUp: f.revealed }); return false; });
}
export function followerPlacementOptions(p: PlayerState) { return { placeableCardInstanceIds: p.hand.filter(id => canPlaceFollower(p, id)), removableCardInstanceIds: p.followers.filter(f => canRemoveFollower(f.cardInstanceId)).map(f => f.cardInstanceId) }; }
