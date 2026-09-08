import { applyDeclarationSelection, type DeclarationInputView } from './declaration-input.js';
import type { GameCommand } from '@madou/protocol';
import type { FollowerInputView } from './follower-input.js';

export interface MagicGateInputView extends FollowerInputView, DeclarationInputView {
  magicGateTargets: { actorId: string; positions: number[] }[];
}
export const magicGateCardId = 'a2-p17-r3c3';

export function magicGateCommand(view: MagicGateInputView, actorId: string, targetPosition: number, destinationPosition: number, replacementCardInstanceId?: string, declarationAbilityIds: string[] = []): GameCommand | null {
  if (view.activeWindow || !view.legalChoices.includes('PLAY_TURN_TECHNIQUE') || !view.self.hand.includes(magicGateCardId) || actorId === view.self.id) return null;
  if (!Number.isInteger(targetPosition) || !view.magicGateTargets.some(target => target.actorId === actorId && target.positions.includes(targetPosition))) return null;
  const current = view.self.followers.map(card => card.cardInstanceId);
  const full = current.length >= view.self.stats.followerLimit;
  if (full && (!replacementCardInstanceId || !current.includes(replacementCardInstanceId) || !view.followerPlacementOptions.removableCardInstanceIds.includes(replacementCardInstanceId))) return null;
  if (!full && replacementCardInstanceId) return null;
  const remainingCount = current.length - (replacementCardInstanceId ? 1 : 0);
  if (remainingCount + 1 > view.self.stats.followerLimit || !Number.isInteger(destinationPosition) || destinationPosition < 0 || destinationPosition > remainingCount) return null;
  return applyDeclarationSelection(view, { type: 'PLAY_TURN_TECHNIQUE', cardInstanceId: magicGateCardId, targetIds: [actorId], dedicated: false,
    followerTransfer: { targetPosition, destinationPosition, ...(replacementCardInstanceId ? { replacementCardInstanceId } : {}) } }, declarationAbilityIds);
}
