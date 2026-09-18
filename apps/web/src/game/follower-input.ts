import type { GameCommand } from '@madou/protocol';

export interface FollowerInputView {
  self: { id: string; hand: string[]; followers: { cardInstanceId: string }[]; stats: { followerLimit: number } };
  legalChoices: string[];
  activeWindow: { kind: string; pendingActorId: string } | null;
  followerPlacementOptions: { placeableCardInstanceIds: string[]; removableCardInstanceIds: string[] };
  followerDefenseOptions: { cardInstanceId: string }[];
}

export function followerArrangementCommand(view: FollowerInputView, ordered: string[]): GameCommand | null {
  if (!view.legalChoices.includes('ARRANGE_FOLLOWERS') || new Set(ordered).size !== ordered.length || ordered.length > view.self.stats.followerLimit) return null;
  const current = view.self.followers.map(card => card.cardInstanceId);
  const { placeableCardInstanceIds, removableCardInstanceIds } = view.followerPlacementOptions;
  if (current.some(id => !ordered.includes(id) && !removableCardInstanceIds.includes(id))) return null;
  if (ordered.some(id => !current.includes(id) && (!view.self.hand.includes(id) || !placeableCardInstanceIds.includes(id)))) return null;
  return { type: 'ARRANGE_FOLLOWERS', cardInstanceIds: [...ordered] };
}

export function followerDefenseCommand(view: FollowerInputView, selected: string[]): GameCommand | null {
  if (view.activeWindow?.kind !== 'normal-defense' || view.activeWindow.pendingActorId !== view.self.id || !view.legalChoices.includes('START_FOLLOWERS')) return null;
  if (new Set(selected).size !== selected.length || selected.some(id => !view.self.followers.some(card => card.cardInstanceId === id) || !view.followerDefenseOptions.some(option => option.cardInstanceId === id))) return null;
  return { type: 'START_FOLLOWERS', ...(selected.length ? { dedicatedCardInstanceIds: [...selected] } : {}) };
}

export function initialFollowerCommand(view: FollowerInputView, cardInstanceId: string, position?: 'front' | 'back'): GameCommand | null {
  if (!view.legalChoices.includes('PLACE_INITIAL_FOLLOWER') || view.self.followers.length >= view.self.stats.followerLimit || !view.self.hand.includes(cardInstanceId) || !view.followerPlacementOptions.placeableCardInstanceIds.includes(cardInstanceId)) return null;
  if (view.activeWindow && view.activeWindow.pendingActorId !== view.self.id) return null;
  // The front line is only a choice once something is already placed; the engine defaults to the back.
  return { type: 'PLACE_INITIAL_FOLLOWER', cardInstanceId, ...(position === 'front' && view.self.followers.length ? { position } : {}) };
}
