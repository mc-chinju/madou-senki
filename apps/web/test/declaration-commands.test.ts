import { expect, test } from 'vitest';
import { buildCardCommand } from '../src/game/commands.js';

test('an explicitly selected declaration ability stays attached to its original attack command', () => {
  const input = { cardId: 'a2-p09-r3c2', targetIds: ['B'], dedicated: false, declarationAbilityIds: ['c2-p01-r1c2-ab03'] };
  expect(buildCardCommand('ATTACK', input)).toEqual({ type: 'ATTACK', cardInstanceId: input.cardId, targetIds: ['B'], dedicated: false, declarationAbilityIds: input.declarationAbilityIds });
});
test('two selected conversion and chant abilities stay together on the defense command', () => {
  const input = { cardId: 'a2-p08-r1c2', dedicated: false, declarationAbilityIds: ['c2-p01-r2c1-ab01', 'c2-p01-r2c1-ab02'] };
  expect(buildCardCommand('PLAY_DEFENSE', input)).toEqual({ type: 'PLAY_DEFENSE', cardInstanceId: input.cardId, dedicated: false, declarationAbilityIds: input.declarationAbilityIds });
});
test('declining the declaration abilities preserves the ordinary wire shape', () => {
  expect(buildCardCommand('ATTACK', { cardId: 'a2-p09-r3c2', targetIds: ['B'], declarationAbilityIds: [] })).toEqual({ type: 'ATTACK', cardInstanceId: 'a2-p09-r3c2', targetIds: ['B'], dedicated: false });
});
