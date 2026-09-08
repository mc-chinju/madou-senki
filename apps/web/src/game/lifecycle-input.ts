import { getAction } from '@madou/catalog';
import type { GameCommand } from '@madou/protocol';

export function deathGiftCards(hand: readonly string[], faction: string): string[] {
  return hand.filter(id => faction === 'GOOD' ? id === 'a2-p02-r3c3' : faction === 'EVIL' && id === 'a2-p02-r3c2');
}
export function deathGiftCommand(selection: {
  hand: readonly string[]; faction: string; eligibleTargetIds: readonly string[];
  cardInstanceId: string; giftCardInstanceId: string; targetId: string;
}): Extract<GameCommand, { type: 'PLAY_DEATH_GIFT' }> | null {
  const { hand, faction, cardInstanceId, giftCardInstanceId, targetId, eligibleTargetIds } = selection;
  if (!deathGiftCards(hand, faction).includes(cardInstanceId) || !hand.includes(giftCardInstanceId) ||
    cardInstanceId === giftCardInstanceId || !eligibleTargetIds.includes(targetId)) return null;
  return { type: 'PLAY_DEATH_GIFT', cardInstanceId, giftCardInstanceId, targetId };
}
export function initialFollowerCards(hand: readonly string[], faction: string): string[] {
  return hand.filter(id => {
    const card = getAction(id);
    return card?.category === 'follower' && (card.name !== 'アルケミア城' || faction === 'GOOD') &&
      (card.name !== 'ガイナス城' || faction === 'EVIL');
  });
}
