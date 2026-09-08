import { expect, test } from 'vitest';
import { deathGiftCommand, initialFollowerCards } from '../src/game/lifecycle-input.js';

test('a death gift keeps its spent source separate from the privately transferred card', () => {
  const choice = {
    hand: ['a2-p02-r3c3', 'a2-p05-r2c3'], faction: 'GOOD' as const,
    eligibleTargetIds: ['B'], cardInstanceId: 'a2-p02-r3c3',
    giftCardInstanceId: 'a2-p05-r2c3', targetId: 'B',
  };
  expect(deathGiftCommand(choice)).toEqual({
    type: 'PLAY_DEATH_GIFT', cardInstanceId: 'a2-p02-r3c3', giftCardInstanceId: 'a2-p05-r2c3', targetId: 'B',
  });
  expect(deathGiftCommand({ ...choice, giftCardInstanceId: choice.cardInstanceId })).toBeNull();
  expect(deathGiftCommand({ ...choice, hand: [choice.cardInstanceId] })).toBeNull();
  expect(deathGiftCommand({ ...choice, eligibleTargetIds: [] })).toBeNull();
  expect(deathGiftCommand({ ...choice, faction: 'EVIL' })).toBeNull();
});

test('revival follower choices respect the current faction without excluding character-specific followers', () => {
  const hand = ['a2-p20-r3c2', 'a2-p20-r3c3', 'a2-p20-r3c1', 'a2-p05-r2c3'];
  expect(initialFollowerCards(hand, 'GOOD')).toEqual(['a2-p20-r3c2', 'a2-p20-r3c1']);
  expect(initialFollowerCards(hand, 'EVIL')).toEqual(['a2-p20-r3c3', 'a2-p20-r3c1']);
  expect(initialFollowerCards(hand, 'ヴァンミール')).toEqual(['a2-p20-r3c1']);
});
