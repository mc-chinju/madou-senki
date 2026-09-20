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
export function maintainFollowers(s: GameState): void {
    for (const p of Object.values(s.players))
        // Maintenance turns the illegal placement face up before it goes, so the table saw it.
        p.followers = p.followers.filter(f => { if (canPlaceFollower(p, f.cardInstanceId))
            return true; f.revealed = true; moveToDiscard(s, f.cardInstanceId, { ownerId: p.id, faceUp: true }); return false; });
}
export function followerPlacementOptions(p: PlayerState) { return { placeableCardInstanceIds: p.hand.filter(id => canPlaceFollower(p, id)), removableCardInstanceIds: p.followers.filter(f => canRemoveFollower(f.cardInstanceId)).map(f => f.cardInstanceId) }; }
